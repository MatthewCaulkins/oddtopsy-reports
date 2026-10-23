import { getPayload } from 'payload'
import config from '@/payload.config'

import { getStaffEmails, sendTestNotification } from '@/lib/notifications'

/*
 * Sends a test notification through the app's own email path (not
 * Cognito's). Usage:
 *
 *   tsx src/scripts/sendTestEmail.ts               # every active admin
 *   tsx src/scripts/sendTestEmail.ts you@example.org
 *
 * Exits non-zero if any message fails, and prints only counts.
 */

const payload = await getPayload({ config })

const recipients = process.argv[2] ? [process.argv[2]] : await getStaffEmails(payload, ['admin'])

const result = await sendTestNotification(payload, recipients)

console.log(`EMAIL TEST ${JSON.stringify(result)}`)

process.exit(result.failed > 0 || result.sent === 0 ? 1 : 0)
