import type { CollectionConfig, PayloadRequest } from 'payload'

import { canAssignRole, canSetAccountStatus, hasRole } from '@/access/roles'
import { assertAnotherActiveAdmin } from '@/lib/auth/adminGuard'
import { getAuthConfig } from '@/lib/auth/config'
import { disableCognitoUser, enableCognitoUser } from '@/lib/auth/cognitoAdmin'
import { cognitoStrategy } from '@/lib/auth/cognitoStrategy'
import type { User } from '@/payload-types'

const authConfig = getAuthConfig()

/*
 * Keeps the linked Cognito account in step when Payload disables,
 * re-enables or deletes someone. Payload stays authoritative (the
 * Cognito strategy refuses disabled users regardless), so a failure
 * here is logged rather than blocking the change.
 */
async function syncCognitoAccount(req: PayloadRequest, user: User, action: 'disable' | 'enable') {
  if (!authConfig.cognito || !user.cognitoSub) return

  try {
    if (action === 'disable') {
      await disableCognitoUser(authConfig.cognito, user.cognitoSub)
    } else {
      await enableCognitoUser(authConfig.cognito, user.cognitoSub)
    }
  } catch (error) {
    req.payload.logger.error({ err: error }, `Could not ${action} Cognito account for user ${user.id}`)
  }
}

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
  /*
   * Sign-in methods come from AUTH_PROVIDERS (src/lib/auth/config.ts).
   * When password sign-in is off, the password fields stay in the
   * schema so every environment shares one database shape.
   */
  auth: {
    strategies: authConfig.cognito ? [cognitoStrategy(authConfig.cognito)] : [],
    ...(authConfig.password ? {} : { disableLocalStrategy: { enableFields: true } }),
  },
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
    // There must always be at least one active admin.
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        if (operation !== 'update' || !originalDoc) return data

        const wasActiveAdmin = originalDoc.role === 'admin' && originalDoc.accountStatus === 'active'

        const losesAdmin =
          (data.role !== undefined && data.role !== 'admin') ||
          (data.accountStatus !== undefined && data.accountStatus !== 'active')

        if (wasActiveAdmin && losesAdmin) {
          await assertAnotherActiveAdmin(req, originalDoc.id, 'demote or disable')
        }

        return data
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const user = await req.payload.findByID({
          collection: 'users',
          id,
          depth: 0,
          overrideAccess: true,
          req,
        })

        if (user.role === 'admin' && user.accountStatus === 'active') {
          await assertAnotherActiveAdmin(req, id, 'delete')
        }
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await syncCognitoAccount(req, doc as User, 'disable')
      },
    ],
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

          await syncCognitoAccount(req, doc as User, 'disable')
        }

        if (
          operation === 'update' &&
          previousDoc?.accountStatus === 'disabled' &&
          doc.accountStatus !== 'disabled'
        ) {
          await syncCognitoAccount(req, doc as User, 'enable')
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
        create: ({ req }) => hasRole(req.user, 'admin'),
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
    {
      // Link to the Cognito account, set only by provisioning from the sub
      // Cognito returns when we create the user. Never matched by email.
      name: 'cognitoSub',
      type: 'text',
      unique: true,
      index: true,
      access: {
        read: ({ req }) => hasRole(req.user, 'admin'),
        create: () => false,
        update: () => false,
      },
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Linked Cognito account. Set automatically when the account is provisioned.',
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
