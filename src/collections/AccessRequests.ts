import type { CollectionConfig } from 'payload'

import { hasRole } from '@/access/roles'

/*
 * Applications for an editorial account, and the audit trail of
 * each decision. Requests arrive through the public Request Access
 * form and are decided on the Editorial Users page; both go through
 * server code (src/lib/accessRequests.ts). The API is read-only for
 * managers so decisions cannot be rewritten after the fact.
 */
export const AccessRequests: CollectionConfig = {
  slug: 'access-requests',

  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'status', 'grantedRole', 'createdAt'],
  },

  access: {
    create: () => false,
    read: ({ req }) => hasRole(req.user, 'manager'),
    update: () => false,
    delete: ({ req }) => hasRole(req.user, 'admin'),
  },

  // Notifications are sent by src/lib/accessRequests.ts after the change commits,
  // not from hooks (which run inside the database transaction).

  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      index: true,
    },
    {
      name: 'affiliation',
      type: 'text',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'form',
      options: [
        { label: 'Request Access form', value: 'form' },
        { label: 'Migrated from a pending account', value: 'migrated' },
      ],
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },

    // Decision
    {
      name: 'grantedRole',
      type: 'select',
      options: [
        { label: 'Editor', value: 'editor' },
        { label: 'Manager', value: 'manager' },
      ],
    },
    {
      name: 'reviewer',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'decisionDate',
      type: 'date',
    },
    {
      name: 'rejectionNote',
      type: 'textarea',
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'The account created when this request was approved.',
      },
    },

    // Provisioning the approved person's sign-in. Recorded so a failure
    // is visible and can be retried without repeating the decision.
    {
      name: 'provisioning',
      type: 'group',
      fields: [
        {
          name: 'status',
          type: 'select',
          defaultValue: 'not_started',
          options: [
            { label: 'Not started', value: 'not_started' },
            { label: 'In progress', value: 'in_progress' },
            { label: 'Invite sent', value: 'complete' },
            { label: 'Failed', value: 'failed' },
          ],
        },
        {
          name: 'attempts',
          type: 'number',
          defaultValue: 0,
        },
        {
          name: 'lastAttemptAt',
          type: 'date',
        },
        {
          name: 'lastError',
          type: 'textarea',
        },
        {
          name: 'inviteSentAt',
          type: 'date',
        },
      ],
    },
  ],
}
