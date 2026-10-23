// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Submission } from '@/payload-types'

/*
 * Offline tests for article slugs, sign-in return paths, publication
 * notifications and Cognito account deletion.
 */

process.env.SITE_URL = 'https://oddtopsies.example'

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('@aws-sdk/client-cognito-identity-provider')
})

describe('article slugs', () => {
  it('builds readable slugs from titles', async () => {
    const { slugify } = await import('@/lib/slugs')

    expect(slugify('Unusual Anatomical Variation')).toBe('unusual-anatomical-variation')
    expect(slugify('  Situs Inversus: A Case Report!  ')).toBe('situs-inversus-a-case-report')
    expect(slugify('Médiastinal lipomatosis')).toBe('mediastinal-lipomatosis')
    expect(slugify("Surgeon's Variant")).toBe('surgeons-variant')
    expect(slugify('2026')).toBe('article-2026')
    expect(slugify('***')).toBe('article')
  })

  it('trims long titles at a word boundary', async () => {
    const { slugify } = await import('@/lib/slugs')
    const slug = slugify('word '.repeat(40))

    expect(slug.length).toBeLessThanOrEqual(80)
    expect(slug.endsWith('-')).toBe(false)
    expect(slug.endsWith('word')).toBe(true)
  })

  function slugPayload(existing: { id: number; slug: string }[]) {
    return { find: vi.fn(async () => ({ docs: existing })) }
  }

  it('adds predictable suffixes for repeated titles', async () => {
    const { uniqueSlug } = await import('@/lib/slugs')

    expect(await uniqueSlug(slugPayload([]) as never, 'Rare Finding')).toBe('rare-finding')
    expect(await uniqueSlug(slugPayload([{ id: 1, slug: 'rare-finding' }]) as never, 'Rare Finding')).toBe('rare-finding-2')
    expect(
      await uniqueSlug(
        slugPayload([
          { id: 1, slug: 'rare-finding' },
          { id: 2, slug: 'rare-finding-2' },
          { id: 3, slug: 'rare-finding-3' },
        ]) as never,
        'Rare Finding',
      ),
    ).toBe('rare-finding-4')
  })

  it('ignores lookalike slugs and the paper itself', async () => {
    const { uniqueSlug } = await import('@/lib/slugs')

    // "like" also matches these; they are not the same base.
    expect(await uniqueSlug(slugPayload([{ id: 1, slug: 'rare-findings' }, { id: 2, slug: 'very-rare-finding' }]) as never, 'Rare Finding')).toBe('rare-finding')
    expect(await uniqueSlug(slugPayload([{ id: 5, slug: 'rare-finding' }]) as never, 'Rare Finding', { excludeID: 5 })).toBe('rare-finding')
  })

  it('validates hand-entered slugs', async () => {
    const { isValidSlug } = await import('@/lib/slugs')

    expect(isValidSlug('a-good-slug')).toBe(true)
    expect(isValidSlug('123')).toBe(false)
    expect(isValidSlug('Bad Slug')).toBe(false)
    expect(isValidSlug('-leading')).toBe(false)
  })
})

describe('sign-in return paths', () => {
  it('returns home by default and to protected pages when sent from one', async () => {
    process.env.AUTH_PROVIDERS = 'password'
    const { signInURL } = await import('@/lib/auth/returnTo')

    expect(signInURL()).toBe('/login')
    expect(signInURL('/editorial/users')).toBe('/login?next=%2Feditorial%2Fusers')
    // Off-site or protocol-relative targets are never used.
    expect(signInURL('//evil.example')).toBe('/login')
    expect(signInURL('https://evil.example/x')).toBe('/login')
  })

  it('goes straight to Cognito when password sign-in is off', async () => {
    Object.assign(process.env, {
      AUTH_PROVIDERS: 'cognito',
      COGNITO_USER_POOL_ID: 'us-east-1_X',
      COGNITO_CLIENT_ID: 'c',
      COGNITO_CLIENT_SECRET: 's',
      COGNITO_DOMAIN: 'auth.example.org',
    })
    const { signInURL } = await import('@/lib/auth/returnTo')

    expect(signInURL()).toBe('/auth/login?next=%2F')
    expect(signInURL('/editorial')).toBe('/auth/login?next=%2Feditorial')

    process.env.AUTH_PROVIDERS = 'password'
  })
})

describe('publication and receipt notifications', () => {
  const submission = {
    id: 3,
    title: 'Rare Finding',
    slug: 'rare-finding',
    correspondingAuthor: { name: 'Dr. Author', email: 'author@example.org' },
    createdAt: '2026-10-24T12:00:00.000Z',
  } as unknown as Submission

  function fakePayload(staff: string[]) {
    const sent: { to: string; subject: string; html: string; text: string }[] = []

    return {
      sent,
      payload: {
        find: vi.fn(async () => ({ docs: staff.map((email) => ({ email })) })),
        sendEmail: vi.fn(async (message: (typeof sent)[number]) => {
          sent.push(message)
          return { messageId: 'x' }
        }),
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      },
    }
  }

  it('tells the author their paper is published, with the article link', async () => {
    const { notifyAuthorOfPublication } = await import('@/lib/notifications')
    const { payload, sent } = fakePayload([])

    await notifyAuthorOfPublication(payload as never, submission, 'https://oddtopsies.example/articles/rare-finding')

    expect(sent[0]).toMatchObject({ to: 'author@example.org', subject: 'Published: Rare Finding' })
    expect(sent[0].text).toContain('https://oddtopsies.example/articles/rare-finding')
  })

  it('tells the rest of the editorial team, but not the person who published it', async () => {
    const { notifyStaffOfPublication } = await import('@/lib/notifications')
    const { payload, sent } = fakePayload(['editor@example.org', 'Publisher@Example.org', 'admin@example.org'])

    await notifyStaffOfPublication(payload as never, submission, 'https://x', { email: 'publisher@example.org' })

    expect(sent.map((message) => message.to)).toEqual(['editor@example.org', 'admin@example.org'])
  })

  it('sends the author a receipt for a new submission', async () => {
    const { sendSubmissionReceipt } = await import('@/lib/notifications')
    const { payload, sent } = fakePayload([])

    await sendSubmissionReceipt(payload as never, submission)

    expect(sent[0]).toMatchObject({ to: 'author@example.org', subject: 'Submission received: Rare Finding' })
  })

  it('shows the logo, with alt text for blocked images, beside the name', async () => {
    const { renderEmail } = await import('@/lib/email/template')
    const { html } = renderEmail({ preheader: 'p', heading: 'h' })

    expect(html).toContain('src="https://oddtopsies.example/branding/icon.png"')
    expect(html).toContain('alt="Oddtopsy logo"')
    expect(html).toContain('>Oddtopsy Reports</span>')
  })
})

describe('Cognito account deletion', () => {
  async function loadWith(send: (command: unknown) => Promise<unknown>) {
    vi.doMock('@aws-sdk/client-cognito-identity-provider', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@aws-sdk/client-cognito-identity-provider')>()

      return {
        ...actual,
        CognitoIdentityProviderClient: class {
          send = send
        },
      }
    })

    return import('@/lib/auth/cognitoAdmin')
  }

  const config = { region: 'us-east-1', userPoolId: 'us-east-1_X' } as never

  it('deletes by sub, never by email', async () => {
    const send = vi.fn(async () => ({}))
    const { deleteCognitoUser } = await loadWith(send)

    expect(await deleteCognitoUser(config, 'sub-123')).toBe('deleted')
    expect((send.mock.calls[0] as unknown as [{ input: unknown }])[0].input).toEqual({ UserPoolId: 'us-east-1_X', Username: 'sub-123' })
  })

  it('treats an already-deleted account as done, so a retry completes', async () => {
    const { deleteCognitoUser } = await loadWith(async () => {
      throw Object.assign(new Error('User does not exist.'), { name: 'UserNotFoundException' })
    })

    expect(await deleteCognitoUser(config, 'sub-123')).toBe('already_deleted')
  })

  it('surfaces any other failure so the Payload delete is cancelled', async () => {
    const { deleteCognitoUser } = await loadWith(async () => {
      throw Object.assign(new Error('not authorized'), { name: 'AccessDeniedException' })
    })

    await expect(deleteCognitoUser(config, 'sub-123')).rejects.toThrow(/not authorized/)
  })
})
