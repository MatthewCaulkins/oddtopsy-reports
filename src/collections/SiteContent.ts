import type { CollectionConfig } from 'payload'

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
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
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
