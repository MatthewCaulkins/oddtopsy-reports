import { notFound } from 'next/navigation'

import { hasRole } from '@/access/roles'
import { requireRole } from '@/lib/requireRole'
import { Header } from '../../../components/Header'
import { Footer } from '../../../components/Footer'
import { EditorialToolbar } from '../../../components/EditorialToolbar'
import { PaperPreview } from '../../../components/PaperPreview'
import { SubmissionForm } from '../../../components/submission-form/SubmissionForm'
import { updateSubmission } from './actions'
import { VersionHistory } from '../../../components/VersionHistory'
import { approveSubmission, recordDecision, requestRevisions, unpublishSubmission } from './actions'
import { EditorialNav } from '@/app/(frontend)/components/EditorialNav'
import { isDecisionStatus, workflowStatusLabels } from '@/lib/workflow'

import {
  moveSubmissionToTrash,
  restoreSubmission,
  deleteSubmissionPermanently,
} from '../../trash/actions'

type Props = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    mode?: string
    revisions?: string
    decision?: string
  }>
}

export default async function EditorialSubmissionPage({ params, searchParams }: Props) {
  const { id } = await params
  const { mode: rawMode, revisions, decision } = await searchParams
  const mode = rawMode === 'edit' ? 'edit' : 'preview'

  const { payload, user } = await requireRole('editor')

  // Read as the user so hidden fields (the revision token) stay on the server.
  const submission = await payload.findByID({
    collection: 'submissions',
    id,
    depth: 2,
    user,
    overrideAccess: false,
  })

  if (!submission) notFound()

  const versions = await payload.findVersions({
    collection: 'submissions',
    where: {
      parent: {
        equals: submission.id,
      },
    },
    sort: '-createdAt',
    limit: 4,
    depth: 2,
  })

  const focusAreas = await payload.find({
    collection: 'focus-areas',
    limit: 100,
    sort: 'name',
  })

  // Everything the author has been told: revision requests and decisions.
  const authorNotes = await payload.find({
    collection: 'editor-notes',
    where: {
      and: [
        { submission: { equals: submission.id } },
        { noteType: { in: ['revision_request', 'decision'] } },
      ],
    },
    sort: '-createdAt',
    limit: 10,
    depth: 1,
  })

  return (
    <main className="site">
      <Header />

      <EditorialNav user={user} active="papers" />

      <div id="editorial-top">
        <EditorialToolbar
          mode={mode}
          status={submission.workflowStatus}
          submissionId={submission.id}
          authorEmail={submission.correspondingAuthor?.email}
          revisionAction={requestRevisions}
          decisionAction={recordDecision}
          unpublishAction={unpublishSubmission}
          previewHref={`/editorial/submissions/${submission.id}?mode=preview`}
          editHref={`/editorial/submissions/${submission.id}?mode=edit`}
          publishedHref={`/articles/${submission.slug}`}
          publishAction={submission.workflowStatus !== 'published' ? approveSubmission : undefined}
          publishId={submission.id}
          isTrashed={Boolean(submission.trashed)}
          trashAction={moveSubmissionToTrash}
          restoreAction={restoreSubmission}
          deleteAction={deleteSubmissionPermanently}
          trashId={submission.id}
          canDeletePermanently={hasRole(user, 'manager')}
        />
      </div>

      {(revisions === 'sent' || isDecisionStatus(decision) || authorNotes.docs.length > 0) && (
        <section className="section editorial-revisions">
          {revisions === 'sent' && (
            <p className="form-success">
              Revision request sent to {submission.correspondingAuthor?.email}.
            </p>
          )}

          {isDecisionStatus(decision) && (
            <p className="form-success">
              Decision recorded ({workflowStatusLabels[decision]}) and sent to{' '}
              {submission.correspondingAuthor?.email}.
            </p>
          )}

          {authorNotes.docs.length > 0 && (
            <details open={submission.workflowStatus === 'revision_requested'}>
              <summary>
                Messages to the author ({authorNotes.docs.length})
                {submission.workflowStatus === 'revision_requested' &&
                  ' · waiting for the author'}
              </summary>

              {authorNotes.docs.map((request) => (
                <article key={request.id} className="editorial-revision-note">
                  <p className="editorial-dashboard-meta">
                    {request.noteType === 'decision' ? 'Decision' : 'Revision request'}
                    {' · '}
                    {new Date(request.createdAt).toLocaleDateString('en-US', {
                      dateStyle: 'medium',
                    })}
                    {' · '}
                    {request.createdBy && typeof request.createdBy === 'object'
                      ? request.createdBy.profile?.displayName || request.createdBy.email
                      : 'a former user'}
                  </p>

                  <p>{request.note}</p>
                </article>
              ))}
            </details>
          )}
        </section>
      )}

      {mode === 'edit' ? (
        <section className="page-hero page-editor">
          <VersionHistory
            submissionId={submission.id}
            versions={versions.docs}
            totalVersions={versions.totalDocs}
            displayLimit={3}
          />

          <SubmissionForm
            mode="edit"
            focusAreas={focusAreas.docs}
            submission={submission}
            action={updateSubmission}
            submitLabel="Save Changes"
            allowMediaLibrary
          />
        </section>
      ) : (
        <PaperPreview paper={submission} editorial />
      )}

      <Footer />
    </main>
  )
}
