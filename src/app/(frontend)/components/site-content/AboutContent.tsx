import type { SiteContent } from '@/payload-types'

import { hasRichContent } from '@/lib/hasRichContent'
import { EditorialBoardCard } from './EditorialBoardCard'

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

        {content?.editorialBoard?.length ? (
          <div className="editorial-board-grid">
            {content.editorialBoard.map((member) => (
              <EditorialBoardCard
                key={member.id}
                photo={member.photo}
                name={member.name}
                title={member.title}
                affiliation={member.affiliation}
                biography={member.biography}
              />
            ))}
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
