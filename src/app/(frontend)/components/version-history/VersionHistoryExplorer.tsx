'use client'

import { useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { restoreSubmissionVersion } from '@/app/(frontend)/editorial/submissions/[id]/actions'

import {
  formatVersionDate,
  getVersionChanges,
  type VersionChange,
  type VersionDoc,
} from './versionUtils'

import type { Media } from '@/payload-types'
import type { VersionField } from './versionUtils'

type DiffSide = 'before' | 'after'

function RestoreVersionButton({ versionNumber }: { versionNumber: number }) {
  const { pending } = useFormStatus()

  return (
    <button className="button primary" type="submit" disabled={pending}>
      {pending ? 'Restoring…' : `Restore Version ${versionNumber}`}
    </button>
  )
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

type VersionValueProps = {
  field: VersionField
  value: unknown
  comparison?: unknown
  side: DiffSide
}

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
                <VersionValue
                  field={change.field}
                  value={change.before}
                  comparison={change.after}
                  side="before"
                />
              </div>

              <div className="version-diff-after">
                <span className="version-diff-label">After</span>
                <VersionValue
                  field={change.field}
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

function VersionValue({ field, value, comparison, side }: VersionValueProps) {
  if (field === 'featuredImage' || field === 'manuscriptPDF') {
    return <MediaVersionValue value={value} comparison={comparison} side={side} />
  }

  if (field === 'coAuthors') {
    return <CoAuthorsVersionValue value={value} comparison={comparison} side={side} />
  }

  if (field === 'focusArea') {
    return (
      <RelationshipListValue value={value} comparison={comparison} labelKey="name" side={side} />
    )
  }

  if (field === 'keywords') {
    return (
      <RelationshipListValue value={value} comparison={comparison} labelKey="keyword" side={side} />
    )
  }

  if (field === 'supportingImages') {
    return <SupportingImagesVersionValue value={value} comparison={comparison} side={side} />
  }

  if (field === 'manuscriptBody') {
    return (
      <div
        className="version-manuscript-preview"
        dangerouslySetInnerHTML={{
          __html: typeof value === 'string' ? value : '',
        }}
      />
    )
  }

  if (value === null || value === undefined || value === '') {
    return <p className="version-value-empty">Empty</p>
  }

  if (typeof value === 'boolean') {
    return <p>{value ? 'Yes' : 'No'}</p>
  }

  if (typeof value === 'object') {
    return <pre>{JSON.stringify(value, null, 2)}</pre>
  }

  if (typeof value === 'string' && typeof comparison === 'string') {
    return <HighlightedText value={value} comparison={comparison} side={side} />
  }

  if (value === null || value === undefined || value === '') {
    return <p className="version-value-empty">Empty</p>
  }

  if (typeof value === 'boolean') {
    return <p>{value ? 'Yes' : 'No'}</p>
  }

  if (typeof value === 'object') {
    return <pre>{JSON.stringify(value, null, 2)}</pre>
  }

  return <p>{String(value)}</p>
}

function getMediaID(value: unknown) {
  if (typeof value === 'number' || typeof value === 'string') {
    return String(value)
  }

  if (value && typeof value === 'object' && 'id' in value) {
    return String(value.id)
  }

  return null
}

function MediaVersionValue({
  value,
  comparison,
  side,
}: {
  value: unknown
  comparison: unknown
  side: DiffSide
}) {
  if (!value) {
    return <p className="version-value-empty">No file</p>
  }

  const changed = getMediaID(value) !== getMediaID(comparison)

  if (typeof value !== 'object') {
    return (
      <p className={changed ? `version-media-change version-media-change--${side}` : undefined}>
        Media #{String(value)}
      </p>
    )
  }

  const media = value as Partial<Media>
  const url = media.sizes?.card?.url || media.sizes?.square?.url || media.url

  const isImage = media.mimeType?.startsWith('image/')

  return (
    <div
      className={['version-media', changed && `version-media-change version-media-change--${side}`]
        .filter(Boolean)
        .join(' ')}
    >
      {isImage && url ? (
        <img className="version-media-image" src={url} alt={media.alt || ''} />
      ) : (
        <div className="file-preview-icon">PDF</div>
      )}

      <div>
        <strong>{media.filename || media.alt || 'Uploaded file'}</strong>

        {media.mimeType && <small>{media.mimeType}</small>}
      </div>
    </div>
  )
}

type VersionAuthor = {
  id?: string | null
  name?: string | null
  affiliation?: string | null
}

function normalizeAuthors(value: unknown): VersionAuthor[] {
  if (!Array.isArray(value)) return []

  return value.filter((item): item is VersionAuthor => Boolean(item && typeof item === 'object'))
}

function findMatchingAuthor(
  author: VersionAuthor,
  comparisonAuthors: VersionAuthor[],
): VersionAuthor | undefined {
  if (author.id) {
    const byID = comparisonAuthors.find((item) => item.id === author.id)

    if (byID) return byID
  }

  return comparisonAuthors.find((item) => item.name === author.name)
}

function CoAuthorsVersionValue({
  value,
  comparison,
  side,
}: {
  value: unknown
  comparison: unknown
  side: DiffSide
}) {
  const authors = normalizeAuthors(value)
  const comparisonAuthors = normalizeAuthors(comparison)

  if (!authors.length) {
    return <p className="version-value-empty">No co-authors</p>
  }

  return (
    <div className="version-author-list">
      {authors.map((author, index) => {
        const matching = findMatchingAuthor(author, comparisonAuthors)

        const isAddedOrRemoved = !matching

        return (
          <div
            className={['version-author', isAddedOrRemoved && `version-author--${side}`]
              .filter(Boolean)
              .join(' ')}
            key={author.id || `${author.name}-${index}`}
          >
            {matching ? (
              <>
                <HighlightedText
                  value={author.name || ''}
                  comparison={matching.name || ''}
                  side={side}
                />

                {(author.affiliation || matching.affiliation) && (
                  <HighlightedText
                    value={author.affiliation || ''}
                    comparison={matching.affiliation || ''}
                    side={side}
                  />
                )}
              </>
            ) : (
              <>
                <strong>{author.name || 'Unnamed author'}</strong>

                {author.affiliation && <span>{author.affiliation}</span>}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function getRelationshipLabels(value: unknown, labelKey: string): string[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        return String(item)
      }

      if (item && typeof item === 'object' && labelKey in item) {
        const label = item[labelKey as keyof typeof item]

        return typeof label === 'string' || typeof label === 'number' ? String(label) : null
      }

      return null
    })
    .filter((label): label is string => Boolean(label))
}

function RelationshipListValue({
  value,
  comparison,
  labelKey,
  side,
}: {
  value: unknown
  comparison: unknown
  labelKey: string
  side: DiffSide
}) {
  const labels = getRelationshipLabels(value, labelKey)
  const comparisonLabels = new Set(getRelationshipLabels(comparison, labelKey))

  if (!labels.length) {
    return <p className="version-value-empty">None</p>
  }

  return (
    <div className="version-pill-list">
      {labels.map((label) => {
        const changed = !comparisonLabels.has(label)

        return (
          <span
            className={['version-pill', changed && `version-diff-highlight--${side}`]
              .filter(Boolean)
              .join(' ')}
            key={label}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}

// function getVersionRelationshipID(value: unknown): string | number | null {
//   if (typeof value === 'string' || typeof value === 'number') {
//     return value
//   }

//   if (
//     value &&
//     typeof value === 'object' &&
//     'id' in value &&
//     (typeof value.id === 'string' || typeof value.id === 'number')
//   ) {
//     return value.id
//   }

//   return null
// }

type SupportingImageValue = {
  image?: unknown
  caption?: string | null
}

function normalizeSupportingImages(value: unknown): SupportingImageValue[] {
  if (!Array.isArray(value)) return []

  return value.filter((item): item is SupportingImageValue =>
    Boolean(item && typeof item === 'object'),
  )
}

function SupportingImagesVersionValue({
  value,
  comparison,
  side,
}: {
  value: unknown
  comparison: unknown
  side: DiffSide
}) {
  const items = normalizeSupportingImages(value)
  const comparisonItems = normalizeSupportingImages(comparison)

  if (!items.length) {
    return <p className="version-value-empty">No supporting images</p>
  }

  return (
    <div className="version-supporting-images">
      {items.map((item, index) => {
        const imageID = getMediaID(item.image)

        const matching = comparisonItems.find(
          (candidate) => getMediaID(candidate.image) === imageID,
        )

        return (
          <div
            className={[
              'version-supporting-image',
              !matching && `version-supporting-image--${side}`,
            ]
              .filter(Boolean)
              .join(' ')}
            key={imageID || `supporting-${index}`}
          >
            <MediaVersionValue value={item.image} comparison={matching?.image} side={side} />

            {(item.caption || matching?.caption) && (
              <HighlightedText
                value={item.caption || ''}
                comparison={matching?.caption || ''}
                side={side}
              />
            )}
          </div>
        )
      })}
    </div>
  )
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

  const versionDate = activeVersion.updatedAt || activeVersion.createdAt

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

            {versionDate && (
              <time className="version-date" dateTime={versionDate}>
                {formatVersionDate(versionDate)}
              </time>
            )}
          </div>

          {activeIndex < versions.length - 1 && (
            <form action={restoreSubmissionVersion}>
              <input type="hidden" name="submissionId" value={submissionId} />

              <input type="hidden" name="versionId" value={activeVersion.id} />

              <RestoreVersionButton versionNumber={activeIndex + 1} />
            </form>
          )}
        </header>

        <VersionDiff changes={changes} isInitialVersion={activeIndex === 0} />
      </article>
    </section>
  )
}
