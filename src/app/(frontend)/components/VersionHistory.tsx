import type { Submission } from '@/payload-types'
import { getVersionChanges, type VersionDoc } from './version-history/versionUtils'

type VersionHistoryProps = {
  submissionId: string | number
  versions: VersionDoc[]
}

export function VersionHistory({ submissionId, versions }: VersionHistoryProps) {
  if (!versions.length) return null

  // Payload returns newest first. Comparison is easier oldest first.
  const chronologicalVersions = [...versions].reverse()

  return (
    <section className="version-history">
      <div className="section-heading-rule">
        <h2>Version History</h2>
      </div>

      <div className="version-list">
        {[...chronologicalVersions].reverse().map((item) => {
          const chronologicalIndex = chronologicalVersions.findIndex(
            (version) => version.id === item.id,
          )

          const versionNumber = chronologicalIndex + 1
          const previous = chronologicalVersions[chronologicalIndex - 1]

          const changes = getVersionChanges(previous?.version, item.version)

          const date = item.updatedAt || item.createdAt

          return (
            <article className="version-card" key={item.id}>
              <a
                className="version-card-title"
                href={`/editorial/submissions/${submissionId}/history?version=${item.id}`}
              >
                Version {versionNumber}
              </a>

              {date && (
                <div className="version-card-date">
                  {new Date(date).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
              )}

              <div className="version-card-summary">
                {previous ? (
                  changes.length > 0 ? (
                    <ul className="version-change-summary">
                      {changes.slice(0, 3).map((change) => (
                        <li key={change.field}>{change.label} changed</li>
                      ))}

                      {changes.length > 3 && <li>+{changes.length - 3} more changes</li>}
                    </ul>
                  ) : (
                    <p>No tracked field changes.</p>
                  )
                ) : (
                  <p>Initial submission created.</p>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
