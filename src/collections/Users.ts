import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    // Email added by default
    // Add more fields as needed
    {
      name: 'profile',
      type: 'group',
      fields: [
        {
          name: 'displayName',
          type: 'text',
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
          name: 'photo',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'biography',
          type: 'textarea',
        },
        {
          name: 'displayOnAboutPage',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'displayOrder',
          type: 'number',
          defaultValue: 0,
        },
      ],
    },
  ],
}
