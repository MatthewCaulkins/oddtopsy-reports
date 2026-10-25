import { headers as getHeaders } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { subscriptionsEnabled } from '@/lib/features'

import { Header } from '../components/Header'
import { Footer } from '../components/Footer'

import { getSiteContent } from '@/lib/getSiteContent'
import { EditPageButton } from '../components/site-content/EditPageButton'
import { SubscribeContent } from '../components/site-content/SubscribeContent'

// Per request, so SUBSCRIPTIONS_ENABLED is read at runtime (otherwise the 404 is prerendered at build).
export const dynamic = 'force-dynamic'

export default async function SubscribePage() {
  // Not built yet: hidden from everyone until SUBSCRIPTIONS_ENABLED is set.
  if (!subscriptionsEnabled()) notFound()

  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({
    headers,
  })

  const pageContent = await getSiteContent('subscribe')

  return (
    <main className="site">
      <Header />

      {user && <EditPageButton page="subscribe" />}

      <SubscribeContent content={pageContent} />

      <Footer />
    </main>
  )
}
