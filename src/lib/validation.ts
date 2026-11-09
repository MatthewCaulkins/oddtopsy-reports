/*
 * Payload's own email rule (payload/dist/fields/validations.js, 3.88).
 * Browsers accept addresses like "name@host" that Payload rejects, so
 * forms check with this before anything is uploaded or saved.
 */
const emailPattern =
  /^(?!.*\.\.)[\w!#$%&'*+/=?^`{|}~-](?:[\w!#$%&'*+/=?^`{|}~.-]*[\w!#$%&'*+/=?^`{|}~-])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i

export function isValidEmail(value: string) {
  return value.length <= 254 && emailPattern.test(value)
}

/*
 * Phone numbers for SMS verification, in E.164: a plus sign, a country
 * code and up to 15 digits in all. Spaces, dots, dashes and brackets
 * are allowed while typing and removed here; anything else is refused.
 * The same rule runs in the browser (to enable the button) and on the
 * server (which never trusts the browser's answer).
 */
const e164Pattern = /^\+[1-9]\d{7,14}$/

export function normalizePhoneNumber(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40) return null

  const compact = value.trim().replace(/[\s().-]/g, '')

  return e164Pattern.test(compact) ? compact : null
}

/*
 * Enough of a number to recognize it ("ending in 0123") without
 * displaying it in full.
 */
export function phoneNumberHint(value: string | null | undefined) {
  return value ? `ending in ${value.slice(-4)}` : ''
}
