// src/globals/About.ts

import type { GlobalConfig } from 'payload'
import {
  lexicalEditor,
  FixedToolbarFeature,
  HeadingFeature,
  LinkFeature,
} from '@payloadcms/richtext-lexical'

import { richTextEditor } from '@/editor/richTextEditor'

export const About: GlobalConfig = {
  slug: 'about',

  access: {
    read: () => true,
    update: ({ req }) => Boolean(req.user),
  },

  fields: [
    {
      name: 'title',
      type: 'text',
      defaultValue: 'About Oddtopsy Reports',
      required: true,
    },
    {
      name: 'intro',
      type: 'textarea',
    },
    {
      name: 'whyWeExist',
      type: 'richText',
      editor: richTextEditor,
    },
  ],
}
