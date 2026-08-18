'use client'

import { useEffect, useMemo, useState } from 'react'

export type EditorMediaItem = {
  id: number | string
  url: string
  thumbnail?: string | null
  filename?: string | null
  alt?: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (media: EditorMediaItem) => void
}

export function MediaLibraryPicker({ open, onClose, onSelect }: Props) {
  const [files, setFiles] = useState<EditorMediaItem[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function loadMedia() {
      setLoading(true)

      try {
        const response = await fetch('/api/editor-media')
        const data = await response.json()

        if (!cancelled && response.ok && data.success) {
          setFiles(data.files || [])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadMedia()

    return () => {
      cancelled = true
    }
  }, [open])

  const filteredFiles = useMemo(() => {
    const search = query.trim().toLowerCase()

    if (!search) return files

    return files.filter((media) => {
      const haystack = [media.filename, media.alt].filter(Boolean).join(' ').toLowerCase()

      return haystack.includes(search)
    })
  }, [files, query])

  if (!open) return null

  return (
    <div className="media-picker-backdrop" onMouseDown={onClose}>
      <div
        className="media-picker"
        role="dialog"
        aria-modal="true"
        aria-label="Media Library"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="media-picker-header">
          <div>
            <h2>Media Library</h2>
            <p>Select an existing image.</p>
          </div>

          <button
            type="button"
            className="media-picker-close"
            onClick={onClose}
            aria-label="Close Media Library"
          >
            ×
          </button>
        </header>

        <input
          className="media-picker-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search images..."
        />

        {loading ? (
          <p>Loading media…</p>
        ) : filteredFiles.length > 0 ? (
          <div className="media-picker-grid">
            {filteredFiles.map((media) => (
              <button
                type="button"
                className="media-picker-item"
                key={media.id}
                onClick={() => {
                  onSelect(media)
                  onClose()
                }}
              >
                <img src={media.thumbnail || media.url} alt={media.alt || ''} />

                <span>{media.filename || 'Image'}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No images found.</h3>
          </div>
        )}
      </div>
    </div>
  )
}
