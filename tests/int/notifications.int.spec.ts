// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import type { AccessRequest, Submission } from '@/payload-types'

/*
 * Offline tests for the notification pipeline and the public submission
 * flow. SES and Payload are replaced with recording fakes.
 */

process.env.SITE_URL = 'https://oddtopsies.example'

type Sent = { to: string; subject: string; html: string; text: string }

function fakePayload({
  staff = [] as { email: string }[],
  failFor = [] as string[],
  findThrows = false,
} = {}) {
  const sent: Sent[] = []
  const logs: { level: string; data: unknown; message: string }[] = []

  const payload = {
    find: vi.fn(async () => {
      if (findThrows) throw new Error('database unavailable')
      return { docs: staff }
    }),
    sendEmail: vi.fn(async (message: Sent) => {
      if (failFor.includes(message.to)) throw Object.assign(new Error('Email address is not verified.'), { name: 'MessageRejected' })
      sent.push(message)
      return { messageId: `id-${sent.length}` }
    }),
    logger: {
      info: vi.fn((data: unknown, message: string) => logs.push({ level: 'info', data, message })),
      warn: vi.fn((data: unknown, message: string) => logs.push({ level: 'warn', data, message })),
      error: vi.fn((data: unknown, message: string) => logs.push({ level: 'error', data, message })),
    },
  }

  return { payload, sent, logs }
}

const submission = {
  id: 42,
  title: 'A <Rare> Finding & More',
  submissionType: 'upload',
  correspondingAuthor: { name: 'Dr. Author', email: 'author@example.org' },
  leadAuthor: { name: 'Lead Author' },
  createdAt: '2026-10-23T12:00:00.000Z',
} as unknown as Submission

const request = {
  id: 7,
  name: 'Applicant <script>',
  email: 'applicant@example.org',
  affiliation: 'Example University',
  createdAt: '2026-10-23T12:00:00.000Z',
  rejectionNote: 'INTERNAL: not on the editorial board',
} as unknown as AccessRequest

describe('SES adapter', () => {
  it('sends simple (not raw) content with HTML and text, needing only ses:SendEmail', async () => {
    const { sesEmailAdapter } = await import('@/lib/email/sesAdapter')
    const send = vi.fn(async () => ({ MessageId: 'ses-123' }))
    const adapter = sesEmailAdapter({ fromAddress: 'editorial@oddtopsies.org', fromName: 'Oddtopsy Reports', region: 'us-east-1', client: { send } as never })({ payload: {} as never })

    const result = await adapter.sendEmail({ to: 'staff@example.org', subject: 'Hello', html: '<p>Hi</p>', text: 'Hi' })

    expect(result).toEqual({ messageId: 'ses-123' })
    const input = (send.mock.calls[0] as unknown as [{ input: Record<string, any> }])[0].input
    expect(input.FromEmailAddress).toBe('"Oddtopsy Reports" <editorial@oddtopsies.org>')
    expect(input.Destination).toEqual({ ToAddresses: ['staff@example.org'] })
    expect(input.Content.Raw).toBeUndefined()
    expect(input.Content.Simple.Subject.Data).toBe('Hello')
    expect(input.Content.Simple.Body.Html.Data).toBe('<p>Hi</p>')
    expect(input.Content.Simple.Body.Text.Data).toBe('Hi')
  })

  it('refuses messages without recipients or a body', async () => {
    const { sesEmailAdapter } = await import('@/lib/email/sesAdapter')
    const adapter = sesEmailAdapter({ fromAddress: 'a@b.org', fromName: 'X', region: 'us-east-1', client: { send: vi.fn() } as never })({ payload: {} as never })

    await expect(adapter.sendEmail({ subject: 'x', text: 'x' })).rejects.toThrow(/no recipients/)
    await expect(adapter.sendEmail({ to: 'a@b.org', subject: 'x' })).rejects.toThrow(/no body/)
  })
})

describe('notifications', () => {
  it('emails active managers and admins about access requests, one message each', async () => {
    const { notifyStaffOfAccessRequest } = await import('@/lib/notifications')
    const { payload, sent } = fakePayload({ staff: [{ email: 'admin@example.org' }, { email: 'manager@example.org' }] })

    const result = await notifyStaffOfAccessRequest(payload as never, request)

    expect(result).toMatchObject({ recipients: 2, sent: 2, failed: 0 })
    expect(sent.map((message) => message.to)).toEqual(['admin@example.org', 'manager@example.org'])
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { and: [{ role: { in: ['manager', 'admin'] } }, { accountStatus: { equals: 'active' } }] },
      }),
    )
    expect(sent[0].html).toContain('Example University')
    expect(sent[0].html).toContain('https://oddtopsies.example/editorial/users')
    expect(sent[0].text).toContain('Review the request: https://oddtopsies.example/editorial/users')
  })

  it('emails all active editorial staff about a new submission with a direct link', async () => {
    const { notifyStaffOfSubmission } = await import('@/lib/notifications')
    const { payload, sent } = fakePayload({ staff: [{ email: 'editor@example.org' }] })

    await notifyStaffOfSubmission(payload as never, submission)

    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { and: [{ role: { in: ['editor', 'manager', 'admin'] } }, { accountStatus: { equals: 'active' } }] } }),
    )
    expect(sent[0].subject).toBe('New submission: A <Rare> Finding & More')
    expect(sent[0].html).toContain('https://oddtopsies.example/editorial/submissions/42')
  })

  it('escapes names and titles in HTML', async () => {
    const { notifyStaffOfAccessRequest, notifyStaffOfSubmission } = await import('@/lib/notifications')
    const { payload, sent } = fakePayload({ staff: [{ email: 'admin@example.org' }] })

    await notifyStaffOfAccessRequest(payload as never, request)
    await notifyStaffOfSubmission(payload as never, submission)

    expect(sent[0].html).not.toContain('<script>')
    expect(sent[0].html).toContain('Applicant &lt;script&gt;')
    expect(sent[1].html).toContain('A &lt;Rare&gt; Finding &amp; More')
  })

  it('sends the author their revision link and the editors’ instructions', async () => {
    const { sendRevisionRequest } = await import('@/lib/notifications')
    const { payload, sent } = fakePayload()

    await sendRevisionRequest(payload as never, submission, 'https://oddtopsies.example/revise/TOKEN', 'Please add a scale bar.', new Date('2026-12-22'))

    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe('author@example.org')
    expect(sent[0].text).toContain('Please add a scale bar.')
    expect(sent[0].text).toContain('Revise your submission: https://oddtopsies.example/revise/TOKEN')
  })

  it('tells a rejected applicant courteously, without the internal note', async () => {
    const { notifyApplicantOfRejection } = await import('@/lib/notifications')
    const { payload, sent } = fakePayload()

    await notifyApplicantOfRejection(payload as never, request)

    expect(sent[0].to).toBe('applicant@example.org')
    expect(sent[0].text).toContain('not able to approve')
    expect(sent[0].html).not.toContain('INTERNAL')
    expect(sent[0].text).not.toContain('INTERNAL')
  })

  it('keeps sending when one recipient fails, logs it, and does not throw', async () => {
    const { notifyStaffOfSubmission } = await import('@/lib/notifications')
    const { payload, sent, logs } = fakePayload({
      staff: [{ email: 'bad@example.org' }, { email: 'good@example.org' }],
      failFor: ['bad@example.org'],
    })

    const result = await notifyStaffOfSubmission(payload as never, submission)

    expect(result).toMatchObject({ recipients: 2, sent: 1, failed: 1 })
    expect(sent.map((message) => message.to)).toEqual(['good@example.org'])
    const error = logs.find((log) => log.level === 'error')!
    expect(error.data).toMatchObject({ event: 'submission.received', failed: 1, errors: [{ name: 'MessageRejected' }] })
    // Recipients are counted, never logged.
    expect(JSON.stringify(logs)).not.toContain('@example.org')
  })

  it('never throws for staff notifications, even if the recipient lookup fails', async () => {
    const { notifyStaffOfResubmission } = await import('@/lib/notifications')
    const { payload } = fakePayload({ findThrows: true })

    await expect(notifyStaffOfResubmission(payload as never, submission)).resolves.toMatchObject({ sent: 0 })
  })

  it('does throw for account invites, so the failure is recorded for retry', async () => {
    const { sendAccountInvite } = await import('@/lib/notifications')
    const { payload } = fakePayload({ failFor: ['new@example.org'] })

    await expect(
      sendAccountInvite(payload as never, { email: 'new@example.org' } as never, 'https://x', new Date()),
    ).rejects.toThrow(/not verified/)
  })

  it('never logs revision tokens', async () => {
    const { sendRevisionRequest } = await import('@/lib/notifications')
    const { payload, logs } = fakePayload()

    await sendRevisionRequest(payload as never, submission, 'https://oddtopsies.example/revise/SECRET-TOKEN', 'x', new Date())

    expect(JSON.stringify(logs)).not.toContain('SECRET-TOKEN')
  })
})

describe('public submission', () => {
  function form(overrides: Record<string, string | File | File[] | null> = {}) {
    const data = new FormData()
    const fields: Record<string, string | File | File[] | null> = {
      title: 'Paper',
      abstract: 'Abstract',
      focusArea: '1',
      correspondingAuthorName: 'Author',
      correspondingAuthorEmail: 'author@example.org',
      leadAuthorName: 'Lead',
      submissionType: 'upload',
      submissionKey: 'key-1234567890abcdef',
      featuredImage: new File(['img'], 'featured.png', { type: 'image/png' }),
      manuscriptPDF: new File(['pdf'], 'paper.pdf', { type: 'application/pdf' }),
      ...overrides,
    }

    for (const [name, value] of Object.entries(fields)) {
      if (value === null) continue
      for (const item of Array.isArray(value) ? value : [value]) data.append(name, item)
    }

    return data
  }

  function submissionPayload({ existing = null as unknown, createSubmissionError = null as Error | null } = {}) {
    const media: number[] = []
    const deleted: number[] = []
    let nextID = 100

    const payload = {
      find: vi.fn(async () => ({ docs: existing ? [existing] : [] })),
      create: vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
        if (collection === 'media') {
          const id = nextID++
          media.push(id)
          return { id }
        }
        if (createSubmissionError) throw createSubmissionError
        return { id: 1, ...data }
      }),
      delete: vi.fn(async ({ id }: { id: number }) => deleted.push(id)),
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    }

    return { payload, media, deleted }
  }

  it('rejects an email Payload would refuse before uploading anything', async () => {
    const { createPublicSubmission } = await import('@/lib/submissions')
    const { payload, media } = submissionPayload()

    // Browsers accept this; Payload's validator does not (the production failure).
    await expect(createPublicSubmission(payload as never, form({ correspondingAuthorEmail: 'author@example' }))).rejects.toMatchObject({
      name: 'SubmissionError',
      field: 'correspondingAuthorEmail',
    })
    expect(media).toHaveLength(0)
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('removes this attempt’s uploads when saving the submission fails', async () => {
    const { createPublicSubmission } = await import('@/lib/submissions')
    const { payload, media, deleted } = submissionPayload({
      createSubmissionError: Object.assign(new Error('The following field is invalid: Title'), { name: 'ValidationError' }),
    })

    await expect(createPublicSubmission(payload as never, form())).rejects.toMatchObject({ name: 'SubmissionError' })
    expect(media).toHaveLength(2)
    expect(deleted.sort()).toEqual(media.sort())
  })

  it('returns the existing submission on a retry instead of creating a duplicate', async () => {
    const { createPublicSubmission } = await import('@/lib/submissions')
    const { payload, media } = submissionPayload({ existing: { id: 9, title: 'Paper' } })

    const result = await createPublicSubmission(payload as never, form())

    expect(result).toMatchObject({ duplicate: true, submission: { id: 9 } })
    expect(media).toHaveLength(0)
  })

  it('treats a simultaneous double-submit (unique key clash) as the same submission', async () => {
    const { createPublicSubmission } = await import('@/lib/submissions')
    const { payload, deleted } = submissionPayload({
      createSubmissionError: new Error('duplicate key value violates unique constraint "submissions_submission_key_idx"'),
    })
    payload.find.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [{ id: 9 }] })

    const result = await createPublicSubmission(payload as never, form())

    expect(result).toMatchObject({ duplicate: true, submission: { id: 9 } })
    expect(deleted).toHaveLength(2)
  })

  it('saves a valid submission with its key', async () => {
    const { createPublicSubmission } = await import('@/lib/submissions')
    const { payload } = submissionPayload()

    const result = await createPublicSubmission(payload as never, form())

    expect(result.duplicate).toBe(false)
    expect(payload.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collection: 'submissions',
        data: expect.objectContaining({ submissionKey: 'key-1234567890abcdef', workflowStatus: 'submitted' }),
      }),
    )
  })
})

describe('email validation', () => {
  it('matches Payload’s rule', async () => {
    const { isValidEmail } = await import('@/lib/validation')

    expect(isValidEmail('name@example.org')).toBe(true)
    expect(isValidEmail('first.last+tag@sub.example.co.uk')).toBe(true)
    expect(isValidEmail('name@example')).toBe(false)
    expect(isValidEmail('name@@example.org')).toBe(false)
    expect(isValidEmail('na me@example.org')).toBe(false)
    expect(isValidEmail('name@example..org')).toBe(false)
  })
})
