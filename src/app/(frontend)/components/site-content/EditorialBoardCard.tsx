import type { Media } from '@/payload-types'

type Props = {
  photo?: number | Media | null
  name: string
  title?: string | null
  affiliation?: string | null
  biography?: string | null
}

export function EditorialBoardCard({ photo, name, title, affiliation, biography }: Props) {
  const media = typeof photo === 'object' && photo ? photo : null

  return (
    <article className="editorial-board-card">
      <div className="editorial-board-card-image">
        {media?.url ? (
          <img src={media.url} alt={media.alt || name} />
        ) : (
          <div className="editorial-board-card-placeholder" aria-hidden="true">
            <span>{name.charAt(0)}</span>
          </div>
        )}
      </div>

      <div className="editorial-board-card-content">
        <h3>{name}</h3>

        {title && <p className="editorial-board-card-title">{title}</p>}

        {affiliation && <p className="editorial-board-card-affiliation">{affiliation}</p>}

        {biography && <p className="editorial-board-card-biography">{biography}</p>}
      </div>
    </article>
  )
}
