import { headers as getHeaders } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Header } from '@/app/(frontend)/components/Header'
import { Footer } from '@/app/(frontend)/components/Footer'
import { Breadcrumbs } from '@/app/(frontend)/components/Breadcrumbs'
import { EditorialToolbar } from '@/app/(frontend)/components/EditorialToolbar'
import { SiteContentForm } from '@/app/(frontend)/components/site-content/SiteContentForm'
import { updateSiteContent } from './actions'
import type { SiteContent } from '@/payload-types'
import { SiteContentVersionHistory } from '@/app/(frontend)/components/site-content/SiteContentVersionHistory'

import { AboutContent } from '@/app/(frontend)/components/site-content/AboutContent'
import { SubmitContent } from '@/app/(frontend)/components/site-content/SubmitContent'
import { SubscribeContent } from '@/app/(frontend)/components/site-content/SubscribeContent'
import { PapersContent } from '@/app/(frontend)/components/site-content/PapersContent'

const allowedPages = ['papers', 'submit', 'about', 'subscribe'] as const

type SitePage = (typeof allowedPages)[number]

type Props = {
  params: Promise<{
    page: string
  }>
  searchParams: Promise<{
    mode?: string
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
  return allowedPages.includes(value as SitePage)
}

export default async function EditorialPage({ params, searchParams }: Props) {
  const { page: rawPage } = await params
  const { mode: rawMode } = await searchParams

  if (!isSitePage(rawPage)) {
    notFound()
  }

  const mode = rawMode === 'edit' ? 'edit' : 'preview'
  const configForPage = pageConfig[rawPage]

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
    depth: 2,
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
    sort: '-createdAt',
    limit: 4,
    depth: 1,
  })

  return (
    <main className="site">
      <Header />

      <Breadcrumbs
        items={[
          {
            label: configForPage.label,
            href: configForPage.publicHref,
          },
          {
            label: 'Editor',
          },
        ]}
      />

      <EditorialToolbar
        mode={mode}
        previewHref={`/editorial/pages/${rawPage}?mode=preview`}
        editHref={`/editorial/pages/${rawPage}?mode=edit`}
        publishedHref={configForPage.publicHref}
      />

      {mode === 'edit' ? (
        <section className="page-hero page-editor">
          <SiteContentVersionHistory
            page={rawPage}
            versions={versions.docs}
            totalVersions={versions.totalDocs}
            displayLimit={3}
          />

          <SiteContentForm content={content} action={updateSiteContent} />
        </section>
      ) : (
        <div className="editorial-page-preview" inert>
          {rawPage === 'about' && <AboutContent content={content} />}

          {rawPage === 'submit' && (
            <SubmitContent content={content} allowMediaLibrary={Boolean(user)} />
          )}

          {rawPage === 'subscribe' && <SubscribeContent content={content} />}

          {rawPage === 'papers' && <PapersContent content={content} editorial />}
        </div>
      )}

      <Footer />
    </main>
  )
}
