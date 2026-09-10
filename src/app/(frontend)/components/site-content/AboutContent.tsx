import type { SiteContent } from '@/payload-types'

import { hasRichContent } from '@/lib/hasRichContent'

type Props = {
  content: SiteContent | null | undefined
}

export function AboutContent({ content }: Props) {
  return (
    <>
      <section className="page-hero">
        <h1>{content?.heroTitle || 'About Oddtopsy Reports'}</h1>

        {hasRichContent(content?.heroBody) && (
          <div
            dangerouslySetInnerHTML={{
              __html: content?.heroBody || '',
            }}
          />
        )}
      </section>

      {hasRichContent(content?.content) && (
        <section className="section">
          <div
            className="rich-output site-content-output"
            dangerouslySetInnerHTML={{
              __html: content?.content || '',
            }}
          />
        </section>
      )}

      <section className="section">
        <div className="section-heading section-heading-rule">
          <h2>Editorial Board</h2>
        </div>

        {content?.editorialBoard && content.editorialBoard.length > 0 ? (
          <div className="editor-grid">
            {content.editorialBoard.map((member, index) => {
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
    </>
  )
}
