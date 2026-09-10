import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { Header } from '../components/Header'
import { Footer } from '../components/Footer'

import { getSiteContent } from '@/lib/getSiteContent'
import { EditPageButton } from '../components/site-content/EditPageButton'

import { PapersContent, type PapersSearchParams } from '../components/site-content/PapersContent'

type ArticlesPageProps = {
  searchParams: Promise<PapersSearchParams>
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const params = await searchParams

  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({
    headers,
  })

  const pageContent = await getSiteContent('papers')

  return (
    <main className="site">
      <Header />

      {user && <EditPageButton page="papers" />}

      <PapersContent content={pageContent} searchParams={params} editorial={Boolean(user)} />

      <Footer />
    </main>
  )
}
