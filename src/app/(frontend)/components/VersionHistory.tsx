import type { Submission } from '@/payload-types'

type VersionDoc = {
  id: string | number
  updatedAt?: string
  createdAt?: string
  version?: Partial<Submission>
}

type VersionHistoryProps = {
  versions: VersionDoc[]
}

export function VersionHistory({ versions }: VersionHistoryProps) {
  if (!versions.length) return null

  return (
    <section className="version-history">
      <div className="section-heading-rule">
        <h2>Version History</h2>
      </div>

      <div className="version-list">
        {versions.map((item, index) => {
          const date = item.updatedAt || item.createdAt

          return (
            <article className="version-card" key={item.id}>
              <strong>Version {versions.length - index}</strong>

              {date && (
                <span>
                  {new Date(date).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              )}

              {item.version?.title && <p>{item.version.title}</p>}
            </article>
          )
        })}
      </div>
    </section>
  )
}
