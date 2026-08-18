'use client'

import { useState } from 'react'

import { OddtopsyEditor } from '@/components/editor/OddtopsyEditor'

type Props = {
  initialHTML?: string
  allowMediaLibrary?: boolean
}

export function PayloadManuscriptEditor({ initialHTML = '', allowMediaLibrary = false }: Props) {
  const [content, setContent] = useState(initialHTML)

  return (
    <>
      <OddtopsyEditor
        value={content}
        onChange={setContent}
        placeholder="Write or paste the manuscript…"
        allowMediaLibrary={allowMediaLibrary}
      />

      <input type="hidden" name="manuscriptBody" value={content} />
    </>
  )
}
