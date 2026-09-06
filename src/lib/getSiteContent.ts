import { getPayload } from 'payload'

import config from '@/payload.config'

export type SiteContentPage = 'papers' | 'submit' | 'about' | 'subscribe'

export async function getSiteContent(page: SiteContentPage) {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'site-content',
    where: {
      page: {
        equals: page,
      },
    },
    limit: 1,
    depth: 2,
  })

  return result.docs[0] || null
}
