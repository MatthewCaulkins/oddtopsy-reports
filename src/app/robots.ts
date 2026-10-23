import type { MetadataRoute } from 'next'

import { siteURL } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Staff-only and private flows.
      disallow: ['/editorial', '/admin', '/api', '/auth', '/revise'],
    },
    sitemap: `${siteURL}/sitemap.xml`,
  }
}
