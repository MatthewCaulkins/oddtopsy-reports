import type { CollectionConfig } from 'payload'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const FocusAreas: CollectionConfig = {
  slug: 'focus-areas',

  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'displayOrder'],
  },

  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },

  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      admin: {
        description: 'Auto-generated from the focus area name if left blank.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'displayOrder',
      type: 'number',
      admin: {
        description: 'Auto-increments if left blank.',
      },
    },
  ],

  hooks: {
    beforeValidate: [
      async ({ data, req, operation }) => {
        if (!data) return data

        if (data.name && !data.slug) {
          data.slug = slugify(data.name)
        }

        if (operation === 'create' && data.displayOrder == null) {
          const existing = await req.payload.find({
            collection: 'focus-areas',
            limit: 1,
            sort: '-displayOrder',
            depth: 0,
          })

          const highest = existing.docs[0]?.displayOrder || 0
          data.displayOrder = highest + 1
        }

        return data
      },
    ],
  },
}
