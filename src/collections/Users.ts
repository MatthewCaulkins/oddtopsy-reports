import type { CollectionConfig } from 'payload'

import { canAssignRole, canSetAccountStatus, hasRole } from '@/access/roles'

/*
 * Users are approved editorial staff only. People ask for access
 * through AccessRequests; approving one creates the User.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'accountStatus'],
    // Only admins should be able to use Payload Admin (enforced by access.admin below).
    hidden: ({ user }) => user?.role !== 'admin',
  },
  auth: true,
  /*
   * These rules govern the REST/GraphQL API and Payload Admin.
   * Approvals and the Editorial Users page use the Local API on the
   * server and enforce the role rules themselves. Staff can see
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
        if (user.accountStatus === 'disabled') {
          throw new Error('This account is disabled.')
        }

        return user
      },
    ],
    afterLogin: [
      // Setting a password from the invite (or signing in) activates an invited account.
      async ({ user, req }) => {
        if (user.accountStatus === 'invited') {
          await req.payload.db.updateOne({
            collection: 'users',
            id: user.id,
            data: { accountStatus: 'active' },
            req,
            returning: false,
          })

          user.accountStatus = 'active'
        }

        return user
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        // Disabling an account signs the user out everywhere.
        if (
          operation === 'update' &&
          doc.accountStatus === 'disabled' &&
          previousDoc?.accountStatus !== 'disabled'
        ) {
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
      defaultValue: 'editor',
      saveToJWT: true,

      // Users may edit their own profile, but never their own role.
      access: {
        create: ({ req, data }) => hasRole(req.user, 'admin') && data?.role !== 'admin',
        update: ({ req, doc, data }) => canAssignRole(req.user, doc, data?.role),
      },

      options: [
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
    {
      name: 'accountStatus',
      type: 'select',
      required: true,
      defaultValue: 'invited',
      index: true,

      // 'invited' is set by provisioning; staff only switch between active and disabled.
      access: {
        create: ({ req }) => hasRole(req.user, 'admin'),
        update: ({ req, doc, data }) => canSetAccountStatus(req.user, doc, data?.accountStatus),
      },

      options: [
        { label: 'Invited', value: 'invited' },
        { label: 'Active', value: 'active' },
        { label: 'Disabled', value: 'disabled' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Invited until the first sign-in. Only active accounts have editorial access.',
      },
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
