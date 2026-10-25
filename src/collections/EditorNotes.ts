import type { CollectionConfig } from 'payload'

import { hasRole } from '@/access/roles'

export const EditorNotes: CollectionConfig = {
  slug: 'editor-notes',

  admin: {
    useAsTitle: 'note',
    defaultColumns: ['submission', 'noteType', 'createdBy', 'createdAt'],
  },

  /*
   * Notes are internal: editors read and add them; authors of a note
   * and managers can edit it; only managers delete.
   */
  access: {
    create: ({ req }) => hasRole(req.user, 'editor'),
    read: ({ req }) => hasRole(req.user, 'editor'),
    update: ({ req }) => {
      if (hasRole(req.user, 'manager')) return true
      if (hasRole(req.user, 'editor')) return { createdBy: { equals: req.user!.id } }

      return false
    },
    delete: ({ req }) => hasRole(req.user, 'manager'),
  },

  fields: [
    {
      name: 'submission',
      type: 'relationship',
      relationTo: 'submissions',
      required: true,
    },
    {
      // Set automatically. Not required, so a note survives its author's account being deleted.
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'noteType',
      type: 'select',
      required: true,
      defaultValue: 'internal',
      options: [
        { label: 'Internal Note', value: 'internal' },
        { label: 'Revision Request', value: 'revision_request' },
        { label: 'Editorial Decision', value: 'decision' },
        { label: 'Publication Note', value: 'publication_note' },
      ],
    },
    {
      name: 'note',
      type: 'textarea',
      required: true,
    },
  ],

  hooks: {
    beforeChange: [
      ({ req, data }) => {
        if (req.user && !data.createdBy) {
          return {
            ...data,
            createdBy: req.user.id,
          }
        }

        return data
      },
    ],
  },
}
