import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { publishedPaperWhere } from '@/access/visibility'
import { siteURL } from '@/lib/notifications'
import { articlePath } from '@/lib/slugs'

// Built per request: the database is not available while the image is built.
export const dynamic = 'force-dynamic'

const publicPages = ['/', '/articles', '/about', '/submit', '/subscribe']

/*
 * Public pages and every published article at its canonical slug URL.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config })

  const papers = await payload.find({
    collection: 'submissions',
    where: publishedPaperWhere,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    select: { slug: true, updatedAt: true },
  })

  return [
    ...publicPages.map((path) => ({ url: `${siteURL}${path}` })),
    ...papers.docs.map((paper) => ({
      url: `${siteURL}${articlePath(paper)}`,
      lastModified: paper.updatedAt,
    })),
  ]
}
