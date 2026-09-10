import { getPayload } from 'payload'

import config from '@/payload.config'

import type { SiteContent } from '@/payload-types'

import { SubmissionForm } from '../submission-form/SubmissionForm'
import { submitPaper } from '@/app/(frontend)/submit/actions'

import { hasRichContent } from '@/lib/hasRichContent'

type Props = {
  content: SiteContent | null | undefined
  allowMediaLibrary?: boolean
}

export async function SubmitContent({ content, allowMediaLibrary = false }: Props) {
  const payload = await getPayload({ config })

  const focusAreas = await payload.find({
    collection: 'focus-areas',
    limit: 100,
    sort: 'name',
  })

  return (
    <section className="page-hero">
      <h1>{content?.heroTitle || 'Share an unusual anatomical or autopsy finding.'}</h1>

      {hasRichContent(content?.heroBody) && (
        <div
          dangerouslySetInnerHTML={{
            __html: content?.heroBody || '',
          }}
        />
      )}

      {hasRichContent(content?.content) && (
        <div
          className="rich-output site-content-output"
          dangerouslySetInnerHTML={{
            __html: content?.content || '',
          }}
        />
      )}

      <SubmissionForm
        mode="create"
        focusAreas={focusAreas.docs}
        action={submitPaper}
        submitLabel="Submit Paper"
        allowMediaLibrary={allowMediaLibrary}
      />
    </section>
  )
}
