import { headers as getHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Header } from '@/app/(frontend)/components/Header'
import { Footer } from '@/app/(frontend)/components/Footer'
import { SiteContentVersionHistoryExplorer } from '@/app/(frontend)/components/site-content/SiteContentVersionHistoryExplorer'
import { EditorialNav } from '@/app/(frontend)/components/EditorialNav'

type SitePage = 'papers' | 'submit' | 'about' | 'subscribe'

type Props = {
  params: Promise<{
    page: string
  }>
  searchParams: Promise<{
    version?: string
  }>
}

const pageConfig: Record<
  SitePage,
  {
    label: string
    publicHref: string
  }
> = {
  papers: {
    label: 'Papers',
    publicHref: '/articles',
  },
  submit: {
    label: 'Submit',
    publicHref: '/submit',
  },
  about: {
    label: 'About',
    publicHref: '/about',
  },
  subscribe: {
    label: 'Subscribe',
    publicHref: '/subscribe',
  },
}

function isSitePage(value: string): value is SitePage {
  return value in pageConfig
}

export default async function SiteContentHistoryPage({ params, searchParams }: Props) {
  const { page: rawPage } = await params
  const { version: initialVersionId } = await searchParams

  if (!isSitePage(rawPage)) {
    notFound()
  }

  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect('/login')
  }

  const result = await payload.find({
    collection: 'site-content',
    where: {
      page: {
        equals: rawPage,
      },
    },
    limit: 1,
    depth: 1,
  })

  const content = result.docs[0]

  if (!content) {
    notFound()
  }

  const versions = await payload.findVersions({
    collection: 'site-content',
    where: {
      parent: {
        equals: content.id,
      },
    },
    sort: 'createdAt',
    limit: 25,
    depth: 1,
  })

  return (
    <main className="site">
      <Header />

      <EditorialNav user={user} active="papers" />

      <section className="page-hero page-editor">
        <SiteContentVersionHistoryExplorer
          page={rawPage}
          contentId={content.id}
          versions={versions.docs}
          initialVersionId={initialVersionId}
        />
      </section>

      <Footer />
    </main>
  )
}
