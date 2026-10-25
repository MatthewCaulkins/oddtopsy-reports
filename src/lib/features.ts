/*
 * Feature switches, read from the environment on the server at request
 * time (every public page is rendered per request), so a feature can be
 * turned on by changing the task definition, without a rebuild.
 */

/*
 * Subscriptions are not built yet. While off, the Subscribe links are
 * hidden, /subscribe returns 404 and the sitemap leaves it out. Staff can
 * still edit the Subscribe page content under Editorial → Pages.
 * Set SUBSCRIPTIONS_ENABLED=true to turn them on.
 */
export function subscriptionsEnabled() {
  return process.env.SUBSCRIPTIONS_ENABLED === 'true'
}
