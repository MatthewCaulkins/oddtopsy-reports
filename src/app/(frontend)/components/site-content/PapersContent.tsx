import { getPayload, type Where } from 'payload'

import config from '@/payload.config'

import type { SiteContent } from '@/payload-types'

import { PaperCard } from '../PaperCard'
import { hasRichContent } from '@/lib/hasRichContent'

const PAPERS_PER_PAGE = 6

export type PapersSearchParams = {
  q?: string
  focus?: string
  from?: string
  to?: string
  page?: string
}

type Props = {
  content: SiteContent | null | undefined
  searchParams?: PapersSearchParams
  editorial?: boolean
}

export async function PapersContent({ content, searchParams = {}, editorial = false }: Props) {
  const query = searchParams.q?.trim() || ''

  const focus = searchParams.focus?.trim() || ''

  const from = searchParams.from?.trim() || ''

  const to = searchParams.to?.trim() || ''

  const requestedPage = Number.parseInt(searchParams.page || '1', 10)

  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1

  const payload = await getPayload({ config })

  function buildArchiveHref({
    q,
    focus,
    from,
    to,
    page,
  }: {
    q?: string
    focus?: string
    from?: string
    to?: string
    page?: number
  }) {
    const params = new URLSearchParams()

    if (q) params.set('q', q)
    if (focus) params.set('focus', focus)
    if (from) params.set('from', from)
    if (to) params.set('to', to)

    if (page && page > 1) {
      params.set('page', String(page))
    }

    const queryString = params.toString()

    return queryString ? `/articles?${queryString}` : '/articles'
  }

  const [editorialQueue, focusAreas] = await Promise.all([
    editorial
      ? payload.find({
          collection: 'submissions',

          where: {
            and: [
              {
                workflowStatus: {
                  not_equals: 'published',
                },
              },
              {
                trashed: {
                  not_equals: true,
                },
              },
            ],
          },

          sort: '-createdAt',
          depth: 1,
          limit: 6,
        })
      : Promise.resolve(null),

    payload.find({
      collection: 'focus-areas',
      sort: 'name',
      pagination: false,
    }),
  ])

  const conditions: Where[] = [
    {
      workflowStatus: {
        equals: 'published',
      },
    },
    {
      trashed: {
        not_equals: true,
      },
    },
  ]

  if (query) {
    conditions.push({
      or: [
        {
          title: {
            contains: query,
          },
        },
        {
          subtitle: {
            contains: query,
          },
        },
        {
          abstract: {
            contains: query,
          },
        },
        {
          'leadAuthor.name': {
            contains: query,
          },
        },
        {
          'coAuthors.name': {
            contains: query,
          },
        },
        {
          'keywords.keyword': {
            contains: query,
          },
        },
      ],
    })
  }

  if (focus) {
    conditions.push({
      focusArea: {
        contains: focus,
      },
    })
  }

  if (from) {
    conditions.push({
      publishedDate: {
        greater_than_equal: new Date(`${from}T00:00:00`).toISOString(),
      },
    })
  }

  if (to) {
    conditions.push({
      publishedDate: {
        less_than_equal: new Date(`${to}T23:59:59.999`).toISOString(),
      },
    })
  }

  const publishedPapers = await payload.find({
    collection: 'submissions',

    where: {
      and: conditions,
    },

    sort: '-publishedDate',
    depth: 1,
    limit: PAPERS_PER_PAGE,
    page,
  })

  return (
    <>
      <section className="page-hero">
        <h1>{content?.heroTitle || 'Case papers and anatomical findings.'}</h1>

        {hasRichContent(content?.heroBody) && (
          <div
            dangerouslySetInnerHTML={{
              __html: content?.heroBody || '',
            }}
          />
        )}

        {hasRichContent(content?.content) && (
          <div
            className="rich-output site-content-output"
            dangerouslySetInnerHTML={{
              __html: content?.content || '',
            }}
          />
        )}
      </section>

      {editorial && editorialQueue && (
        <section className="section editor-section">
          <div className="section-heading-rule">
            <h2>Editorial Queue Preview</h2>
          </div>

          {editorialQueue.docs.length > 0 ? (
            <div className="card-grid">
              {editorialQueue.docs.map((submission) => (
                <PaperCard paper={submission} editorial key={submission.id} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>No submissions waiting for review.</h3>

              <p>New submissions will appear here for logged-in editors.</p>
            </div>
          )}
        </section>
      )}

      <section className="section">
        <div className="section-heading-rule">
          <h2>Published Papers</h2>
        </div>

        <form className="archive-filters" action="/articles" method="get">
          <div className="archive-filter-field archive-filter-search">
            <label htmlFor="archive-search">Search papers</label>

            <input
              id="archive-search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search title, abstract, author, or keyword"
            />
          </div>

          <div className="archive-filter-options">
            <div className="archive-filter-field">
              <label htmlFor="archive-focus">Focus area</label>

              <div className="select-wrap">
                <select id="archive-focus" name="focus" defaultValue={focus}>
                  <option value="">All focus areas</option>

                  {focusAreas.docs.map((area) => (
                    <option key={area.id} value={String(area.id)}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="archive-filter-field">
              <label htmlFor="archive-from">Published from</label>

              <input id="archive-from" name="from" type="date" defaultValue={from} />
            </div>

            <div className="archive-filter-field">
              <label htmlFor="archive-to">Published through</label>

              <input id="archive-to" name="to" type="date" defaultValue={to} />
            </div>
          </div>

          <div className="archive-filter-actions">
            <button className="button primary" type="submit">
              Search
            </button>

            {(query || focus || from || to) && (
              <a className="button secondary" href="/articles">
                Clear
              </a>
            )}
          </div>
        </form>

        <div className="archive-results-meta">
          <p>
            {publishedPapers.totalDocs === 1
              ? '1 paper found'
              : `${publishedPapers.totalDocs} papers found`}
          </p>

          {(query || focus || from || to) && (
            <p>
              Showing filtered results
              {query ? ` for “${query}”` : ''}
            </p>
          )}
        </div>

        {publishedPapers.docs.length > 0 ? (
          <>
            <div className="archive-grid">
              {publishedPapers.docs.map((paper) => (
                <PaperCard paper={paper} compact key={paper.id} />
              ))}
            </div>

            {publishedPapers.totalPages > 1 && (
              <nav className="archive-pagination" aria-label="Published papers pagination">
                {publishedPapers.hasPrevPage && (
                  <a
                    className="button secondary"
                    href={buildArchiveHref({
                      q: query,
                      focus,
                      from,
                      to,
                      page: page - 1,
                    })}
                  >
                    ← Previous
                  </a>
                )}

                <div className="archive-pagination-pages">
                  {Array.from(
                    {
                      length: publishedPapers.totalPages,
                    },
                    (_, index) => index + 1,
                  ).map((pageNumber) => (
                    <a
                      key={pageNumber}
                      className={[
                        'archive-pagination-page',
                        pageNumber === publishedPapers.page && 'is-active',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      href={buildArchiveHref({
                        q: query,
                        focus,
                        from,
                        to,
                        page: pageNumber,
                      })}
                      aria-current={pageNumber === publishedPapers.page ? 'page' : undefined}
                    >
                      {pageNumber}
                    </a>
                  ))}
                </div>

                {publishedPapers.hasNextPage && (
                  <a
                    className="button secondary"
                    href={buildArchiveHref({
                      q: query,
                      focus,
                      from,
                      to,
                      page: page + 1,
                    })}
                  >
                    Next →
                  </a>
                )}
              </nav>
            )}
          </>
        ) : (
          <div className="empty-state">
            <h3>No matching papers found.</h3>

            <p>Try another search term or choose a different focus area.</p>

            <a className="button secondary" href="/articles">
              Clear search and filters
            </a>
          </div>
        )}
      </section>
    </>
  )
}
