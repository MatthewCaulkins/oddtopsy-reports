import type { Where } from 'payload'

import type { Submission, User } from '@/payload-types'

/*
 * Who can see published content.
 *
 * Every media file has an audience: 'staff' (editors and above
 * only) or 'public'. A published paper's audience is passed on to
 * the files it uses.
 *
 * To gate papers to subscribers later: add a 'subscriber' role and
 * a 'subscribers' audience, give papers an audience setting read by
 * getPaperAudience, and return 'subscribers' from getVisitorAudiences
 * for subscribers. The access rules and media syncing already go
 * through these functions.
 */

export const audiences = ['staff', 'public'] as const

export type Audience = (typeof audiences)[number]

export const audienceRank: Record<Audience, number> = {
  staff: 0,
  public: 1,
}

/*
 * Audiences a visitor who is not editorial staff may see.
 */
export function getVisitorAudiences(_user: Pick<User, 'role'> | null | undefined): Audience[] {
  return ['public']
}

/*
 * The audience a published paper is released to.
 */
export function getPaperAudience(_submission: Submission): Exclude<Audience, 'staff'> {
  return 'public'
}

/*
 * Every live paper, regardless of who is looking.
 */
export const publishedPaperWhere: Where = {
  and: [{ workflowStatus: { equals: 'published' } }, { trashed: { not_equals: true } }],
}

/*
 * The papers a visitor who is not editorial staff may read.
 */
export function getReadablePaperWhere(_user: Pick<User, 'role'> | null | undefined): Where {
  return publishedPaperWhere
}
