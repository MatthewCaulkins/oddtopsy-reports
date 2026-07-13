import { headers as getHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Breadcrumbs } from '@/app/(frontend)/components/Breadcrumbs'
import { Header } from '@/app/(frontend)/components/Header'
import { Footer } from '@/app/(frontend)/components/Footer'
import { VersionHistoryExplorer } from '@/app/(frontend)/components/version-history/VersionHistoryExplorer'
import { restoreSubmissionVersion } from '../actions'

type Props = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    version?: string
  }>
}

export default async function SubmissionHistoryPage({ params, searchParams }: Props) {
  const { id } = await params
  const { version: initialVersionId } = await searchParams

  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user) redirect('/login')

  const submission = await payload.findByID({
    collection: 'submissions',
    id,
    depth: 1,
  })

  if (!submission) notFound()

  const versions = await payload.findVersions({
    collection: 'submissions',
    where: {
      parent: {
        equals: submission.id,
      },
    },
    sort: 'createdAt',
    limit: 25,
    depth: 1,
  })

  return (
    <main className="site">
      <Header />

      <Breadcrumbs
        items={[
          { label: 'Papers', href: '/articles' },
          {
            label: submission.title,
            href: `/editorial/submissions/${submission.id}?mode=edit`,
          },
          { label: 'Version History' },
        ]}
      />

      <section className="page-hero page-editor">
        <VersionHistoryExplorer
          submissionId={submission.id}
          versions={versions.docs}
          initialVersionId={initialVersionId}
        />
      </section>

      <Footer />
    </main>
  )
}
