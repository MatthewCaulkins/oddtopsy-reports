'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { createPublicSubmission, SubmissionError } from '@/lib/submissions'
import { notifyStaffOfSubmission, sendSubmissionReceipt } from '@/lib/notifications'

export type SubmitPaperResult = { error: string; field?: string } | void

/*
 * Expected problems come back to the form (which keeps what the author
 * entered) instead of throwing to the error page. The staff email goes
 * out after the response, so it can never make a saved submission look
 * like a failure.
 */
export async function submitPaper(formData: FormData): Promise<SubmitPaperResult> {
  const payload = await getPayload({ config })

  let result

  try {
    result = await createPublicSubmission(payload, formData)
  } catch (error) {
    if (error instanceof SubmissionError) {
      return { error: error.message, field: error.field }
    }

    throw error
  }

  if (!result.duplicate) {
    const { submission } = result

    after(async () => {
      await notifyStaffOfSubmission(payload, submission)
      await sendSubmissionReceipt(payload, submission)
    })
  }

  redirect('/submit/thank-you')
}
