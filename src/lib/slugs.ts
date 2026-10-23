import type { Payload, PayloadRequest } from 'payload'

import type { Submission } from '@/payload-types'

/*
 * Article URLs: /articles/<slug>.
 *
 * - Generated from the title when a paper is first published, then kept:
 *   editing the title later does not change a published URL.
 * - Unique: a repeated title gets -2, -3, ... in order.
 * - Never purely numeric, so slugs cannot collide with the old
 *   /articles/<id> links, which now redirect to the slug.
 */

const maxLength = 80

export function slugify(title: string) {
  const base = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  // Trim to a whole word where possible.
  let slug = base.length > maxLength ? base.slice(0, maxLength).replace(/-[^-]*$/, '') || base.slice(0, maxLength) : base

  slug = slug.replace(/-+$/g, '')

  if (!slug) return 'article'
  if (/^\d+$/.test(slug)) return `article-${slug}`

  return slug
}

export function isValidSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && !/^\d+$/.test(value) && value.length <= maxLength + 6
}

/*
 * The first free slug for this title: base, base-2, base-3, ...
 */
export async function uniqueSlug(
  payload: Payload,
  title: string,
  { excludeID, req }: { excludeID?: number | string; req?: PayloadRequest } = {},
) {
  const base = slugify(title)

  const existing = await payload.find({
    collection: 'submissions',
    where: { slug: { like: base } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })

  const pattern = new RegExp(`^${base.replace(/[-]/g, '\\-')}(?:-(\\d+))?$`)

  const taken = new Set(
    existing.docs
      .filter((doc) => String(doc.id) !== String(excludeID))
      .map((doc) => doc.slug)
      .filter((slug): slug is string => Boolean(slug && pattern.test(slug))),
  )

  if (!taken.has(base)) return base

  for (let suffix = 2; ; suffix++) {
    const candidate = `${base}-${suffix}`

    if (!taken.has(candidate)) return candidate
  }
}

export function articlePath(submission: Pick<Submission, 'id' | 'slug'>) {
  return `/articles/${submission.slug || submission.id}`
}
