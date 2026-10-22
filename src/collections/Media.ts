import type { CollectionConfig, Where } from 'payload'

import { hasRole } from '@/access/roles'
import { getVisitorAudiences } from '@/access/visibility'
import { getUploadGrants } from '@/lib/uploadGrants'

export const Media: CollectionConfig = {
  slug: 'media',

  /*
   * Payload also runs `read` when serving the files themselves,
   * so this rule decides who can download each image or PDF.
   * Staff see everything; visitors see files released to their
   * audience, plus files they uploaded themselves or are revising.
   * Public submissions and anonymous editor uploads create media
   * through server code that checks access itself.
   */
  access: {
    read: ({ req }) => {
      if (hasRole(req.user, 'editor')) return true

      const released: Where = { audience: { in: getVisitorAudiences(req.user) } }
      const grantedIDs = getUploadGrants(req.headers)

      if (grantedIDs.length > 0) {
        return {
          or: [released, { id: { in: grantedIDs } }],
        }
      }

      return released
    },
    create: ({ req }) => hasRole(req.user, 'editor'),
    update: ({ req }) => hasRole(req.user, 'editor'),
    delete: ({ req }) => hasRole(req.user, 'editor'),
  },

  upload: {
    focalPoint: true,
    imageSizes: [
      {
        name: 'card',
        width: 900,
        height: 420,
        position: 'centre',
      },
      {
        name: 'square',
        width: 600,
        height: 600,
        position: 'centre',
      },
      {
        name: 'hero',
        width: 1600,
        height: 900,
        position: 'centre',
      },
    ],
  },

  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'audience',
      type: 'select',
      defaultValue: 'staff',
      index: true,
      options: [
        { label: 'Staff only', value: 'staff' },
        { label: 'Public', value: 'public' },
      ],
      admin: {
        position: 'sidebar',
        readOnly: true,
        description:
          'Set automatically: public while a published paper or site page uses this file, otherwise staff only.',
      },
    },
  ],
}
