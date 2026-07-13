'use client'

import { useMemo, useState } from 'react'
import { restoreSubmissionVersion } from '@/app/(frontend)/editorial/submissions/[id]/actions'

import { getVersionChanges, type VersionChange, type VersionDoc } from './versionUtils'

type Props = {
  submissionId: string | number
  versions: VersionDoc[]
  initialVersionId?: string
}

type VersionDiffProps = {
  changes: VersionChange[]
  isInitialVersion: boolean
}

function VersionDiff({ changes, isInitialVersion }: VersionDiffProps) {
  if (isInitialVersion) {
    return (
      <section className="version-diff">
        <div className="section-heading-rule">
          <h2>Initial Submission</h2>
        </div>

        <p>This is the first saved version of the submission.</p>
      </section>
    )
  }

  if (!changes.length) {
    return (
      <section className="version-diff">
        <div className="section-heading-rule">
          <h2>Changes</h2>
        </div>

        <p>No tracked content fields changed in this version.</p>
      </section>
    )
  }

  return (
    <section className="version-diff">
      <div className="section-heading-rule">
        <h2>Changes from the previous version</h2>
      </div>

      <div className="version-diff-list">
        {changes.map((change) => (
          <article className="version-diff-item" key={change.field}>
            <h3>{change.label}</h3>

            <div className="version-diff-columns">
              <div className="version-diff-before">
                <span className="version-diff-label">Before</span>
                <VersionValue value={change.before} />
              </div>

              <div className="version-diff-after">
                <span className="version-diff-label">After</span>
                <VersionValue value={change.after} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function VersionValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <p className="version-value-empty">Empty</p>
  }

  if (typeof value === 'boolean') {
    return <p>{value ? 'Yes' : 'No'}</p>
  }

  if (Array.isArray(value)) {
    return value.length ? (
      <pre>{JSON.stringify(value, null, 2)}</pre>
    ) : (
      <p className="version-value-empty">Empty</p>
    )
  }

  if (typeof value === 'object') {
    return <pre>{JSON.stringify(value, null, 2)}</pre>
  }

  return <p>{String(value)}</p>
}

export function VersionHistoryExplorer({ submissionId, versions, initialVersionId }: Props) {
  const initialIndex = Math.max(
    0,
    initialVersionId
      ? versions.findIndex((item) => String(item.id) === initialVersionId)
      : versions.length - 1,
  )

  const [activeIndex, setActiveIndex] = useState(initialIndex)

  const activeVersion = versions[activeIndex]
  const previousVersion = versions[activeIndex - 1]

  const changes = useMemo(
    () => getVersionChanges(previousVersion?.version, activeVersion?.version),
    [activeVersion, previousVersion],
  )

  if (!activeVersion) {
    return <p>No version history is available.</p>
  }

  return (
    <section className="version-history version-explorer">
      <div className="version-history__return">
        <a className="button secondary" href={`/editorial/submissions/${submissionId}?mode=edit`}>
          ← Return to Editor
        </a>
      </div>

      <div className="section-heading-rule">
        <h2>Version History</h2>
      </div>

      <div className="version-timeline-wrap">
        <button
          type="button"
          className="version-timeline-arrow"
          aria-label="Previous version"
          disabled={activeIndex === 0}
          onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
        >
          ‹
        </button>

        <div className="version-timeline">
          {versions.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={[
                'version-timeline-step',
                index === activeIndex && 'is-active',
                index < activeIndex && 'is-complete',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={`View version ${index + 1}`}
              aria-current={index === activeIndex ? 'step' : undefined}
              onClick={() => setActiveIndex(index)}
            >
              <span className="version-timeline-dot" />
            </button>
          ))}
        </div>

        <button
          type="button"
          className="version-timeline-arrow"
          aria-label="Next version"
          disabled={activeIndex === versions.length - 1}
          onClick={() => setActiveIndex((current) => Math.min(versions.length - 1, current + 1))}
        >
          ›
        </button>
      </div>

      <article className="version-active-card content-panel">
        <header className="version-active-header">
          <div className="version-active-meta">
            <h2>Version {activeIndex + 1}</h2>

            {(activeVersion.updatedAt || activeVersion.createdAt) && (
              <div className="version-date">
                {new Date(activeVersion.updatedAt ?? activeVersion.createdAt!).toLocaleString(
                  undefined,
                  {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  },
                )}
              </div>
            )}
          </div>

          {activeIndex < versions.length - 1 && (
            <form action={restoreSubmissionVersion}>
              <input type="hidden" name="submissionId" value={submissionId} />

              <input type="hidden" name="versionId" value={activeVersion.id} />

              <button className="button primary" type="submit">
                Restore Version {activeIndex + 1}
              </button>
            </form>
          )}
        </header>

        <VersionDiff changes={changes} isInitialVersion={activeIndex === 0} />
      </article>
    </section>
  )
}
