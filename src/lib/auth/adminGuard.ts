import { sql } from '@payloadcms/db-postgres'
import { APIError, type PayloadRequest } from 'payload'

type Executor = {
  execute: (query: unknown) => Promise<{ rows: { id: number | string }[] }>
}

type DrizzleAdapter = {
  drizzle: Executor
  sessions?: Record<string, { db: Executor }>
}

/*
 * The drizzle handle for the request's transaction, so the row lock
 * below is held until the change that triggered it commits.
 */
async function getExecutor(req: PayloadRequest) {
  const adapter = req.payload.db as unknown as DrizzleAdapter
  const transactionID = req.transactionID instanceof Promise ? await req.transactionID : req.transactionID

  return (transactionID && adapter.sessions?.[String(transactionID)]?.db) || adapter.drizzle
}

/*
 * Throws unless some active admin other than `userID` would remain.
 * Locks the active admin rows (SELECT ... FOR UPDATE) so two admins
 * demoting each other at the same moment cannot both succeed.
 */
export async function assertAnotherActiveAdmin(
  req: PayloadRequest,
  userID: number | string,
  action: string,
) {
  const db = await getExecutor(req)

  const result = await db.execute(
    sql`select "id" from "users" where "role" = 'admin' and "account_status" = 'active' for update`,
  )

  const others = result.rows.filter((row) => String(row.id) !== String(userID))

  if (others.length === 0) {
    throw new APIError(`You cannot ${action} the last active admin.`, 400, null, true)
  }
}
