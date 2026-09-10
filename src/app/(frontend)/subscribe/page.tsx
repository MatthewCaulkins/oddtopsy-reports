import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { Header } from '../components/Header'
import { Footer } from '../components/Footer'

import { getSiteContent } from '@/lib/getSiteContent'
import { EditPageButton } from '../components/site-content/EditPageButton'
import { SubscribeContent } from '../components/site-content/SubscribeContent'

export default async function SubscribePage() {
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
