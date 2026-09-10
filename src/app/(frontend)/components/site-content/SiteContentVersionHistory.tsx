import {
  formatSiteContentVersionDate,
  getSiteContentVersionChanges,
  type SiteContentVersionDoc,
} from './siteContentVersionUtils'

type Props = {
  page: string
  versions: SiteContentVersionDoc[]
  totalVersions: number
  displayLimit?: number
}

export function SiteContentVersionHistory({
  page,
  versions,
  totalVersions,
  displayLimit = 3,
}: Props) {
  if (!versions.length) return null

  const visibleVersions = versions.slice(0, displayLimit)

  return (
    <section className="version-history">
      <div className="section-heading-rule">
        <h2>Version History</h2>
      </div>

      <div className="version-list">
        {visibleVersions.map((item, index) => {
          const versionNumber = totalVersions - index
          const previous = versions[index + 1]

          const changes = getSiteContentVersionChanges(previous?.version, item.version)

          const versionDate = item.updatedAt || item.createdAt

          return (
            <article className="version-card" key={item.id}>
              <a
                className="version-card-title"
                href={`/editorial/pages/${page}/history?version=${item.id}`}
              >
                Version {versionNumber}
              </a>

              {versionDate && (
                <time className="version-date" dateTime={versionDate}>
                  {formatSiteContentVersionDate(versionDate)}
                </time>
              )}

              <div className="version-card-summary">
                {previous ? (
                  changes.length > 0 ? (
                    <ul className="version-change-summary">
                      {changes.slice(0, 3).map((change) => (
                        <li key={String(change.field)}>{change.label} changed</li>
                      ))}

                      {changes.length > 3 && <li>+{changes.length - 3} more changes</li>}
                    </ul>
                  ) : (
                    <p>No tracked field changes.</p>
                  )
                ) : (
                  <p>Initial page version created.</p>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {totalVersions > displayLimit && (
        <a
          className="button secondary version-history__view-all"
          href={`/editorial/pages/${page}/history`}
        >
          View all {totalVersions} versions
        </a>
      )}
    </section>
  )
}
