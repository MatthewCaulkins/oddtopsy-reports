import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { Header } from '../../components/Header'
import { Footer } from '../../components/Footer'

type Props = {
  params: Promise<{
    slug: string
  }>
}

export default async function SingleArticlePage({ params }: Props) {
  const { slug } = await params
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'submissions',
    where: {
      and: [
        {
          slug: {
            equals: slug,
          },
        },
        {
          status: {
            equals: 'published',
          },
        },
      ],
    },
    depth: 2,
    limit: 1,
  })

  const paper = result.docs[0]

  if (!paper) notFound()

  const pdf =
    typeof paper.manuscriptPDF === 'object' && paper.manuscriptPDF?.url
      ? paper.manuscriptPDF.url
      : null

  return (
    <main className="site">
      <Header />

      <article className="page-hero">
        {/* <p className="eyebrow">Published paper</p> */}
        <h1>{paper.title}</h1>

        {paper.abstract && <p>{paper.abstract}</p>}

        {paper.correspondingAuthor?.name && (
          <p>Corresponding author: {paper.correspondingAuthor.name}</p>
        )}

        {pdf && (
          <iframe
            src={pdf}
            title={paper.title}
            style={{
              width: '100%',
              height: '80vh',
              border: '1px solid rgba(255,255,255,.1)',
              borderRadius: '24px',
              marginTop: '32px',
            }}
          />
        )}
      </article>
      <Footer />
    </main>
  )
}
