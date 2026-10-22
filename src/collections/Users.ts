import type { CollectionConfig } from 'payload'

import { canAssignRole, hasRole } from '@/access/roles'
import { notifyStaffOfAccountRequest } from '@/lib/notifications'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    // Only admins should be able to use Payload Admin.
    hidden: ({ user }) => user?.role !== 'admin',
  },
  auth: true,
  /*
   * These rules govern the REST/GraphQL API and Payload Admin.
   * Signup and the Editorial Users page use the Local API on the
   * server and enforce canAssignRole themselves. Staff can see
   * each other so shared work shows who did what.
   */
  access: {
    admin: ({ req }) => hasRole(req.user, 'admin'),
    create: ({ req }) => hasRole(req.user, 'admin'),
    read: ({ req }) => {
      if (hasRole(req.user, 'editor')) return true
      if (req.user) return { id: { equals: req.user.id } }

      return false
    },
    update: ({ req }) => {
      if (hasRole(req.user, 'admin')) return true
      if (req.user) return { id: { equals: req.user.id } }

      return false
    },
    delete: ({ req }) => hasRole(req.user, 'admin'),
    unlock: ({ req }) => hasRole(req.user, 'admin'),
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
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        if (operation === 'create' && doc.role === 'pending') {
          await notifyStaffOfAccountRequest(req.payload, doc)
        }

        // Disabling an account (back to pending) signs the user out everywhere.
        if (operation === 'update' && doc.role === 'pending' && previousDoc?.role !== 'pending') {
          await req.payload.db.updateOne({
            collection: 'users',
            id: doc.id,
            data: { sessions: [] },
            req,
            returning: false,
          })
        }

        return doc
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

      // Users may edit their own profile, but never their own role.
      access: {
        create: ({ req, data }) => hasRole(req.user, 'admin') && data?.role !== 'admin',
        update: ({ req, doc, data }) => canAssignRole(req.user, doc, data?.role),
      },

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
