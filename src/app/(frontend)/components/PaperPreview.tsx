import type { Media, Submission } from '@/payload-types'

type PaperPreviewProps = {
  paper: Submission
  editorial?: boolean
}

function getMediaUrl(media: number | Media | null | undefined, size?: 'hero' | 'card' | 'square') {
  if (!media || typeof media !== 'object') return null

  if (size && media.sizes?.[size]?.url) {
    return media.sizes[size]?.url || null
  }

  return media.url || null
}

function getAuthors(paper: Submission) {
  const lead = paper.leadAuthor?.name
  const coAuthors = paper.coAuthors?.map((author) => author.name).filter(Boolean) || []

  return [lead, ...coAuthors].filter(Boolean).join(', ')
}

function getFocusAreas(paper: Submission) {
  if (!Array.isArray(paper.focusArea)) return []

  return paper.focusArea
    .filter((area) => typeof area === 'object' && area !== null)
    .map((area) => area.name)
    .filter(Boolean)
}

function getKeywords(paper: Submission) {
  return paper.keywords?.map((item) => item.keyword).filter(Boolean) || []
}

export function PaperPreview({ paper, editorial = false }: PaperPreviewProps) {
  const heroImageUrl = getMediaUrl(paper.featuredImage, 'hero')
  const pdfUrl = getMediaUrl(paper.manuscriptPDF)
  const focusAreas = getFocusAreas(paper)
  const keywords = getKeywords(paper)
  const authors = getAuthors(paper)

  const manuscriptBody = typeof paper.manuscriptBody === 'string' ? paper.manuscriptBody : ''

  const hasEditorManuscript = paper.submissionType === 'editor' && manuscriptBody.trim().length > 0

  return (
    <article
      className={['paper-preview', editorial && 'paper-preview-editorial']
        .filter(Boolean)
        .join(' ')}
    >
      <section className="paper-preview-hero">
        <div className="paper-preview-heading">
          <h1>{paper.title}</h1>

          {paper.subtitle && <p className="paper-preview-subtitle">{paper.subtitle}</p>}

          {authors && <p className="paper-preview-authors">{authors}</p>}

          {focusAreas.length > 0 && (
            <div className="paper-focus-list">
              {focusAreas.map((area) => (
                <span className="paper-focus-pill" key={area}>
                  {area}
                </span>
              ))}
            </div>
          )}
        </div>

        {heroImageUrl && (
          <div
            className="paper-preview-image"
            style={{
              backgroundImage: `url(${heroImageUrl})`,
            }}
          />
        )}
      </section>

      {paper.abstract && (
        <section className="paper-preview-section">
          <div className="section-heading-rule">
            <h2>Abstract</h2>
          </div>

          <p>{paper.abstract}</p>
        </section>
      )}

      {keywords.length > 0 && (
        <section className="paper-preview-section">
          <div className="paper-keywords">
            {keywords.map((keyword) => (
              <span key={keyword}>{keyword}</span>
            ))}
          </div>
        </section>
      )}

      {paper.submissionType === 'upload' && pdfUrl && (
        <section className="paper-preview-section">
          <div className="section-heading-rule">
            <h2>Paper</h2>
          </div>

          <iframe className="pdf-frame" src={pdfUrl} title={paper.title} />
        </section>
      )}

      {hasEditorManuscript && (
        <section className="paper-preview-section">
          <div className="section-heading-rule">
            <h2>Paper</h2>
          </div>

          <div
            className="rich-output manuscript-content"
            dangerouslySetInnerHTML={{
              __html: manuscriptBody,
            }}
          />
        </section>
      )}

      {paper.supportingImages && paper.supportingImages.length > 0 && (
        <section className="paper-preview-section">
          <div className="section-heading-rule">
            <h2>Supporting Images</h2>
          </div>

          <div className="supporting-image-grid">
            {paper.supportingImages.map((item, index) => {
              const imageUrl = getMediaUrl(item.image, 'card')

              if (!imageUrl) return null

              return (
                <figure key={index}>
                  <img src={imageUrl} alt={item.caption || ''} />

                  {item.caption && <figcaption>{item.caption}</figcaption>}
                </figure>
              )
            })}
          </div>
        </section>
      )}
    </article>
  )
}
