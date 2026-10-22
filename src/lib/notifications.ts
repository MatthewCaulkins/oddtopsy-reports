import type { Payload } from 'payload'

import type { Role } from '@/access/roles'
import type { AccessRequest, Submission, User } from '@/payload-types'

/*
 * Outgoing notification emails. A failed email is logged but never
 * breaks the request, review, or revision that triggered it.
 */

export const siteURL =(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')

function escapeHTML(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHTML(paragraph).replaceAll('\n', '<br />')}</p>`)
    .join('')
}

async function getStaffEmails(payload: Payload, roles: Role[]) {
  const staff = await payload.find({
    collection: 'users',
    where: {
      and: [{ role: { in: roles } }, { accountStatus: { equals: 'active' } }],
    },
    pagination: false,
    depth: 0,
  })

  return staff.docs.map((user) => user.email).filter(Boolean)
}

async function send(
  payload: Payload,
  description: string,
  message: { to: string | string[]; subject: string; text: string; html: string },
) {
  if (Array.isArray(message.to) && message.to.length === 0) return

  try {
    await payload.sendEmail(message)
  } catch (error) {
    payload.logger.error({ err: error }, `Failed to send ${description} email`)
  }
}

export async function notifyStaffOfAccessRequest(payload: Payload, request: AccessRequest) {
  const reviewURL = `${siteURL}/editorial/users`
  const affiliation = request.affiliation ? ` from ${request.affiliation}` : ''

  await send(payload, 'access request', {
    to: await getStaffEmails(payload, ['manager', 'admin']),
    subject: `New access request: ${request.name}`,
    text: `${request.name} (${request.email})${affiliation} has requested an editorial account.\n\nReview pending requests: ${reviewURL}`,
    html: `<p><strong>${escapeHTML(request.name)}</strong> (${escapeHTML(request.email)})${escapeHTML(affiliation)} has requested an editorial account.</p><p><a href="${reviewURL}">Review pending requests</a></p>`,
  })
}

/*
 * Unlike the notifications above, this throws on failure so the
 * caller can record it against the access request and retry.
 */
export async function sendAccountInvite(
  payload: Payload,
  user: User,
  setupURL: string,
  expiresAt: Date,
) {
  const name = user.profile?.displayName || user.email
  const expires = expiresAt.toLocaleDateString('en-US', { dateStyle: 'long' })

  await payload.sendEmail({
    to: user.email,
    subject: 'Your Oddtopsy Reports editorial account',
    text: `Dear ${name},\n\nYour request for an Oddtopsy Reports editorial account has been approved.\n\nSet up your account here (link valid until ${expires}):\n${setupURL}\n\nIf you did not request an account, you can ignore this email.`,
    html: `<p>Dear ${escapeHTML(name)},</p><p>Your request for an Oddtopsy Reports editorial account has been approved.</p><p><a href="${setupURL}">Set up your account</a> (link valid until ${expires}).</p><p>If you did not request an account, you can ignore this email.</p>`,
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
  const expires = expiresAt.toLocaleDateString('en-US', { dateStyle: 'long' })

  await send(payload, 'revision request', {
    to: author.email,
    subject: `Revisions requested: ${submission.title}`,
    text: `Dear ${author.name},\n\nThe editors of Oddtopsy Reports have requested revisions to "${submission.title}".\n\n${message}\n\nYou can review the request and update your submission here (link valid until ${expires}):\n${revisionURL}\n\nThis link is personal to you; please do not share it.`,
    html: `<p>Dear ${escapeHTML(author.name)},</p><p>The editors of Oddtopsy Reports have requested revisions to <strong>${escapeHTML(submission.title)}</strong>.</p>${paragraphs(message)}<p><a href="${revisionURL}">Review the request and update your submission</a> (link valid until ${expires}).</p><p>This link is personal to you; please do not share it.</p>`,
  })
}

export async function notifyStaffOfResubmission(payload: Payload, submission: Submission) {
  const reviewURL = `${siteURL}/editorial/submissions/${submission.id}`

  await send(payload, 'revision resubmitted', {
    to: await getStaffEmails(payload, ['editor', 'manager', 'admin']),
    subject: `Revised submission: ${submission.title}`,
    text: `${submission.correspondingAuthor.name} has resubmitted "${submission.title}" after revisions. It is now Under Review.\n\nReview it: ${reviewURL}`,
    html: `<p>${escapeHTML(submission.correspondingAuthor.name)} has resubmitted <strong>${escapeHTML(submission.title)}</strong> after revisions. It is now Under Review.</p><p><a href="${reviewURL}">Review it</a></p>`,
  })
}
