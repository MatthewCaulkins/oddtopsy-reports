'use client'

import { LogoutButton } from '@/components/LogoutButton'

/*
 * Replaces Payload's nav logout so signing out of /admin also ends a
 * Cognito session, not just the password session.
 */
export default function AdminLogoutButton() {
  return <LogoutButton className="admin-logout-button" />
}
