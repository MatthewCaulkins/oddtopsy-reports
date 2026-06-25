import type { Submission } from '@/payload-types'

type PaperCardProps = {
  paper: Submission
  editorial?: boolean
  compact?: boolean
}

function getImageUrl(paper: Submission) {
  if (typeof paper.featuredImage !== 'object' || !paper.featuredImage) return null

  return paper.featuredImage.sizes?.card?.url || paper.featuredImage.url || null
}

function getFocusAreas(paper: Submission) {
  if (!Array.isArray(paper.focusArea)) return []

  return paper.focusArea
    .filter((area) => typeof area === 'object' && area !== null)
    .map((area) => area.name)
    .filter(Boolean)
}

function getAuthors(paper: Submission) {
  const lead = paper.leadAuthor?.name
  const coAuthors = paper.coAuthors?.map((author) => author.name).filter(Boolean) || []

  return [lead, ...coAuthors].filter(Boolean).join(', ')
}

export function PaperCard({ paper, editorial = false, compact = false }: PaperCardProps) {
  const imageUrl = getImageUrl(paper)
  const focusAreas = getFocusAreas(paper)
  const href = editorial
    ? `/editorial/submissions/${paper.id}`
    : `/articles/${paper.slug || paper.id}`

  return (
    <a
        className={`paper-card paper-card-featured ${editorial ? 'editor-card' : ''} ${
            compact ? 'paper-card-compact' : ''
        }`}
        href={href}
    >
      <div className="paper-card-content">
        <h3>{paper.title}</h3>

        {focusAreas.length > 0 && (
          <div className="paper-focus-list">
            {focusAreas.map((area) => (
              <span className="paper-focus-pill" key={area}>
                {area}
              </span>
            ))}
          </div>
        )}

        <p className="paper-authors">{getAuthors(paper) || 'Author pending'}</p>

        {paper.abstract && <p className="paper-excerpt">{paper.abstract}</p>}
      </div>

      {imageUrl && (
        <div className="paper-card-image">
          <img src={imageUrl} alt="" />
        </div>
      )}
    </a>
  )
}
