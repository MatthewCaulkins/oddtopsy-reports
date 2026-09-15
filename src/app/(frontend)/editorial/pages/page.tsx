import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { Header } from '@/app/(frontend)/components/Header'
import { Footer } from '@/app/(frontend)/components/Footer'
import { EditorialNav } from '@/app/(frontend)/components/EditorialNav'

export default async function EditorialPagesPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({
    headers,
  })

  if (!user) {
    redirect('/login')
  }

  const canEdit = user.role === 'editor' || user.role === 'manager' || user.role === 'admin'

  if (!canEdit) {
    redirect('/articles')
  }

  const pages = await payload.find({
    collection: 'site-content',
    sort: 'page',
    limit: 20,
    depth: 0,
  })

  return (
    <main className="site">
      <Header />

      <EditorialNav user={user} active="pages" />

      <section className="page-hero page-editor">
        <h1>Pages</h1>
        <p>Edit the public content and presentation of Oddtopsy Reports.</p>
      </section>

      <section className="section editorial-dashboard-section">
        <div className="section-heading section-heading-rule">
          <h2>Site Content</h2>
        </div>

        <div className="editorial-dashboard-list">
          {pages.docs.map((page) => (
            <a key={page.id} href={`/editorial/pages/${page.page}`}>
              <div>
                <strong>{page.heroTitle || page.page}</strong>

                <p>
                  {page.page === 'papers' && 'Papers archive page'}
                  {page.page === 'submit' && 'Submission page'}
                  {page.page === 'about' && 'About page and editorial board'}
                  {page.page === 'subscribe' && 'Subscription page'}
                </p>
              </div>

              <span>Edit →</span>
            </a>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  )
}
