import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Header } from '../../components/Header'
import { Footer } from '../../components/Footer'
import { Breadcrumbs } from '../../components/Breadcrumbs'

type Props = {
  params: Promise<{
    slug: string
  }>
}

function getImageUrl(paper: any) {
  if (typeof paper.featuredImage !== 'object' || !paper.featuredImage) return null

  return paper.featuredImage.sizes?.hero?.url || paper.featuredImage.url || null
}

export default async function SinglePaperPage({ params }: Props) {
  const { slug } = await params
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'submissions',
    where: {
      and: [
        { status: { equals: 'published' } },
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

  const imageUrl = getImageUrl(paper)

  const pdf =
    typeof paper.manuscriptPDF === 'object' && paper.manuscriptPDF?.url
      ? paper.manuscriptPDF.url
      : null

  return (
    <main className="site">
      <Header />
      <Breadcrumbs items={[{ label: 'Papers', href: '/articles' }, { label: paper.title }]} />

      <article className="single-paper">
        <section className="single-paper-hero">
          <div>
            <h1>{paper.title}</h1>
            {paper.subtitle && <p className="single-paper-subtitle">{paper.subtitle}</p>}

            {paper.leadAuthor?.name && (
              <p className="single-paper-authors">
                {[paper.leadAuthor.name, ...(paper.coAuthors?.map((a) => a.name) || [])]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
          </div>

          {imageUrl && <img src={imageUrl} alt="" />}
        </section>

        {paper.abstract && (
          <section className="single-paper-section">
            <div className="section-heading-rule">
              <h2>Abstract</h2>
            </div>
            <p>{paper.abstract}</p>
          </section>
        )}

        {pdf && (
          <section className="single-paper-section">
            <div className="section-heading-rule">
              <h2>Paper</h2>
            </div>
            <iframe className="pdf-frame" src={pdf} title={paper.title} />
          </section>
        )}
      </article>

      <Footer />
    </main>
  )
}
