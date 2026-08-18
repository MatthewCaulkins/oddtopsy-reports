import { Jodit } from 'jodit'

type JoditConfigOptions = {
  placeholder?: string
  height?: number
  minHeight?: number
  onUploadImage?: (editor: any) => void
  onInsertImageURL?: (editor: any) => void
  onOpenMediaLibrary?: (editor: any) => void
  allowMediaLibrary?: boolean
}

Jodit.modules.Icon.set(
  'oddtopsyImageURL',
  `
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 5h8v2H7v10h10v-6h2v8H5V5Zm9.5 0h4A2.5 2.5 0 0 1 21 7.5v1a2.5 2.5 0 0 1-2.5 2.5H16V9h2.5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-4V5ZM10 13l2-2 4 4H8l2-2Z"
      />
    </svg>
  `,
)

Jodit.modules.Icon.set(
  'oddtopsyMediaLibrary',
  `
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      fill="currentColor"
      d="M3 5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm2 2v10h14V7H5Zm2 8 3-4 2 2 2-3 3 5H7Z"
    />
  </svg>
  `,
)

export function getJoditConfig({
  placeholder = 'Write or paste content…',
  height = 620,
  minHeight = 420,
  onUploadImage,
  onInsertImageURL,
  onOpenMediaLibrary,
  allowMediaLibrary = true,
}: JoditConfigOptions = {}) {
  const mediaButtons: any[] = [
    {
      name: 'oddtopsyUploadImage',
      tooltip: 'Upload Image',
      icon: 'image',
      exec: (editor: any) => {
        onUploadImage?.(editor)
      },
    },
    {
      name: 'oddtopsyImageURL',
      tooltip: 'Insert Image from URL',
      icon: 'oddtopsyImageURL',
      exec: (editor: any) => {
        onInsertImageURL?.(editor)
      },
    },
  ]

  if (allowMediaLibrary) {
    mediaButtons.push({
      name: 'oddtopsyMediaLibrary',
      tooltip: 'Media Library',
      icon: 'oddtopsyMediaLibrary',
      exec: (editor: any) => {
        onOpenMediaLibrary?.(editor)
      },
    })
  }

  return {
    readonly: false,
    height,
    minHeight,
    toolbarAdaptive: false,

    buttons: [
      'source',
      '|',
      'undo',
      'redo',
      '|',
      'paragraph',
      'font',
      'fontsize',
      'brush',
      '|',
      'bold',
      'italic',
      'underline',
      'strikethrough',
      '|',
      'ul',
      'ol',
      'outdent',
      'indent',
      '|',
      'left',
      'center',
      'right',
      'justify',
      '|',
      'link',
      '|',
      ...mediaButtons,
      '|',
      'table',
      'hr',
      '|',
      'eraser',
      'fullsize',
    ],

    placeholder,

    image: {
      openOnDblClick: true,
    },

    resizer: {
      showSize: true,
    },

    iframe: true,

    iframeStyle: `
      html,
      body {
        background: #fff;
        color: #172026;
      }

      body {
        padding: 16px 20px;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 1.6;
      }

      p {
        margin: 0 0 1em;
      }

      h1,
      h2,
      h3,
      h4,
      h5,
      h6 {
        color: #172026;
      }

      a {
        color: #285f73;
      }

      img {
        max-width: 100%;
        height: auto;
      }
    `,
  }
}
