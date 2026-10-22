import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { getSubmissionMedia, resolveMediaIDs } from '@/lib/mediaVisibility'
import {
  createRevisionSessionValue,
  findSubmissionByRevisionToken,
  revisionSessionCookie,
  revisionSessionMaxAge,
} from '@/lib/revisionAccess'
import { signedCookieOptions } from '@/lib/signedCookies'
import { createUploadGrantValue, uploadGrantCookie, uploadGrantMaxAge } from '@/lib/uploadGrants'

type Context = {
  params: Promise<{
    token: string
  }>
}

/*
 * The link emailed to an author. Exchanges the token for a revision
 * session, lets the author see their paper's staff-only files, and
 * redirects to /revise so the token leaves the address bar.
 */
export async function GET(request: Request, { params }: Context) {
  const { token } = await params
  const payload = await getPayload({ config })

  const submission = await findSubmissionByRevisionToken(payload, token)

  // Relative redirect: behind the load balancer request.url may carry the internal host.
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: submission ? '/revise' : '/revise?expired=1',
      'Referrer-Policy': 'no-referrer',
    },
  })

  if (submission) {
    response.cookies.set(revisionSessionCookie, createRevisionSessionValue(submission), {
      ...signedCookieOptions,
      maxAge: revisionSessionMaxAge,
    })

    const mediaIDs = await resolveMediaIDs(payload, getSubmissionMedia(submission))

    response.cookies.set(uploadGrantCookie, createUploadGrantValue(request.headers, mediaIDs), {
      ...signedCookieOptions,
      maxAge: uploadGrantMaxAge,
    })
  }

  return response
}
