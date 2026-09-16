import type { Submission } from '@/payload-types'
import {
  formatVersionDate,
  getVersionChanges,
  type VersionDoc,
} from './version-history/versionUtils'

type VersionHistoryProps = {
  submissionId: string | number
  versions: VersionDoc[]
  totalVersions: number
  displayLimit?: number
}

export function VersionHistory({
  submissionId,
  versions,
  totalVersions,
  displayLimit = 3,
}: VersionHistoryProps) {
  if (!versions.length) return null

  const visibleVersions = versions.slice(0, displayLimit)

  return (
    <section className="version-history">
      <div className="section-heading-rule">
        <h2>Version History</h2>

        <a href={`/editorial/submissions/${submissionId}/history`}>View all →</a>
      </div>

      <div className="version-list">
        {visibleVersions.map((item, index) => {
          const versionNumber = totalVersions - index
          const previous = versions[index + 1]

          const changes = getVersionChanges(previous?.version, item.version)

          const versionDate = item.updatedAt || item.createdAt

          return (
            <article className="version-card" key={item.id}>
              <a
                className="version-card-title"
                href={`/editorial/submissions/${submissionId}/history?version=${item.id}`}
              >
                Version {versionNumber}
              </a>

              {versionDate && (
                <time className="version-date" dateTime={versionDate}>
                  {formatVersionDate(versionDate)}
                </time>
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
