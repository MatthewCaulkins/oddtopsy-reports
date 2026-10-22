import type { CollectionConfig } from 'payload'

import { hasRole } from '@/access/roles'
import { getReadablePaperWhere } from '@/access/visibility'
import type { Submission } from '@/payload-types'
import {
  getSubmissionMedia,
  mergeMediaReferences,
  syncMediaAudience,
} from '@/lib/mediaVisibility'
import { clearedRevisionAccess } from '@/lib/revisionAccess'

type SubmissionSiblingData = {
  submissionType?: 'upload' | 'editor'
}

export const Submissions: CollectionConfig = {
  slug: 'submissions',

  versions: {
    drafts: true,
    maxPerDoc: 25,
  },

  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'submissionType', 'workflowStatus', 'createdAt'],
  },

  /*
   * Submissions are shared work: every editor, manager and the admin
   * can edit any paper. Visitors only read published papers. Public
   * submissions and author revisions come in through server actions,
   * which check their own access, so the API never accepts them.
   */
  access: {
    create: ({ req }) => hasRole(req.user, 'editor'),
    read: ({ req }) => {
      if (hasRole(req.user, 'editor')) return true

      return getReadablePaperWhere(req.user)
    },
    readVersions: ({ req }) => hasRole(req.user, 'editor'),
    update: ({ req }) => hasRole(req.user, 'editor'),
    delete: ({ req }) => hasRole(req.user, 'manager'),
  },

  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        // Any move out of Revision Requested ends the author's revision link.
        if (
          originalDoc?.workflowStatus === 'revision_requested' &&
          data.workflowStatus &&
          data.workflowStatus !== 'revision_requested'
        ) {
          return { ...data, revisionAccess: clearedRevisionAccess }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        await syncMediaAudience(
          req.payload,
          mergeMediaReferences(
            getSubmissionMedia(doc as Submission),
            getSubmissionMedia(previousDoc as Submission | undefined),
          ),
          req,
        )

        return doc
      },
    ],
    beforeDelete: [
      // A note belongs to its paper; remove them first or the delete is blocked.
      async ({ id, req }) => {
        await req.payload.delete({
          collection: 'editor-notes',
          where: { submission: { equals: id } },
          overrideAccess: true,
          req,
        })
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await syncMediaAudience(req.payload, getSubmissionMedia(doc as Submission), req)
      },
    ],
  },

  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'subtitle',
      type: 'text',
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      admin: {
        description: 'Used for the public paper URL once published.',
      },
    },
    {
      name: 'abstract',
      type: 'textarea',
      required: true,
    },
    {
      name: 'focusArea',
      type: 'relationship',
      relationTo: 'focus-areas',
      hasMany: true,
      required: true,
    },
    {
      name: 'keywords',
      type: 'array',
      fields: [
        {
          name: 'keyword',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'findingDate',
      type: 'date',
      admin: {
        description: 'Optional date associated with the anatomical finding or case.',
      },
    },
    {
      name: 'location',
      type: 'text',
      admin: {
        description: 'Optional institution, city, state, or country.',
      },
    },
    {
      name: 'mediaNotes',
      type: 'textarea',
      admin: {
        description: 'Notes about images, figures, or supporting media.',
      },
    },
    {
      name: 'seoTitle',
      type: 'text',
    },
    {
      name: 'seoDescription',
      type: 'textarea',
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      required: true,
      admin: {
        description:
          'Primary image used on paper cards and the single paper page. Upload a large image and use crop/focal point controls in Media.',
      },
    },
    {
      name: 'publishedDate',
      type: 'date',
      admin: {
        condition: (_, siblingData) => siblingData?.workflowStatus === 'published',
      },
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'correspondingAuthor',
      type: 'group',
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
        },
        {
          name: 'affiliation',
          type: 'text',
        },
      ],
    },
    {
      name: 'leadAuthor',
      type: 'group',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'affiliation',
          type: 'text',
        },
      ],
    },
    {
      name: 'coAuthors',
      type: 'array',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'affiliation',
          type: 'text',
        },
      ],
    },
    {
      name: 'submissionType',
      type: 'select',
      required: true,
      defaultValue: 'upload',
      options: [
        { label: 'Upload PDF', value: 'upload' },
        { label: 'Write in Editor', value: 'editor' },
      ],
    },
    {
      name: 'manuscriptPDF',
      type: 'upload',
      relationTo: 'media',
      admin: {
        condition: (_, siblingData) => siblingData?.submissionType === 'upload',
        description: 'Upload the submitted manuscript PDF.',
      },
      validate: (value: unknown, { siblingData }: { siblingData: SubmissionSiblingData }) => {
        if (siblingData?.submissionType === 'upload' && !value) {
          return 'Please upload a manuscript PDF.'
        }

        return true
      },
    },
    {
      name: 'manuscriptBody',
      type: 'textarea',

      admin: {
        condition: (_, siblingData) => siblingData?.submissionType === 'editor',

        description: 'HTML manuscript content created by the editor.',

        components: {
          Field: '@/components/admin/JoditField',
        },
      },

      validate: (value: unknown, { siblingData }: { siblingData: SubmissionSiblingData }) => {
        if (
          siblingData?.submissionType === 'editor' &&
          (!value || typeof value !== 'string' || !value.trim())
        ) {
          return 'Please enter the manuscript text.'
        }

        return true
      },
    },
    {
      name: 'supportingImages',
      type: 'array',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'caption',
          type: 'text',
        },
      ],
    },
    {
      name: 'authorMessage',
      type: 'textarea',
    },
    {
      name: 'workflowStatus',
      type: 'select',
      required: true,
      defaultValue: 'submitted',
      options: [
        { label: 'Submitted', value: 'submitted' },
        { label: 'Under Review', value: 'under_review' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Revision Requested', value: 'revision_requested' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Published', value: 'published' },
      ],
      access: {
        create: ({ req }) => hasRole(req.user, 'editor'),
        update: ({ req }) => hasRole(req.user, 'editor'),
      },
    },
    {
      // The author's emailed revision link. Never exposed through the API.
      name: 'revisionAccess',
      type: 'group',
      access: {
        read: () => false,
        create: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
      },
      fields: [
        {
          name: 'tokenHash',
          type: 'text',
          index: true,
        },
        {
          name: 'expiresAt',
          type: 'date',
        },
      ],
    },
    {
      name: 'trashed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'trashedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'trashedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
