import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { headers as getHeaders } from 'next/headers'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { Header } from '../../components/Header'
import { Footer } from '../../components/Footer'
import { PaperPreview } from '../../components/PaperPreview'

import { hasRole } from '@/access/roles'
import { publishedPaperWhere } from '@/access/visibility'
import { siteURL } from '@/lib/notifications'
import { articlePath } from '@/lib/slugs'

type Props = {
  params: Promise<{
    slug: string
  }>
}

/*
 * Public article page. Only published, non-trashed papers resolve, by
 * slug; old numeric links (/articles/3) redirect permanently to the slug.
 * Unpublished papers are never served here, whatever the URL.
 */
async function findPublishedPaper(payload: Payload, slugOrID: string) {
  const byID = /^\d+$/.test(slugOrID)

  const result = await payload.find({
    collection: 'submissions',
    where: {
      and: [publishedPaperWhere, byID ? { id: { equals: Number(slugOrID) } } : { slug: { equals: slugOrID } }],
    },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })

  return { paper: result.docs[0] || null, byID }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const payload = await getPayload({ config })
  const { paper } = await findPublishedPaper(payload, slug)

  if (!paper) return { title: 'Paper not found · Oddtopsy Reports' }

  const url = `${siteURL}${articlePath(paper)}`
  const description = paper.seoDescription || paper.abstract?.slice(0, 200)

  return {
    title: `${paper.seoTitle || paper.title} · Oddtopsy Reports`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: paper.seoTitle || paper.title,
      description,
      siteName: 'Oddtopsy Reports',
    },
  }
}

export default async function SinglePaperPage({ params }: Props) {
  const { slug } = await params
  const payload = await getPayload({ config })

  const { paper, byID } = await findPublishedPaper(payload, slug)

  if (!paper) notFound()

  // Old numeric URL: send browsers and search engines to the canonical slug.
  if (byID && paper.slug) permanentRedirect(articlePath(paper))

  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  return (
    <main className="site">
      <Header />

      <Breadcrumbs items={[{ label: 'Papers', href: '/articles' }, { label: paper.title }]} />

      {hasRole(user, 'editor') && (
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
