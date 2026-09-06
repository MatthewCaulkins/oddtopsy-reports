import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { Header } from '../components/Header'
import { Footer } from '../components/Footer'

import { getSiteContent } from '@/lib/getSiteContent'
import { EditPageButton } from '../components/site-content/EditPageButton'

export default async function AboutPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({
    headers,
  })

  const about = await getSiteContent('about')

  return (
    <main className="site">
      <Header />

      {user && <EditPageButton page="about" />}

      <section className="page-hero">
        <h1>{about?.heroTitle || 'About Oddtopsy Reports'}</h1>

        {about?.heroBody && <p>{about.heroBody}</p>}
      </section>

      {about?.content && (
        <section className="section">
          <div
            className="rich-output site-content-output"
            dangerouslySetInnerHTML={{
              __html: about.content,
            }}
          />
        </section>
      )}

      <section className="section">
        <div className="section-heading section-heading-rule">
          <h2>Editorial Board</h2>
        </div>

        {about?.editorialBoard && about.editorialBoard.length > 0 ? (
          <div className="editor-grid">
            {about.editorialBoard.map((member, index) => {
              const person = typeof member.person === 'object' ? member.person : null

              const profile = person?.profile

              const displayName =
                member.displayName ||
                profile?.displayName ||
                person?.email ||
                'Editorial Board Member'

              const title = member.title || profile?.title

              const affiliation = member.affiliation || profile?.affiliation

              const biography = member.biography || profile?.biography

              const photo =
                typeof profile?.photo === 'object' && profile.photo?.url ? profile.photo.url : null

              return (
                <article
                  className="editor-profile-card"
                  key={member.id || `${displayName}-${index}`}
                >
                  {photo && <img src={photo} alt={displayName} />}

                  <div>
                    <h3>{displayName}</h3>

                    {title && <p className="editor-title">{title}</p>}

                    {affiliation && <p>{affiliation}</p>}

                    {biography && <p>{biography}</p>}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <h3>Editorial board coming soon.</h3>
            <p>Editorial board members will appear here.</p>
          </div>
        )}
      </section>

      <Footer />
    </main>
  )
}
