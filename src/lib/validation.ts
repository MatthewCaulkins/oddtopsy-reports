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
