'use server'

import { cookies, headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { notifyStaffOfResubmission } from '@/lib/notifications'
import { getRevisionSubmission, revisionSessionCookie } from '@/lib/revisionAccess'
import { buildSubmissionUpdate } from '@/lib/submissionUpdate'

/*
 * The author's resubmission. The submission comes from the signed
 * revision session, never from the form, so an author can only
 * change the paper their link was issued for.
 */
export async function submitRevision(formData: FormData) {
  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const submission = await getRevisionSubmission(payload, headers, 0)

  if (!submission) {
    redirect('/revise?expired=1')
  }

  const data = await buildSubmissionUpdate(payload, submission.id, formData)

  // Leaving Revision Requested also invalidates the revision link.
  const updated = await payload.update({
    collection: 'submissions',
    id: submission.id,
    data: {
      ...data,
      workflowStatus: 'under_review',
    },
  })

  // Saved (and the link is now spent, so a repeat can't resend this); tell staff after the response.
  after(() => notifyStaffOfResubmission(payload, updated))

  const cookieStore = await cookies()
  cookieStore.delete(revisionSessionCookie)

  revalidatePath(`/editorial/submissions/${submission.id}`)

  redirect('/revise?submitted=1')
}
