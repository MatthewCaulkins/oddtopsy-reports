import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    // Only admins should be able to use Payload Admin.
    hidden: ({ user }) => user?.role !== 'admin',
  },
  auth: true,
  access: {
    admin: ({ req }) => {
      return req.user?.role === 'admin'
    },
  },
  hooks: {
    beforeLogin: [
      ({ user }) => {
        if (user.role === 'pending') {
          throw new Error('Your account is awaiting approval.')
        }

        return user
      },
    ],
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      saveToJWT: true,

      options: [
        {
          label: 'Pending',
          value: 'pending',
        },
        {
          label: 'Editor',
          value: 'editor',
        },
        {
          label: 'Manager',
          value: 'manager',
        },
        {
          label: 'Admin',
          value: 'admin',
        },
      ],
    },
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
