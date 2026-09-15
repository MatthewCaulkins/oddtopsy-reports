import { headers as getHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Header } from '../../../components/Header'
import { Footer } from '../../../components/Footer'
import { EditorialToolbar } from '../../../components/EditorialToolbar'
import { PaperPreview } from '../../../components/PaperPreview'
import { SubmissionForm } from '../../../components/submission-form/SubmissionForm'
import { updateSubmission } from './actions'
import { VersionHistory } from '../../../components/VersionHistory'
import { approveSubmission } from './actions'
import { EditorialNav } from '@/app/(frontend)/components/EditorialNav'

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
  }>
}

export default async function EditorialSubmissionPage({ params, searchParams }: Props) {
  const { id } = await params
  const { mode: rawMode } = await searchParams
  const mode = rawMode === 'edit' ? 'edit' : 'preview'

  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user) redirect('/login')

  const submission = await payload.findByID({
    collection: 'submissions',
    id,
    depth: 2,
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
    depth: 1,
  })

  const focusAreas = await payload.find({
    collection: 'focus-areas',
    limit: 100,
    sort: 'name',
  })

  return (
    <main className="site">
      <Header />

      <EditorialNav user={user} active="papers" />

      <div id="editorial-top">
        <EditorialToolbar
          mode={mode}
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
          canDeletePermanently={user.role === 'manager' || user.role === 'admin'}
        />
      </div>

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
