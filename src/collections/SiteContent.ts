import type { CollectionConfig } from 'payload'

import { hasRole } from '@/access/roles'
import type { SiteContent as SiteContentDoc } from '@/payload-types'
import {
  getSiteContentMedia,
  mergeMediaReferences,
  syncMediaAudience,
} from '@/lib/mediaVisibility'

export const SiteContent: CollectionConfig = {
  slug: 'site-content',

  versions: {
    drafts: true,
    maxPerDoc: 25,
  },

  admin: {
    useAsTitle: 'page',
  },

  access: {
    // The four site pages are seeded; editors edit them, only the admin adds or removes one.
    read: () => true,
    readVersions: ({ req }) => hasRole(req.user, 'editor'),
    create: ({ req }) => hasRole(req.user, 'admin'),
    update: ({ req }) => hasRole(req.user, 'editor'),
    delete: ({ req }) => hasRole(req.user, 'admin'),
  },

  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        await syncMediaAudience(
          req.payload,
          mergeMediaReferences(
            getSiteContentMedia(doc as SiteContentDoc),
            getSiteContentMedia(previousDoc as SiteContentDoc | undefined),
          ),
          req,
        )

        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await syncMediaAudience(req.payload, getSiteContentMedia(doc as SiteContentDoc), req)
      },
    ],
  },

  fields: [
    {
      name: 'page',
      type: 'select',
      required: true,
      unique: true,
      options: [
        { label: 'Papers', value: 'papers' },
        { label: 'Submit', value: 'submit' },
        { label: 'About', value: 'about' },
        { label: 'Subscribe', value: 'subscribe' },
      ],
    },

    {
      name: 'heroTitle',
      type: 'text',
      required: true,
    },

    {
      name: 'heroBody',
      type: 'textarea',
      admin: {
        components: {
          Field: '@/components/admin/JoditField',
        },
      },
    },

    {
      name: 'content',
      type: 'textarea',
      admin: {
        components: {
          Field: '@/components/admin/JoditField',
        },
      },
    },

    {
      name: 'secondaryTitle',
      type: 'text',
    },

    {
      name: 'secondaryContent',
      type: 'textarea',
      admin: {
        components: {
          Field: '@/components/admin/JoditField',
        },
      },
    },

    {
      name: 'editorialBoard',
      type: 'array',
      admin: {
        condition: (_, siblingData) => siblingData?.page === 'about',
      },
      fields: [
        {
          name: 'photo',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'affiliation',
          type: 'text',
        },
        {
          name: 'biography',
          type: 'textarea',
        },
      ],
    },
  ],
}
