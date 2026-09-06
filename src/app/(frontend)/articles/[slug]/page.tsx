import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { Header } from '../../components/Header'
import { Footer } from '../../components/Footer'
import { PaperPreview } from '../../components/PaperPreview'

import { headers as getHeaders } from 'next/headers'

type Props = {
  params: Promise<{
    slug: string
  }>
}

export default async function SinglePaperPage({ params }: Props) {
  const { slug } = await params
  const payload = await getPayload({ config })

  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  const result = await payload.find({
    collection: 'submissions',
    where: {
      and: [
        {
          workflowStatus: {
            equals: 'published',
          },
        },
        {
          or: [{ slug: { equals: slug } }, { id: { equals: Number(slug) || 0 } }],
        },
      ],
    },
    depth: 2,
    limit: 1,
  })

  const paper = result.docs[0]

  if (!paper) notFound()

  return (
    <main className="site">
      <Header />

      <Breadcrumbs items={[{ label: 'Papers', href: '/articles' }, { label: paper.title }]} />

      {user && (
        <div className="paper-editor-actions">
          <a href={`/editorial/submissions/${paper.id}`} className="button secondary">
            Edit Paper
          </a>
        </div>
      )}

      <PaperPreview paper={paper} />

      <Footer />
    </main>
  )
}
