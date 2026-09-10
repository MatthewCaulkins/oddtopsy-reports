import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { Header } from '../components/Header'
import { Footer } from '../components/Footer'

import { getSiteContent } from '@/lib/getSiteContent'
import { EditPageButton } from '../components/site-content/EditPageButton'
import { AboutContent } from '../components/site-content/AboutContent'

export default async function AboutPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({
    headers,
  })

  const about = await getSiteContent('about')

  return (
    <main className="site">
      <Header />

      {user && <EditPageButton page="about" />}

      <AboutContent content={about} />

      <Footer />
    </main>
  )
}
