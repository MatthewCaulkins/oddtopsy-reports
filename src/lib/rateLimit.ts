/*
 * Simple in-memory sliding-window limiter.
 * Counts are per server process, so with several app containers
 * each one enforces its own limit. Good enough to blunt casual
 * abuse; move to a shared store if that becomes a problem.
 */

const buckets = new Map<string, number[]>()

const maxBuckets = 10_000

export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()

  if (buckets.size > maxBuckets) {
    for (const [bucketKey, times] of buckets) {
      if (times.every((time) => now - time >= windowMs)) buckets.delete(bucketKey)
    }
  }

  const recent = (buckets.get(key) || []).filter((time) => now - time < windowMs)

  if (recent.length >= limit) {
    buckets.set(key, recent)
    return false
  }

  recent.push(now)
  buckets.set(key, recent)

  return true
}

/*
 * Behind the AWS load balancer the client address is the last
 * entry in X-Forwarded-For; earlier entries can be forged.
 */
export function getClientIP(headers: Headers) {
  const forwardedFor = headers.get('x-forwarded-for')

  if (forwardedFor) {
    const addresses = forwardedFor.split(',').map((address) => address.trim())

    return addresses[addresses.length - 1] || 'unknown'
  }

  return headers.get('x-real-ip') || 'unknown'
}
