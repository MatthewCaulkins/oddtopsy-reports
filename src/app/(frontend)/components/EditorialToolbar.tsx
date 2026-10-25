'use client'

import { useFormStatus } from 'react-dom'

import {
  decisionStatuses,
  unpublishStatuses,
  workflowStatusLabels,
  type WorkflowStatus,
} from '@/lib/workflow'

type EditorialToolbarProps = {
  mode: 'preview' | 'edit'

  status?: WorkflowStatus
  submissionId?: string | number
  authorEmail?: string

  revisionAction?: (formData: FormData) => void | Promise<void>
  decisionAction?: (formData: FormData) => void | Promise<void>
  unpublishAction?: (formData: FormData) => void | Promise<void>

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

function RevisionButton() {
  const { pending } = useFormStatus()

  return (
    <button className="button primary" type="submit" disabled={pending}>
      {pending ? 'Sending…' : 'Send to Author'}
    </button>
  )
}

function DecisionButton() {
  const { pending } = useFormStatus()

  return (
    <button className="button primary" type="submit" disabled={pending}>
      {pending ? 'Sending…' : 'Record & Notify Author'}
    </button>
  )
}

function UnpublishButton() {
  const { pending } = useFormStatus()

  return (
    <button className="button secondary" type="submit" disabled={pending}>
      {pending ? 'Unpublishing…' : 'Unpublish'}
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

  status,
  submissionId,
  authorEmail,

  revisionAction,
  decisionAction,
  unpublishAction,

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

  const hasSubmissionID = submissionId !== undefined && submissionId !== null

  // A decision can't repeat the current status, and published papers are unpublished first.
  const decisionOptions = decisionStatuses.filter((option) => option !== status)
  const canDecide = Boolean(decisionAction) && hasSubmissionID && status !== 'published'

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

        {status && <span className="editorial-status">{workflowStatusLabels[status]}</span>}
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

            {revisionAction && hasSubmissionID && (
              <details className="editorial-toolbar-panel">
                <summary className="button secondary">Request Revisions</summary>

                <form action={revisionAction} className="editorial-toolbar-panel-body">
                  <input type="hidden" name="id" value={submissionId} />

                  <label>
                    Message to {authorEmail || 'the corresponding author'}
                    <textarea name="message" rows={6} required />
                  </label>

                  <p className="editorial-toolbar-hint">
                    The author receives this message and a private link to revise their submission.
                    {status === 'published' && ' This takes the paper offline.'}
                  </p>

                  <RevisionButton />
                </form>
              </details>
            )}

            {canDecide && (
              <details className="editorial-toolbar-panel">
                <summary className="button secondary">Record Decision</summary>

                <form action={decisionAction} className="editorial-toolbar-panel-body">
                  <input type="hidden" name="id" value={submissionId} />

                  <fieldset className="editorial-toolbar-decision">
                    <legend>Decision</legend>

                    {decisionOptions.map((option, index) => (
                      <label key={option}>
                        <input
                          type="radio"
                          name="decision"
                          value={option}
                          defaultChecked={index === 0}
                          required
                        />
                        {option === 'accepted' ? 'Accept' : 'Reject'}
                      </label>
                    ))}
                  </fieldset>

                  <label>
                    Message to {authorEmail || 'the corresponding author'}
                    <textarea name="message" rows={6} />
                  </label>

                  <p className="editorial-toolbar-hint">
                    The author is emailed the decision with this message. A message is required when
                    rejecting. Accepted papers are published separately with Approve &amp; Publish.
                  </p>

                  <DecisionButton />
                </form>
              </details>
            )}

            {status === 'published' && unpublishAction && hasSubmissionID && (
              <form action={unpublishAction} className="editorial-toolbar-unpublish">
                <input type="hidden" name="id" value={submissionId} />

                <div className="select-wrap">
                  <select
                    name="status"
                    defaultValue="in_progress"
                    aria-label="Status after unpublishing"
                  >
                    {unpublishStatuses.map((option) => (
                      <option key={option} value={option}>
                        {workflowStatusLabels[option]}
                      </option>
                    ))}
                  </select>
                </div>

                <UnpublishButton />
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
