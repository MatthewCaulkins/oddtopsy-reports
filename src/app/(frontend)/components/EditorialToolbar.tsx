'use client'

import { useFormStatus } from 'react-dom'

type EditorialToolbarProps = {
  mode: 'preview' | 'edit'
  previewHref: string
  editHref: string
  publishedHref: string
  publishAction?: (formData: FormData) => void | Promise<void>
  publishId?: string | number
}

function PublishButton() {
  const { pending } = useFormStatus()

  return (
    <button className="button primary" type="submit" disabled={pending}>
      {pending ? 'Publishing…' : 'Approve & Publish'}
    </button>
  )
}

export function EditorialToolbar({
  mode,
  previewHref,
  editHref,
  publishedHref,
  publishAction,
  publishId,
}: EditorialToolbarProps) {
  const canPublish = Boolean(publishAction) && publishId !== undefined && publishId !== null

  return (
    <section className="editorial-toolbar">
      <div className="editorial-toolbar-tabs">
        <a
          className={`button secondary ${mode === 'preview' ? 'is-active' : ''}`}
          href={previewHref}
        >
          Preview
        </a>

        <a className={`button secondary ${mode === 'edit' ? 'is-active' : ''}`} href={editHref}>
          Edit
        </a>
      </div>

      {canPublish ? (
        <form action={publishAction}>
          <input type="hidden" name="id" value={publishId} />

          <PublishButton />
        </form>
      ) : (
        <a href={publishedHref} className="button secondary">
          View Published
        </a>
      )}
    </section>
  )
}
