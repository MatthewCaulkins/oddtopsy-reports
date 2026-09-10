'use client'

import { useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  formatSiteContentVersionDate,
  getSiteContentVersionChanges,
  type SiteContentChange,
  type SiteContentVersionDoc,
} from './siteContentVersionUtils'

import { restoreSiteContentVersion } from '@/app/(frontend)/editorial/pages/[page]/actions'

type Props = {
  page: string
  contentId: string | number
  versions: SiteContentVersionDoc[]
  initialVersionId?: string
}

type DiffSide = 'before' | 'after'

function RestoreButton({ versionNumber }: { versionNumber: number }) {
  const { pending } = useFormStatus()

  return (
    <button className="button primary" type="submit" disabled={pending}>
      {pending ? 'Restoring…' : `Restore Version ${versionNumber}`}
    </button>
  )
}

function stripHTML(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function HighlightedText({
  value,
  comparison,
  side,
}: {
  value: string
  comparison: string
  side: DiffSide
}) {
  let prefixLength = 0

  while (
    prefixLength < value.length &&
    prefixLength < comparison.length &&
    value[prefixLength] === comparison[prefixLength]
  ) {
    prefixLength++
  }

  let suffixLength = 0

  while (
    suffixLength < value.length - prefixLength &&
    suffixLength < comparison.length - prefixLength &&
    value[value.length - 1 - suffixLength] === comparison[comparison.length - 1 - suffixLength]
  ) {
    suffixLength++
  }

  const changedEnd = suffixLength > 0 ? value.length - suffixLength : value.length

  const beforeChange = value.slice(0, prefixLength)
  const changedText = value.slice(prefixLength, changedEnd)
  const afterChange = value.slice(changedEnd)

  return (
    <p className="version-diff-text">
      {beforeChange}

      {changedText && (
        <mark className={['version-diff-highlight', `version-diff-highlight--${side}`].join(' ')}>
          {changedText}
        </mark>
      )}

      {afterChange}
    </p>
  )
}

function SiteContentVersionValue({
  value,
  comparison,
  side,
}: {
  value: unknown
  comparison: unknown
  side: DiffSide
}) {
  const text = stripHTML(value)
  const comparisonText = stripHTML(comparison)

  if (!text) {
    return <p className="version-value-empty">Empty</p>
  }

  return <HighlightedText value={text} comparison={comparisonText} side={side} />
}

function SiteContentVersionDiff({
  changes,
  isInitialVersion,
}: {
  changes: SiteContentChange[]
  isInitialVersion: boolean
}) {
  if (isInitialVersion) {
    return (
      <section className="version-diff">
        <div className="section-heading-rule">
          <h2>Initial Page Version</h2>
        </div>

        <p>This is the first saved version of the page.</p>
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
          <article className="version-diff-item" key={String(change.field)}>
            <h3>{change.label}</h3>

            <div className="version-diff-columns">
              <div className="version-diff-before">
                <span className="version-diff-label">Before</span>

                <SiteContentVersionValue
                  value={change.before}
                  comparison={change.after}
                  side="before"
                />
              </div>

              <div className="version-diff-after">
                <span className="version-diff-label">After</span>

                <SiteContentVersionValue
                  value={change.after}
                  comparison={change.before}
                  side="after"
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function SiteContentVersionHistoryExplorer({
  page,
  contentId,
  versions,
  initialVersionId,
}: Props) {
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
    () => getSiteContentVersionChanges(previousVersion?.version, activeVersion?.version),
    [activeVersion, previousVersion],
  )

  if (!activeVersion) {
    return <p>No version history is available.</p>
  }

  const versionDate = activeVersion.updatedAt || activeVersion.createdAt

  return (
    <section className="version-history version-explorer">
      <div className="version-history__return">
        <a className="button secondary" href={`/editorial/pages/${page}?mode=edit`}>
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

            {versionDate && (
              <time className="version-date" dateTime={versionDate}>
                {formatSiteContentVersionDate(versionDate)}
              </time>
            )}
          </div>

          {activeIndex < versions.length - 1 && (
            <form action={restoreSiteContentVersion}>
              <input type="hidden" name="page" value={page} />

              <input type="hidden" name="contentId" value={contentId} />

              <input type="hidden" name="versionId" value={activeVersion.id} />

              <RestoreButton versionNumber={activeIndex + 1} />
            </form>
          )}
        </header>

        <SiteContentVersionDiff changes={changes} isInitialVersion={activeIndex === 0} />
      </article>
    </section>
  )
}
