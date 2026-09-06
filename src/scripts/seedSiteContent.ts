import { getPayload } from 'payload'

import config from '@/payload.config'

const pages = [
  {
    page: 'papers' as const,
    heroTitle: 'Case papers and anatomical findings.',
    heroBody: 'A growing archive of submitted and editor-reviewed papers.',
  },

  {
    page: 'submit' as const,
    heroTitle: 'Share an unusual anatomical or autopsy finding.',
    heroBody:
      'Upload a completed manuscript PDF or draft the paper directly in the editor. Editors will review the submission and follow up if revisions are needed.',
  },

  {
    page: 'about' as const,
    heroTitle: 'About Oddtopsy Reports',
    heroBody:
      'Oddtopsy Reports is a low-barrier publication home for unusual anatomical findings, cadaveric studies, and educational case reports that deserve to be shared more widely.',
    content: `
      <h2>Why We Exist</h2>
      <p>
        Oddtopsy Reports provides a home for unusual anatomical findings,
        educational case reports, and cadaveric observations.
      </p>
    `,
  },

  {
    page: 'subscribe' as const,
    heroTitle: 'Stay connected with Oddtopsy Reports.',
    heroBody: 'Follow new case reports, anatomical findings, and journal updates.',
    content: `
      <h2>Stay Connected</h2>
      <p>Subscribe for journal updates and newly published reports.</p>
    `,
    secondaryTitle: 'Possible Model',
    secondaryContent: `
      <p>
        Subscription and support options will be available as the journal grows.
      </p>
    `,
  },
]

async function seedSiteContent() {
  const payload = await getPayload({ config })

  for (const page of pages) {
    const existing = await payload.find({
      collection: 'site-content',
      where: {
        page: {
          equals: page.page,
        },
      },
      limit: 1,
      depth: 0,
    })

    if (existing.docs.length > 0) {
      continue
    }

    await payload.create({
      collection: 'site-content',
      data: page,
    })
  }

  console.log('Site content seeded.')
}

seedSiteContent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
