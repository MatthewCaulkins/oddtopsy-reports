import { sql } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'
import config from '@/payload.config'

import { getAuthConfig } from '@/lib/auth/config'

/*
 * Phase 2 cleanup for Cognito-only deployments: removes every stored
 * Payload password hash, salt and reset token, clears lockout counters,
 * and ends all Payload password sessions. The schema is untouched, so
 * local development keeps working with passwords.
 *
 * Refuses to run while password sign-in is enabled (e.g. locally), so it
 * cannot wipe passwords that are still in use.
 */

if (getAuthConfig().password) {
  console.error('Refusing to run: AUTH_PROVIDERS still includes password sign-in.')
  process.exit(1)
}

const payload = await getPayload({ config })

type Executor = { execute: (query: unknown) => Promise<{ rows: Record<string, number>[] }> }
const db = (payload.db as unknown as { drizzle: Executor }).drizzle

const count = async () =>
  (
    await db.execute(sql`
      select
        (select count(*)::int from users where hash is not null or salt is not null) as passwords,
        (select count(*)::int from users where reset_password_token is not null) as reset_tokens,
        (select count(*)::int from users_sessions) as sessions
    `)
  ).rows[0]

console.log(`CLEANUP before ${JSON.stringify(await count())}`)

await db.execute(sql`
  update users set
    hash = null,
    salt = null,
    reset_password_token = null,
    reset_password_expiration = null,
    login_attempts = 0,
    lock_until = null
`)

await db.execute(sql`delete from users_sessions`)

console.log(`CLEANUP after ${JSON.stringify(await count())}`)

process.exit(0)
