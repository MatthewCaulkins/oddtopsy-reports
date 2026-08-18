import { getPayload } from 'payload'

import config from '@/payload.config'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'

import { RichText } from '@payloadcms/richtext-lexical/react'

export default async function AboutPage() {
  const payload = await getPayload({ config })

  const about = await payload.findGlobal({
    slug: 'about',
  })

  const editors = await payload.find({
    collection: 'users',
    where: {
      'profile.displayOnAboutPage': {
        equals: true,
      },
    },
    sort: 'profile.displayOrder',
    depth: 1,
  })

  return (
    <main className="site">
      <Header />

      <section className="page-hero">
        <h1>About Oddtopsy Reports</h1>
        <p>
          Oddtopsy Reports is a low-barrier publication home for unusual anatomical findings,
          cadaveric studies, and educational case reports that deserve to be shared more widely.
        </p>
      </section>

      <section className="section">
        <RichText data={about.whyWeExist} />
      </section>

      <section className="section">
        <div className="section-heading section-heading-rule">
          <h2>Editorial Board</h2>
        </div>

        {editors.docs.length > 0 ? (
          <div className="editor-grid">
            {editors.docs.map((editor) => {
              const profile = editor.profile
              const photo =
                typeof profile?.photo === 'object' && profile.photo?.url ? profile.photo.url : null

              return (
                <article className="editor-profile-card" key={editor.id}>
                  {photo && <img src={photo} alt={profile?.displayName || editor.email} />}

                  <div>
                    <h3>{profile?.displayName || editor.email}</h3>
                    {profile?.title && <p className="editor-title">{profile.title}</p>}
                    {profile?.affiliation && <p>{profile.affiliation}</p>}
                    {profile?.biography && <p>{profile.biography}</p>}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <h3>Editorial board coming soon.</h3>
            <p>Editors marked for public display will appear here.</p>
          </div>
        )}
      </section>

      <Footer />
    </main>
  )
}
