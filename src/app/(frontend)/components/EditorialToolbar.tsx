'use client'

import { useFormStatus } from 'react-dom'

type EditorialToolbarProps = {
  mode: 'preview' | 'edit'

  previewHref: string
  editHref: string

  publishedHref?: string

  publishAction?: (formData: FormData) => void | Promise<void>
  publishId?: string | number

  isTrashed?: boolean

  trashAction?: (formData: FormData) => void | Promise<void>
  restoreAction?: (formData: FormData) => void | Promise<void>
  deleteAction?: (formData: FormData) => void | Promise<void>

  trashId?: string | number

  canDeletePermanently?: boolean
}

function PublishButton() {
  const { pending } = useFormStatus()

  return (
    <button className="button primary" type="submit" disabled={pending}>
      {pending ? 'Publishing…' : 'Approve & Publish'}
    </button>
  )
}

function TrashButton() {
  const { pending } = useFormStatus()

  return (
    <button className="button secondary" type="submit" disabled={pending}>
      {pending ? 'Moving…' : 'Move to Trash'}
    </button>
  )
}

function RestoreButton() {
  const { pending } = useFormStatus()

  return (
    <button className="button primary" type="submit" disabled={pending}>
      {pending ? 'Restoring…' : 'Restore'}
    </button>
  )
}

function DeleteButton() {
  const { pending } = useFormStatus()

  return (
    <button className="button secondary" type="submit" disabled={pending}>
      {pending ? 'Deleting…' : 'Delete Permanently'}
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

  isTrashed = false,

  trashAction,
  restoreAction,
  deleteAction,
  trashId,

  canDeletePermanently = false,
}: EditorialToolbarProps) {
  const canPublish = Boolean(publishAction) && publishId !== undefined && publishId !== null

  const hasTrashID = trashId !== undefined && trashId !== null

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

      <div className="editorial-toolbar-actions">
        {isTrashed ? (
          <>
            {restoreAction && hasTrashID && (
              <form action={restoreAction}>
                <input type="hidden" name="id" value={trashId} />

                <RestoreButton />
              </form>
            )}

            {deleteAction && hasTrashID && canDeletePermanently && (
              <form action={deleteAction}>
                <input type="hidden" name="id" value={trashId} />

                <DeleteButton />
              </form>
            )}
          </>
        ) : (
          <>
            {trashAction && hasTrashID && (
              <form action={trashAction}>
                <input type="hidden" name="id" value={trashId} />

                <TrashButton />
              </form>
            )}

            {canPublish ? (
              <form action={publishAction}>
                <input type="hidden" name="id" value={publishId} />

                <PublishButton />
              </form>
            ) : (
              publishedHref && (
                <a href={publishedHref} className="button secondary">
                  View Published
                </a>
              )
            )}
          </>
        )}
      </div>
    </section>
  )
}
