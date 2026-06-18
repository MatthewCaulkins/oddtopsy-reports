import type { CollectionConfig } from 'payload'

type SubmissionSiblingData = {
  submissionType?: 'upload' | 'editor'
}

export const Submissions: CollectionConfig = {
  slug: 'submissions',

  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'submissionType', 'status', 'createdAt'],
  },

  access: {
    create: () => true,
    read: ({ req }) => {
      if (req.user) return true

      return {
        status: {
          equals: 'published',
        },
      }
    },
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
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
        condition: (_, siblingData) => siblingData?.status === 'published',
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
      type: 'richText',
      admin: {
        condition: (_, siblingData) => siblingData?.submissionType === 'editor',
        description: 'Enter or edit the manuscript directly in the editor.',
      },
      validate: (value: unknown, { siblingData }: { siblingData: SubmissionSiblingData }) => {
        if (siblingData?.submissionType === 'editor' && !value) {
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
      name: 'status',
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
        create: ({ req }) => Boolean(req.user),
        update: ({ req }) => Boolean(req.user),
      },
    },
  ],
}
