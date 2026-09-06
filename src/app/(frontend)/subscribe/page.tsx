import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { Header } from '../components/Header'
import { Footer } from '../components/Footer'

import { getSiteContent } from '@/lib/getSiteContent'
import { EditPageButton } from '../components/site-content/EditPageButton'

export default async function SubscribePage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({
    headers,
  })

  const pageContent = await getSiteContent('subscribe')

  return (
    <main className="site">
      <Header />

      {user && <EditPageButton page="subscribe" />}

      <section className="page-hero">
        <h1>{pageContent?.heroTitle || 'Subscribe to Oddtopsy Reports'}</h1>

        {pageContent?.heroBody && <p>{pageContent.heroBody}</p>}
      </section>

      <section className="section subscribe-layout">
        <div className="content-panel">
          {pageContent?.content ? (
            <div
              className="rich-output site-content-output"
              dangerouslySetInnerHTML={{
                __html: pageContent.content,
              }}
            />
          ) : (
            <>
              <h2>Stay connected</h2>
              <p>Subscriptions are not active yet.</p>
            </>
          )}

          <form className="submit-form">
            <label>
              Email address
              <input type="email" name="email" placeholder="you@example.com" />
            </label>

            <button className="button primary" type="button">
              Notify Me
            </button>
          </form>
        </div>

        <aside className="content-panel">
          {pageContent?.secondaryTitle && <h2>{pageContent.secondaryTitle}</h2>}

          {pageContent?.secondaryContent && (
            <div
              className="rich-output site-content-output"
              dangerouslySetInnerHTML={{
                __html: pageContent.secondaryContent,
              }}
            />
          )}
        </aside>
      </section>

      <Footer />
    </main>
  )
}
