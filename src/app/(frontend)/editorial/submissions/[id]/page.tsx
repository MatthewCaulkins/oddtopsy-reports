import { headers as getHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Breadcrumbs } from '@/app/(frontend)/components/Breadcrumbs'
import { Header } from '../../../components/Header'
import { Footer } from '../../../components/Footer'
import { EditorialToolbar } from '../../../components/EditorialToolbar'
import { PaperPreview } from '../../../components/PaperPreview'
import { SubmissionForm } from '../../../components/submission-form/SubmissionForm'
import { updateSubmission } from './actions'
import { VersionHistory } from '../../../components/VersionHistory'

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
    sort: '-updatedAt',
    limit: 10,
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

      <Breadcrumbs items={[{ label: 'Papers', href: '/articles' }, { label: submission.title }]} />

      <EditorialToolbar submission={submission} mode={mode} />

      {mode === 'edit' ? (
        <section className="page-hero page-editor">
          <VersionHistory versions={versions.docs} />

          <SubmissionForm
            mode="edit"
            focusAreas={focusAreas.docs}
            submission={submission}
            action={updateSubmission}
            submitLabel="Save Changes"
          />
        </section>
      ) : (
        <PaperPreview paper={submission} editorial />
      )}

      <Footer />
    </main>
  )
}
