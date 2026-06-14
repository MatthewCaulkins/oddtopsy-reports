import type { CollectionConfig } from 'payload'

export const EditorNotes: CollectionConfig = {
  slug: 'editor-notes',

  admin: {
    useAsTitle: 'note',
    defaultColumns: ['submission', 'noteType', 'createdBy', 'createdAt'],
  },

  access: {
    create: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },

  fields: [
    {
      name: 'submission',
      type: 'relationship',
      relationTo: 'submissions',
      required: true,
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
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
