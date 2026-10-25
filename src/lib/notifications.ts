import type { Payload } from 'payload'

import type { Role } from '@/access/roles'
import type { AccessRequest, Submission, User } from '@/payload-types'
import { renderEmail, type EmailContent } from '@/lib/email/template'

/*
 * Outgoing notification emails.
 *
 * - Callers send these only after the database change they describe has
 *   committed, and outside the user's request where possible (next/server
 *   `after`), so an email problem never fails a saved submission or review.
 * - Each recipient gets their own message: staff addresses are not shared,
 *   and one bad address does not stop the rest.
 * - Every attempt is logged with the event name, counts and SES message
 *   IDs. Logs never include tokens, revision links or manuscript content;
 *   recipients appear only as a count.
 */

export const siteURL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')

export type NotificationEvent =
  | 'system.test'
  | 'access_request.received'
  | 'access_request.rejected'
  | 'account.invite'
  | 'submission.received'
  | 'submission.receipt'
  | 'submission.revision_requested'
  | 'submission.resubmitted'
  | 'submission.accepted'
  | 'submission.rejected'
  | 'submission.published'
  | 'submission.published.staff'

export type DeliveryResult = {
  event: NotificationEvent
  recipients: number
  sent: number
  failed: number
}

const staffRoles: Role[] = ['editor', 'manager', 'admin']

export async function getStaffEmails(payload: Payload, roles: Role[]) {
  const staff = await payload.find({
    collection: 'users',
    where: {
      and: [{ role: { in: roles } }, { accountStatus: { equals: 'active' } }],
    },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  return [...new Set(staff.docs.map((user) => user.email).filter(Boolean))]
}

/*
 * Staff recipients minus whoever caused the event; nobody is told about
 * their own action.
 */
async function staffExcept(payload: Payload, roles: Role[], actor?: { email?: string | null } | null) {
  const actorEmail = actor?.email?.toLowerCase()

  return (await getStaffEmails(payload, roles)).filter((email) => email.toLowerCase() !== actorEmail)
}

function errorSummary(error: unknown) {
  return error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) }
}

/*
 * Sends one message per recipient and logs the outcome. Never throws
 * unless `throwOnFailure` is set (used for invites, whose failure is
 * recorded on the access request).
 */
async function deliver(
  payload: Payload,
  event: NotificationEvent,
  getRecipients: string[] | (() => Promise<string[]>),
  subject: string,
  content: EmailContent,
  { throwOnFailure = false } = {},
): Promise<DeliveryResult> {
  let recipients: string[]

  try {
    recipients = typeof getRecipients === 'function' ? await getRecipients() : getRecipients
  } catch (error) {
    payload.logger.error({ event, errors: [errorSummary(error)] }, `Notification ${event}: could not look up recipients`)

    if (throwOnFailure) throw error

    return { event, recipients: 0, sent: 0, failed: 0 }
  }

  const result: DeliveryResult = { event, recipients: recipients.length, sent: 0, failed: 0 }

  if (recipients.length === 0) {
    payload.logger.warn({ event }, 'Notification has no recipients')
    return result
  }

  const { html, text } = renderEmail(content)
  const messageIds: string[] = []
  const errors: ReturnType<typeof errorSummary>[] = []

  for (const to of recipients) {
    try {
      const response = (await payload.sendEmail({ to, subject, html, text })) as { messageId?: string } | undefined

      result.sent++
      if (response?.messageId) messageIds.push(response.messageId)
    } catch (error) {
      result.failed++
      errors.push(errorSummary(error))
    }
  }

  if (result.failed > 0) {
    payload.logger.error({ ...result, messageIds, errors }, `Notification ${event}: ${result.failed} of ${result.recipients} failed`)

    if (throwOnFailure) {
      throw new Error(errors[0]?.message || 'Email could not be sent.')
    }
  } else {
    payload.logger.info({ ...result, messageIds }, `Notification ${event} sent`)
  }

  return result
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString('en-US', { dateStyle: 'long' })
}

/*
 * Operational check of the email path (src/scripts/sendTestEmail.ts).
 */
export async function sendTestNotification(payload: Payload, recipients: string[]) {
  return deliver(payload, 'system.test', recipients, 'Oddtopsy Reports email test', {
    preheader: 'A test of the editorial notification system.',
    heading: 'Email delivery test',
    paragraphs: [
      'This is a test of the Oddtopsy Reports editorial notification system. If you are reading it, application emails are being delivered.',
    ],
    details: [{ label: 'Sent', value: new Date().toUTCString() }],
    action: { label: 'Open Editorial', url: `${siteURL}/editorial` },
  })
}

/*
 * Staff notifications
 */

export async function notifyStaffOfAccessRequest(payload: Payload, request: AccessRequest) {
  return deliver(
    payload,
    'access_request.received',
    () => getStaffEmails(payload, ['manager', 'admin']),
    `Access request: ${request.name}`,
    {
      preheader: `${request.name} has asked for an editorial account.`,
      heading: 'New editorial access request',
      paragraphs: ['Someone has asked for an editorial account on Oddtopsy Reports. Managers and admins can approve or reject it.'],
      details: [
        { label: 'Name', value: request.name },
        { label: 'Email', value: request.email },
        { label: 'Affiliation', value: request.affiliation },
        { label: 'Requested', value: formatDate(request.createdAt) },
      ],
      action: { label: 'Review the request', url: `${siteURL}/editorial/users` },
    },
  )
}

export async function notifyStaffOfSubmission(payload: Payload, submission: Submission) {
  return deliver(
    payload,
    'submission.received',
    () => getStaffEmails(payload, staffRoles),
    `New submission: ${submission.title}`,
    {
      preheader: `"${submission.title}" was submitted for review.`,
      heading: 'New manuscript submitted',
      paragraphs: ['A new paper has been submitted and is waiting for editorial review.'],
      details: [
        { label: 'Title', value: submission.title },
        { label: 'Corresponding author', value: submission.correspondingAuthor?.name },
        { label: 'Lead author', value: submission.leadAuthor?.name },
        { label: 'Format', value: submission.submissionType === 'editor' ? 'Written in the editor' : 'PDF upload' },
        { label: 'Submitted', value: formatDate(submission.createdAt) },
      ],
      action: { label: 'Open in Editorial', url: `${siteURL}/editorial/submissions/${submission.id}` },
    },
  )
}

export async function notifyStaffOfResubmission(payload: Payload, submission: Submission) {
  return deliver(
    payload,
    'submission.resubmitted',
    () => getStaffEmails(payload, staffRoles),
    `Revised submission: ${submission.title}`,
    {
      preheader: `The author has resubmitted "${submission.title}".`,
      heading: 'Revised manuscript submitted',
      paragraphs: ['The corresponding author has submitted their revisions. The paper is now Under Review.'],
      details: [
        { label: 'Title', value: submission.title },
        { label: 'Corresponding author', value: submission.correspondingAuthor?.name },
      ],
      action: { label: 'Review the revision', url: `${siteURL}/editorial/submissions/${submission.id}` },
    },
  )
}

export async function notifyStaffOfPublication(
  payload: Payload,
  submission: Submission,
  articleURL: string,
  actor: { email?: string | null } | null,
) {
  return deliver(
    payload,
    'submission.published.staff',
    () => staffExcept(payload, staffRoles, actor),
    `Published: ${submission.title}`,
    {
      preheader: `"${submission.title}" is now live on Oddtopsy Reports.`,
      heading: 'Paper published',
      paragraphs: ['A paper has been approved and published on the site.'],
      details: [
        { label: 'Title', value: submission.title },
        { label: 'Corresponding author', value: submission.correspondingAuthor?.name },
      ],
      action: { label: 'View the article', url: articleURL },
    },
  )
}

/*
 * Author and applicant messages
 */

export async function sendSubmissionReceipt(payload: Payload, submission: Submission) {
  const author = submission.correspondingAuthor

  return deliver(payload, 'submission.receipt', [author.email], `Submission received: ${submission.title}`, {
    preheader: `We've received "${submission.title}".`,
    heading: 'We received your submission',
    greeting: `Dear ${author.name},`,
    paragraphs: [
      `Thank you for submitting "${submission.title}" to Oddtopsy Reports. The editorial team will review it and contact you at this address if they need anything.`,
      'You do not need to do anything else for now.',
    ],
    details: [
      { label: 'Title', value: submission.title },
      { label: 'Received', value: formatDate(submission.createdAt) },
    ],
    closing: ['If you have questions, reply to this email.'],
  })
}

export async function notifyAuthorOfPublication(payload: Payload, submission: Submission, articleURL: string) {
  const author = submission.correspondingAuthor

  return deliver(payload, 'submission.published', [author.email], `Published: ${submission.title}`, {
    preheader: `"${submission.title}" has been published on Oddtopsy Reports.`,
    heading: 'Your paper has been published',
    greeting: `Dear ${author.name},`,
    paragraphs: [
      `Congratulations! The editors have approved "${submission.title}", and it is now published on Oddtopsy Reports.`,
    ],
    action: { label: 'View your article', url: articleURL },
    closing: ['Thank you for contributing to Oddtopsy Reports.'],
  })
}

export async function sendRevisionRequest(
  payload: Payload,
  submission: Submission,
  revisionURL: string,
  message: string,
  expiresAt: Date,
) {
  const author = submission.correspondingAuthor

  return deliver(payload, 'submission.revision_requested', [author.email], `Revisions requested: ${submission.title}`, {
    preheader: `The editors have requested revisions to "${submission.title}".`,
    heading: 'Revisions requested',
    greeting: `Dear ${author.name},`,
    paragraphs: [
      `Thank you for submitting "${submission.title}" to Oddtopsy Reports. The editors have reviewed it and are asking for some revisions before it can move forward.`,
    ],
    quote: { label: "The editors' request", text: message },
    action: { label: 'Revise your submission', url: revisionURL },
    closing: [
      `This link is personal to you and works until ${formatDate(expiresAt)}, or until you resubmit. Please don't forward it.`,
      'If you have questions, reply to this email.',
    ],
  })
}

/*
 * The editors' decision on a submission. The message is written for the
 * author (it is required for a rejection, optional for an acceptance).
 */
export async function notifyAuthorOfDecision(
  payload: Payload,
  submission: Submission,
  decision: 'accepted' | 'rejected',
  message?: string,
) {
  const author = submission.correspondingAuthor
  const quote = message ? { label: "The editors' comments", text: message } : undefined

  if (decision === 'accepted') {
    return deliver(payload, 'submission.accepted', [author.email], `Accepted: ${submission.title}`, {
      preheader: `"${submission.title}" has been accepted for publication.`,
      heading: 'Your paper has been accepted',
      greeting: `Dear ${author.name},`,
      paragraphs: [
        `We are pleased to tell you that the editors have accepted "${submission.title}" for publication in Oddtopsy Reports.`,
      ],
      quote,
      closing: [
        'We will email you again when it is published. You do not need to do anything in the meantime.',
        'If you have questions, reply to this email.',
      ],
    })
  }

  return deliver(payload, 'submission.rejected', [author.email], `Decision on your submission: ${submission.title}`, {
    preheader: `The editors' decision on "${submission.title}".`,
    heading: 'Decision on your submission',
    greeting: `Dear ${author.name},`,
    paragraphs: [
      `Thank you for submitting "${submission.title}" to Oddtopsy Reports. After review, the editors are not able to accept it for publication.`,
    ],
    quote,
    closing: ['We appreciate your interest in the journal. If you have questions, reply to this email.'],
  })
}

export async function notifyApplicantOfRejection(payload: Payload, request: AccessRequest) {
  // The reviewer's note is an internal record and is deliberately not included.
  return deliver(payload, 'access_request.rejected', [request.email], 'Your Oddtopsy Reports access request', {
    preheader: 'An update on your request for an editorial account.',
    heading: 'About your access request',
    greeting: `Dear ${request.name},`,
    paragraphs: [
      'Thank you for your interest in joining the Oddtopsy Reports editorial team. After review, we are not able to approve an editorial account at this time.',
      'Editorial accounts are limited to the journal’s editors and reviewers. You do not need an account to submit a paper; anyone can submit through the Submit page.',
    ],
    action: { label: 'Submit a paper', url: `${siteURL}/submit` },
    closing: ['If you believe this was a mistake, reply to this email.'],
  })
}

/*
 * Set-password invite for Payload password sign-in (local development).
 * Production uses Cognito's own invitation. Throws on failure so the
 * caller can record it against the access request and retry.
 */
export async function sendAccountInvite(payload: Payload, user: User, setupURL: string, expiresAt: Date) {
  const name = user.profile?.displayName || user.email

  return deliver(
    payload,
    'account.invite',
    [user.email],
    'Set up your Oddtopsy Reports account',
    {
      preheader: 'Your editorial access was approved. Set your password to get started.',
      heading: 'Your editorial account is ready',
      greeting: `Dear ${name},`,
      paragraphs: ['Your request for an Oddtopsy Reports editorial account has been approved. Choose a password to finish setting it up.'],
      action: { label: 'Set up your account', url: setupURL },
      closing: [`This link works until ${formatDate(expiresAt)}.`, 'If you did not request an account, you can ignore this email.'],
    },
    { throwOnFailure: true },
  )
}
