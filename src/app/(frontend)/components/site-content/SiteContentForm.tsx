'use client'

import { useState } from 'react'

import type { SiteContent } from '@/payload-types'
import { PayloadManuscriptEditor } from '@/app/(frontend)/components/submission-form/PayloadManuscriptEditor'
import { EditorialBoardEditor } from './EditorialBoardEditor'

type Props = {
  content: SiteContent
  action: (formData: FormData) => void | Promise<void>
}

export function SiteContentForm({ content, action }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isAbout = content.page === 'about'
  const isSubscribe = content.page === 'subscribe'

  return (
    <form className="submit-form" action={action} onSubmit={() => setIsSubmitting(true)}>
      <input type="hidden" name="id" value={content.id} />

      <input type="hidden" name="page" value={content.page} />

      <section className="form-section">
        <div className="section-heading-rule">
          <h2>Page Header</h2>
        </div>

        <div className="form-row">
          <label htmlFor="heroTitle">Page title</label>

          <input id="heroTitle" name="heroTitle" defaultValue={content.heroTitle || ''} required />
        </div>

        <div className="form-row">
          <label>Introduction</label>

          <div>
            <PayloadManuscriptEditor
              name="heroBody"
              initialHTML={content.heroBody || ''}
              placeholder="Write the page introduction…"
              allowMediaLibrary
            />
          </div>
        </div>
      </section>

      <section className="form-section">
        <div className="section-heading-rule">
          <h2>Page Content</h2>
        </div>

        <div className="form-row">
          <label>Content</label>

          <div>
            <PayloadManuscriptEditor
              name="content"
              initialHTML={content.content || ''}
              placeholder="Write the main page content…"
              allowMediaLibrary
            />
          </div>
        </div>
      </section>

      {isSubscribe && (
        <section className="form-section">
          <div className="section-heading-rule">
            <h2>Secondary Content</h2>
          </div>

          <div className="form-row">
            <label htmlFor="secondaryTitle">Section title</label>

            <input
              id="secondaryTitle"
              name="secondaryTitle"
              defaultValue={content.secondaryTitle || ''}
            />
          </div>

          <div className="form-row">
            <label>Section content</label>

            <div>
              <PayloadManuscriptEditor
                name="secondaryContent"
                initialHTML={content.secondaryContent || ''}
                placeholder="Write the secondary section content…"
                allowMediaLibrary
              />
            </div>
          </div>
        </section>
      )}

      {isAbout && <EditorialBoardEditor initialMembers={content.editorialBoard} />}

      <button className="button primary submit-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  )
}
