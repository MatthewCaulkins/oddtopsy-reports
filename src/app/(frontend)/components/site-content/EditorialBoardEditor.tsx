'use client'

import { useRef, useState } from 'react'

import { MediaLibraryPicker, type EditorMediaItem } from '@/components/editor/MediaLibraryPicker'

import type { SiteContent } from '@/payload-types'

type BoardMember = NonNullable<SiteContent['editorialBoard']>[number]

type Props = {
  initialMembers?: SiteContent['editorialBoard']
}

type EditablePhoto = {
  id: number | string
  url?: string | null
  alt?: string | null
  filename?: string | null
}

type EditableBoardMember = Omit<BoardMember, 'photo'> & {
  clientId: string
  photo: number | EditablePhoto | null
}

function getPhotoId(member?: BoardMember): string {
  if (!member?.photo) return ''

  return String(typeof member.photo === 'object' ? member.photo.id : member.photo)
}

export function EditorialBoardEditor({ initialMembers = [] }: Props) {
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const [photoMemberId, setPhotoMemberId] = useState<string | null>(null)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  async function uploadPhoto(file: File) {
    if (!photoMemberId) return

    setUploadingPhoto(true)
    setPhotoError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/editor-media-upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok || !data.success || !data.files?.length) {
        throw new Error(data.message || 'Photo upload failed.')
      }

      const uploaded = data.files[0]
      console.log('uploaded media response', data.files[0])

      const media: EditorMediaItem = {
        id: uploaded.id,
        url: uploaded.url,
        filename: uploaded.filename || '',
        alt: uploaded.alt || uploaded.filename || '',
      }

      if (!media.id || !media.url) {
        throw new Error('The photo uploaded, but its media information was incomplete.')
      }

      updateMemberPhoto(photoMemberId, media)
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Photo upload failed.')
    } finally {
      setUploadingPhoto(false)

      if (uploadInputRef.current) {
        uploadInputRef.current.value = ''
      }
    }
  }

  function getPhoto(member: EditableBoardMember): EditablePhoto | null {
    return typeof member.photo === 'object' && member.photo ? member.photo : null
  }

  function updateMemberPhoto(clientId: string, media: EditorMediaItem | null) {
    setMembers((current) =>
      current.map((member) =>
        member.clientId === clientId
          ? {
              ...member,
              photo: media
                ? {
                    id: media.id,
                    url: media.url,
                    alt: media.alt || '',
                    filename: media.filename || '',
                  }
                : null,
            }
          : member,
      ),
    )
  }

  const [members, setMembers] = useState<EditableBoardMember[]>(() =>
    (initialMembers || []).map((member) => ({
      ...member,
      photo: member.photo ?? null,
      clientId: member.id ? String(member.id) : crypto.randomUUID(),
    })),
  )

  const [draggedId, setDraggedId] = useState<string | null>(null)

  function updateMember(
    clientId: string,
    field: 'name' | 'title' | 'affiliation' | 'biography',
    value: string,
  ) {
    setMembers((current) =>
      current.map((member) =>
        member.clientId === clientId
          ? {
              ...member,
              [field]: value,
            }
          : member,
      ),
    )
  }

  function addMember() {
    setMembers((current) => [
      ...current,
      {
        clientId: crypto.randomUUID(),
        photo: null,
        name: '',
        title: '',
        affiliation: '',
        biography: '',
      },
    ])
  }

  function removeMember(clientId: string) {
    setMembers((current) => current.filter((member) => member.clientId !== clientId))
  }

  function moveMember(draggedClientId: string, targetClientId: string) {
    if (draggedClientId === targetClientId) return

    setMembers((current) => {
      const from = current.findIndex((member) => member.clientId === draggedClientId)

      const to = current.findIndex((member) => member.clientId === targetClientId)

      if (from === -1 || to === -1) return current

      const next = [...current]
      const [moved] = next.splice(from, 1)

      next.splice(to, 0, moved)

      return next
    })
  }

  return (
    <section className="form-section editorial-board-editor">
      <div className="section-heading-rule">
        <h2>Editorial Board</h2>
      </div>

      <p className="editorial-board-editor-help">
        Add and edit editorial board members. Drag a card to change the order in which members
        appear on the About page.
      </p>

      <input
        ref={uploadInputRef}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={async (event) => {
          const file = event.target.files?.[0]

          if (!file) return

          await uploadPhoto(file)
        }}
      />

      <input
        type="hidden"
        name="editorialBoard"
        value={JSON.stringify(
          members.map((member) => ({
            ...(member.id ? { id: member.id } : {}),
            photo: typeof member.photo === 'object' ? member.photo?.id : member.photo || null,
            name: member.name,
            title: member.title || '',
            affiliation: member.affiliation || '',
            biography: member.biography || '',
          })),
        )}
      />

      {members.length === 0 && (
        <div className="editorial-board-editor-empty">
          <strong>No editorial board members yet.</strong>
          <p>Add the first member to begin building the board.</p>
        </div>
      )}

      <div className="editorial-board-editor-list">
        {members.map((member, index) => {
          const photo = getPhoto(member)

          return (
            <article
              key={member.clientId}
              className={`editorial-board-editor-card ${
                draggedId === member.clientId ? 'is-dragging' : ''
              }`}
              draggable
              onDragStart={(event) => {
                setDraggedId(member.clientId)
                event.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                event.preventDefault()

                if (!draggedId) return

                moveMember(draggedId, member.clientId)
                setDraggedId(null)
              }}
            >
              <div className="editorial-board-drag-handle" title="Drag to reorder">
                <span aria-hidden="true">⋮⋮</span>
              </div>

              <div className="editorial-board-editor-image">
                <div className="editorial-board-editor-image-preview">
                  {photo?.url ? (
                    <img src={photo.url} alt={photo.alt || member.name || ''} />
                  ) : (
                    <div className="editorial-board-editor-image-placeholder">
                      <span>Photo</span>
                    </div>
                  )}
                </div>

                <div className="editorial-board-photo-actions">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={uploadingPhoto}
                    onClick={() => {
                      setPhotoMemberId(member.clientId)
                      setPhotoError(null)
                      uploadInputRef.current?.click()
                    }}
                  >
                    {uploadingPhoto && photoMemberId === member.clientId
                      ? 'Uploading…'
                      : photo
                        ? 'Replace Photo'
                        : 'Upload Photo'}
                  </button>

                  {photoError && photoMemberId === member.clientId && (
                    <p className="field-error editorial-board-photo-error">{photoError}</p>
                  )}

                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => {
                      setPhotoMemberId(member.clientId)
                      setPhotoError(null)
                      setMediaOpen(true)
                    }}
                  >
                    Media Library
                  </button>

                  {photo && (
                    <button
                      type="button"
                      className="button danger"
                      onClick={() => updateMemberPhoto(member.clientId, null)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="editorial-board-editor-fields">
                <div className="form-row">
                  <label htmlFor={`board-name-${member.clientId}`}>Name</label>

                  <input
                    id={`board-name-${member.clientId}`}
                    value={member.name || ''}
                    onChange={(event) => updateMember(member.clientId, 'name', event.target.value)}
                    required
                  />
                </div>

                <div className="form-row">
                  <label htmlFor={`board-title-${member.clientId}`}>Title</label>

                  <input
                    id={`board-title-${member.clientId}`}
                    value={member.title || ''}
                    onChange={(event) => updateMember(member.clientId, 'title', event.target.value)}
                  />
                </div>

                <div className="form-row">
                  <label htmlFor={`board-affiliation-${member.clientId}`}>Affiliation</label>

                  <input
                    id={`board-affiliation-${member.clientId}`}
                    value={member.affiliation || ''}
                    onChange={(event) =>
                      updateMember(member.clientId, 'affiliation', event.target.value)
                    }
                  />
                </div>

                <div className="form-row">
                  <label htmlFor={`board-biography-${member.clientId}`}>Biography</label>

                  <textarea
                    id={`board-biography-${member.clientId}`}
                    rows={6}
                    value={member.biography || ''}
                    onChange={(event) =>
                      updateMember(member.clientId, 'biography', event.target.value)
                    }
                  />
                </div>

                <div className="editorial-board-editor-actions">
                  <button
                    type="button"
                    className="button danger"
                    onClick={() => removeMember(member.clientId)}
                  >
                    Remove Member
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <button type="button" className="button secondary editorial-board-add" onClick={addMember}>
        + Add Editorial Board Member
      </button>

      <MediaLibraryPicker
        open={mediaOpen}
        onClose={() => {
          setMediaOpen(false)
          setPhotoMemberId(null)
        }}
        onSelect={(media) => {
          if (!photoMemberId) return

          updateMemberPhoto(photoMemberId, media)
          setMediaOpen(false)
          setPhotoMemberId(null)
        }}
      />
    </section>
  )
}
