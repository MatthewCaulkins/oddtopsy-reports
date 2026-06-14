import { headers as getHeaders } from 'next/headers'
import Image from 'next/image'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import './styles.css'

export default async function HomePage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  const editorialQueue = user
    ? await payload.find({
        collection: 'submissions',
        where: {
          status: {
            not_equals: 'published',
          },
        },
        limit: 3,
        sort: '-createdAt',
        depth: 1,
      })
    : null

  const publishedPapers = await payload.find({
    collection: 'submissions',
    where: {
      status: {
        equals: 'published',
      },
    },
    limit: 3,
    sort: '-publishedDate',
    depth: 1,
  })

  return (
    <main className="site">
      <Header />

      <section className="hero">
        <div className="hero-wrapper">
          <div className="hero-image">
            <img src="/branding/hero.png" alt="Oddtopsy Reports" width={500} height={500} />
          </div>
          <div className="hero-copy">
            <div className="hero-brand">
              <h1>Oddtopsy</h1>

              <div className="hero-report-label">REPORTS</div>

              <p className="hero-tagline">Cadaveric Studies & Anatomical Variations</p>
            </div>

            <div className="hero-actions">
              <a href="/submit" className="button primary">
                Submit Paper
              </a>

              <a href="/subscribe" className="button secondary">
                Subscribe
              </a>
            </div>
          </div>
        </div>
      </section>

      {user && editorialQueue && (
        <section className="section editor-section">
          <div className="section-heading-rule">
            {/* <p className="eyebrow">Editors only</p> */}
            <h2>Editorial Queue Preview</h2>
          </div>

          {editorialQueue.docs.length > 0 ? (
            <div className="card-grid">
              {editorialQueue.docs.map((submission) => (
                <a
                  className="paper-card editor-card"
                  href={`/editorial/submissions/${submission.id}`}
                  key={submission.id}
                >
                  {/* <p className="card-label">{submission.status}</p> */}
                  <h3>{submission.title}</h3>
                  <p>{submission.correspondingAuthor?.name || 'Corresponding author pending'}</p>
                </a>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>No submissions waiting for review.</h3>
              <p>New submissions will appear here for logged-in editors.</p>
            </div>
          )}
        </section>
      )}

      <section className="section">
        <div className="section-heading-rule">
          {/* <p className="eyebrow">Archive</p> */}
          <h2>Published Papers</h2>
        </div>

        {publishedPapers.docs.length > 0 ? (
          <div className="card-grid">
            {publishedPapers.docs.map((paper) => (
              <a className="paper-card" href={`/articles/${paper.slug || paper.id}`} key={paper.id}>
                {/* <p className="card-label">
                  {paper.publishedDate
                    ? new Date(paper.publishedDate).toLocaleDateString()
                    : 'Published'}
                </p> */}
                <h3>{paper.title}</h3>
                <p>{paper.abstract || paper.correspondingAuthor?.name}</p>
              </a>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No published papers yet.</h3>
            <p>Accepted papers will appear here once editors publish them.</p>
          </div>
        )}
      </section>
      <Footer />
    </main>
  )
}
