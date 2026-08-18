'use client'

import { useMemo, useRef, useState } from 'react'
import JoditEditor from 'jodit-react'

import { MediaLibraryPicker, type EditorMediaItem } from './MediaLibraryPicker'

import { getJoditConfig } from '@/lib/joditConfig'

type OddtopsyEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  allowMediaLibrary?: boolean
}

export function OddtopsyEditor({
  value,
  onChange,
  placeholder = 'Write or paste content…',
  allowMediaLibrary = true,
}: OddtopsyEditorProps) {
  const activeEditorRef = useRef<any>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const [imageURL, setImageURL] = useState('')
  const [urlOpen, setUrlOpen] = useState(false)
  const [mediaOpen, setMediaOpen] = useState(false)

  const config = useMemo(
    () =>
      getJoditConfig({
        placeholder,
        allowMediaLibrary,

        onUploadImage: (editor) => {
          activeEditorRef.current = editor
          uploadInputRef.current?.click()
        },
        onInsertImageURL: (editor) => {
          activeEditorRef.current = editor
          setUrlOpen(true)
        },
        onOpenMediaLibrary: (editor) => {
          activeEditorRef.current = editor
          setMediaOpen(true)
        },
      }),
    [placeholder, allowMediaLibrary],
  )

  function escapeHTML(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
  }

  function insertMedia(media: EditorMediaItem | string) {
    const editor = activeEditorRef.current

    if (!editor) return

    const url = typeof media === 'string' ? media : media.url

    if (!url) return

    const alt = typeof media === 'string' ? '' : media.alt || media.filename || ''

    editor.s.focus()

    editor.s.insertHTML(
      `<img
      class="oddtopsy-editor-image"
      src="${escapeHTML(url)}"
      alt="${escapeHTML(alt)}"
      style="max-width:100%;height:auto;"
    />`,
    )
  }

  async function uploadImage(file: File) {
    const formData = new FormData()

    formData.append('file', file)

    const response = await fetch('/api/editor-media-upload', {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()

    if (!response.ok || !data.success || !data.files?.length) {
      throw new Error(data.message || 'Image upload failed.')
    }

    insertMedia(data.files[0])
  }

  return (
    <div className="oddtopsy-editor">
      <input
        ref={uploadInputRef}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={async (event) => {
          const file = event.target.files?.[0]

          if (!file) return

          await uploadImage(file)

          event.target.value = ''
        }}
      />

      <JoditEditor value={value} config={config} onBlur={onChange} onChange={onChange} />

      {urlOpen && (
        <div className="media-picker-backdrop" onMouseDown={() => setUrlOpen(false)}>
          <div
            className="media-picker media-picker--small"
            role="dialog"
            aria-modal="true"
            aria-label="Insert Image from URL"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="media-picker-header">
              <div>
                <h2>Insert Image from URL</h2>
                <p>Enter the direct URL to an image.</p>
              </div>

              <button
                type="button"
                className="media-picker-close"
                onClick={() => setUrlOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="form-row">
              <label htmlFor="editor-image-url">Image URL</label>

              <input
                id="editor-image-url"
                type="url"
                value={imageURL}
                onChange={(event) => setImageURL(event.target.value)}
                placeholder="https://example.com/image.jpg"
                autoFocus
              />
            </div>

            <div className="media-picker-actions">
              <button type="button" className="button secondary" onClick={() => setUrlOpen(false)}>
                Cancel
              </button>

              <button
                type="button"
                className="button primary"
                onClick={() => {
                  const url = imageURL.trim()

                  if (!url) return

                  insertMedia(url)

                  setImageURL('')
                  setUrlOpen(false)
                }}
              >
                Insert Image
              </button>
            </div>
          </div>
        </div>
      )}

      {allowMediaLibrary && (
        <MediaLibraryPicker
          open={mediaOpen}
          onClose={() => setMediaOpen(false)}
          onSelect={insertMedia}
        />
      )}
    </div>
  )
}
