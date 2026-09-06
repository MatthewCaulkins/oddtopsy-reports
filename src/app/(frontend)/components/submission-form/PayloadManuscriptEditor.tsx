'use client'

import { useState } from 'react'

import { OddtopsyEditor } from '@/components/editor/OddtopsyEditor'

type Props = {
  name?: string
  initialHTML?: string
  placeholder?: string
  allowMediaLibrary?: boolean
}

export function PayloadManuscriptEditor({
  name = 'manuscriptBody',
  initialHTML = '',
  placeholder = 'Write or paste the manuscript…',
  allowMediaLibrary = false,
}: Props) {
  const [content, setContent] = useState(initialHTML)

  return (
    <>
      <OddtopsyEditor
        value={content}
        onChange={setContent}
        placeholder={placeholder}
        allowMediaLibrary={allowMediaLibrary}
      />

      <input type="hidden" name={name} value={content} />
    </>
  )
}
