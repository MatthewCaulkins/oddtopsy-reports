import { cookies } from 'next/headers'

import { Header } from '@/app/(frontend)/components/Header'
import { Footer } from '@/app/(frontend)/components/Footer'
import { EditorialNav } from '../../../components/EditorialNav'

import { getAuthConfig } from '@/lib/auth/config'
import { mfaAccessCookie, smsEnrollmentCookie, verifyStepUpToken } from '@/lib/auth/cognitoMfa'
import { requireRole } from '@/lib/requireRole'
import { buildSmsMfaView, readEnrollment } from '@/lib/smsMfa'

import { SmsMfaManager } from './SmsMfaManager'

export const metadata = { title: 'MFA Agreement | Oddtopsy Reports' }

const reauthMessages: Record<string, string> = {
  failed: 'The confirmation sign-in did not complete, so nothing was changed. Try again; if it keeps failing, ask an administrator.',
  stale:
    'You are signed in, but that sign-in cannot be used to change MFA settings (it was not a fresh sign-in, or it lacked the required permission). Try again; if it keeps happening, ask an administrator.',
}

type Props = {
  searchParams: Promise<{ reauth?: string }>
}

/*
 * The signed-in editor's own SMS MFA agreement. Who they are comes only
 * from the session; changes are server actions (./actions.ts).
 */
export default async function AccountSecurityPage({ searchParams }: Props) {
  const { payload, user } = await requireRole('editor')
  const { reauth } = await searchParams

  const cognito = getAuthConfig().cognito
  const jar = await cookies()

  const stepUp = cognito && user.cognitoSub ? await verifyStepUpToken(cognito, jar.get(mfaAccessCookie)?.value) : null

  const view = await buildSmsMfaView({
    payload,
    user,
    cognito,
    stepUpExpiresAt: stepUp && stepUp.sub === user.cognitoSub ? stepUp.expiresAt : null,
    enrollment: readEnrollment(jar.get(smsEnrollmentCookie)?.value, user.cognitoSub),
  })

  return (
    <main className="site">
      <Header />

      <EditorialNav user={user} active="security" />

      <section className="page-hero page-editor">
        <h1>MFA Agreement</h1>

        <p>Choose how you receive sign-in verification codes.</p>
      </section>

      <section className="section editorial-dashboard-section">
        <SmsMfaManager
          initialView={view}
          reauthError={reauth ? reauthMessages[reauth] || null : null}
        />
      </section>

      <Footer />
    </main>
  )
}
