import type { SiteContent } from '@/payload-types'

import { hasRichContent } from '@/lib/hasRichContent'

type Props = {
  content: SiteContent | null | undefined
}

export function SubscribeContent({ content }: Props) {
  return (
    <>
      <section className="page-hero">
        <h1>{content?.heroTitle || 'Subscribe to Oddtopsy Reports'}</h1>

        {hasRichContent(content?.heroBody) && (
          <div
            dangerouslySetInnerHTML={{
              __html: content?.heroBody || '',
            }}
          />
        )}
      </section>

      <section className="section subscribe-layout">
        <div className="content-panel">
          {hasRichContent(content?.content) ? (
            <div
              className="rich-output site-content-output"
              dangerouslySetInnerHTML={{
                __html: content?.content || '',
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
          {content?.secondaryTitle && <h2>{content.secondaryTitle}</h2>}

          {hasRichContent(content?.secondaryContent) && (
            <div
              className="rich-output site-content-output"
              dangerouslySetInnerHTML={{
                __html: content?.secondaryContent || '',
              }}
            />
          )}
        </aside>
      </section>
    </>
  )
}
