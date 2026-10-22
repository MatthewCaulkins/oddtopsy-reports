'use server'

import { headers as getHeaders } from 'next/headers'
import { after } from 'next/server'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { normalizeEmail, submitAccessRequest } from '@/lib/accessRequests'
import { consumeRateLimit, getClientIP } from '@/lib/rateLimit'
import { readSignedValue } from '@/lib/signedCookies'

export type RequestAccessState = {
  submitted?: boolean
  error?: string
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Real people take a few seconds to fill in three fields; bots usually don't.
const minimumFillTimeMs = 3000

const requestsPerHourPerIP = 10

/*
 * Every accepted submission gets the same response, and the actual
 * work runs after the response is sent, so neither the message nor
 * the timing reveals whether the email already has an account or a
 * pending request. Submissions that fail the abuse checks get the same
 * response too, so bots learn nothing.
 */
export async function requestAccess(
  _previousState: RequestAccessState,
  formData: FormData,
): Promise<RequestAccessState> {
  const name = String(formData.get('name') || '').trim()
  const email = normalizeEmail(String(formData.get('email') || ''))
  const affiliation = String(formData.get('affiliation') || '').trim()

  if (!name || name.length > 200) {
    return { error: 'Please enter your name.' }
  }

  if (!emailPattern.test(email) || email.length > 254) {
    return { error: 'Please enter a valid email address.' }
  }

  if (!affiliation || affiliation.length > 300) {
    return { error: 'Please enter your affiliation.' }
  }

  const headers = await getHeaders()
  const form = readSignedValue<{ startedAt: number }>(String(formData.get('formToken') || ''))

  const looksAutomated =
    Boolean(formData.get('website')) || !form || Date.now() - form.startedAt < minimumFillTimeMs

  const withinLimit = consumeRateLimit(
    `request-access:${getClientIP(headers)}`,
    requestsPerHourPerIP,
    60 * 60 * 1000,
  )

  if (!looksAutomated && withinLimit) {
    after(async () => {
      const payload = await getPayload({ config })

      try {
        await submitAccessRequest(payload, { name, email, affiliation })
      } catch (error) {
        payload.logger.error({ err: error }, 'Failed to record access request')
      }
    })
  }

  return { submitted: true }
}
