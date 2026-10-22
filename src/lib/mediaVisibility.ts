import type { Payload, PayloadRequest, Where } from 'payload'

import { audienceRank, getPaperAudience, publishedPaperWhere, type Audience } from '@/access/visibility'
import type { SiteContent, Submission } from '@/payload-types'

/*
 * Each media file's audience is derived from what uses it: the most
 * open audience of any published paper or site page that references
 * it (as a relationship or an inline <img> in editor HTML), and
 * 'staff' when nothing published uses it. Unpublishing a paper or
 * swapping an image therefore hides files again automatically.
 */

export type MediaReferences = {
  ids: number[]
  filenames: string[]
}

const mediaFilePattern = /\/api\/media\/file\/([^"'?#\s<>)]+)/g

const siteContentHTMLFields = ['heroBody', 'content', 'secondaryContent'] as const

function getMediaID(value: unknown): number | null {
  const id =
    value && typeof value === 'object' && 'id' in value ? (value as { id: unknown }).id : value

  const numericID = Number(id)

  return Number.isInteger(numericID) && numericID > 0 ? numericID : null
}

function getFilenamesFromHTML(...values: (string | null | undefined)[]): string[] {
  const filenames = new Set<string>()

  for (const html of values) {
    if (!html) continue

    for (const match of html.matchAll(mediaFilePattern)) {
      try {
        filenames.add(decodeURIComponent(match[1]))
      } catch {
        filenames.add(match[1])
      }
    }
  }

  return [...filenames]
}

function collectIDs(values: unknown[]): number[] {
  return [...new Set(values.map(getMediaID).filter((id): id is number => id !== null))]
}

export function getSubmissionMedia(doc: Submission | null | undefined): MediaReferences {
  if (!doc) return { ids: [], filenames: [] }

  return {
    ids: collectIDs([
      doc.featuredImage,
      doc.manuscriptPDF,
      ...(doc.supportingImages || []).map((item) => item.image),
    ]),
    filenames: getFilenamesFromHTML(doc.manuscriptBody),
  }
}

export function getSiteContentMedia(doc: SiteContent | null | undefined): MediaReferences {
  if (!doc) return { ids: [], filenames: [] }

  return {
    ids: collectIDs((doc.editorialBoard || []).map((member) => member.photo)),
    filenames: getFilenamesFromHTML(...siteContentHTMLFields.map((field) => doc[field])),
  }
}

export function mergeMediaReferences(...references: MediaReferences[]): MediaReferences {
  return {
    ids: [...new Set(references.flatMap((reference) => reference.ids))],
    filenames: [...new Set(references.flatMap((reference) => reference.filenames))],
  }
}

/*
 * The media IDs behind a set of references, including inline images
 * that are only referenced by filename.
 */
export async function resolveMediaIDs(payload: Payload, references: MediaReferences) {
  if (references.filenames.length === 0) return references.ids

  const inline = await payload.find({
    collection: 'media',
    where: { filename: { in: references.filenames } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  return [...new Set([...references.ids, ...inline.docs.map((item) => item.id)])]
}

/*
 * Recalculates the audience of every file in `references`. Pass both
 * the files a change added and the ones it removed.
 */
export async function syncMediaAudience(
  payload: Payload,
  references: MediaReferences,
  req?: PayloadRequest,
) {
  const mediaMatches: Where[] = [
    ...(references.ids.length > 0 ? [{ id: { in: references.ids } }] : []),
    ...(references.filenames.length > 0 ? [{ filename: { in: references.filenames } }] : []),
  ]

  if (mediaMatches.length === 0) return

  const media = await payload.find({
    collection: 'media',
    where: { or: mediaMatches },
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })

  if (media.docs.length === 0) return

  const ids = media.docs.map((item) => item.id)
  const filenames = media.docs.map((item) => item.filename).filter((name): name is string => !!name)

  // `contains` only narrows the search; exact matches are checked below.
  const papers = await payload.find({
    collection: 'submissions',
    where: {
      and: [
        publishedPaperWhere,
        {
          or: [
            { featuredImage: { in: ids } },
            { manuscriptPDF: { in: ids } },
            { 'supportingImages.image': { in: ids } },
            ...filenames.map((filename) => ({ manuscriptBody: { contains: filename } })),
          ],
        },
      ],
    },
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })

  const pages = await payload.find({
    collection: 'site-content',
    where: {
      or: [
        { 'editorialBoard.photo': { in: ids } },
        ...filenames.flatMap((filename) =>
          siteContentHTMLFields.map((field) => ({ [field]: { contains: filename } })),
        ),
      ],
    },
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })

  const granted = new Map<string, Audience>()

  function grant(used: MediaReferences, audience: Audience) {
    const keys = [
      ...used.ids.map((id) => `id:${id}`),
      ...used.filenames.map((filename) => `file:${filename}`),
    ]

    for (const key of keys) {
      const current = granted.get(key)

      if (!current || audienceRank[audience] > audienceRank[current]) {
        granted.set(key, audience)
      }
    }
  }

  for (const paper of papers.docs) grant(getSubmissionMedia(paper), getPaperAudience(paper))

  for (const page of pages.docs) grant(getSiteContentMedia(page), 'public')

  for (const item of media.docs) {
    const candidates = [granted.get(`id:${item.id}`), granted.get(`file:${item.filename}`)]

    const audience = candidates.reduce<Audience>(
      (best, candidate) =>
        candidate && audienceRank[candidate] > audienceRank[best] ? candidate : best,
      'staff',
    )

    if (item.audience !== audience) {
      await payload.update({
        collection: 'media',
        id: item.id,
        data: { audience },
        depth: 0,
        overrideAccess: true,
        req,
      })
    }
  }
}
