import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { Header } from '../components/Header'
import { Footer } from '../components/Footer'

import { getSiteContent } from '@/lib/getSiteContent'
import { EditPageButton } from '../components/site-content/EditPageButton'
import { SubmitContent } from '../components/site-content/SubmitContent'

export default async function SubmitPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({
    headers,
  })

  const pageContent = await getSiteContent('submit')

  return (
    <main className="site">
      <Header />

      {user && <EditPageButton page="submit" />}

      <SubmitContent content={pageContent} allowMediaLibrary={Boolean(user)} />

      <Footer />
    </main>
  )
}
