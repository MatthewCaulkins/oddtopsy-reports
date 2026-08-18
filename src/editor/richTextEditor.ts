import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  LinkFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

export const richTextEditor = lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures,

    FixedToolbarFeature(),
    InlineToolbarFeature(),

    HeadingFeature({
      enabledHeadingSizes: ['h2', 'h3', 'h4'],
    }),

    LinkFeature(),
  ],
})
