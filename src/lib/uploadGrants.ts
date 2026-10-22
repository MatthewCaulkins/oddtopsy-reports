import { createSignedValue, readCookie, readSignedValue } from '@/lib/signedCookies'

/*
 * Visitors without an account can still need to see private files:
 * an author's own inline images while writing a submission, or their
 * paper's files while revising it. Those files stay staff-only, so
 * the visitor gets a signed cookie listing the media IDs they may view.
 */

export const uploadGrantCookie = 'oddtopsy-upload-grants'

export const uploadGrantMaxAge = 24 * 60 * 60

const maxGrantedIDs = 200

type UploadGrant = {
  ids: number[]
}

export function getUploadGrants(headers: Headers): number[] {
  const grant = readSignedValue<UploadGrant>(readCookie(headers, uploadGrantCookie))

  if (!grant || !Array.isArray(grant.ids)) return []

  return grant.ids.filter((id) => Number.isInteger(id) && id > 0)
}

export function createUploadGrantValue(headers: Headers, newIDs: number[]) {
  const ids = [...new Set([...getUploadGrants(headers), ...newIDs])].slice(-maxGrantedIDs)

  return createSignedValue<UploadGrant>({ ids }, uploadGrantMaxAge)
}
