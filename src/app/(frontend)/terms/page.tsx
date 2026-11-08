import { Footer } from '../components/Footer'
import { Header } from '../components/Header'

export default async function PrivacyPage() {
  return (
    <main className="site">
      <Header />
      <section className="page-hero">
        <h1>Oddtopsy Reports — SMS Authentication Terms and Conditions</h1>
      </section>

      <section className="section terms">
        <h4>Last updated: November 7, 2026</h4>
        <p>
          Oddtopsy Reports offers optional SMS multifactor authentication (MFA) to authorized
          editorial staff members.
        </p>
        <p>
          When enabled, the service sends one-time verification codes to an editor's registered
          mobile phone number to confirm their identity during account login or other
          security-related activities.
        </p>
        <h4>Enrollment and Consent</h4>
        <p>
          Enrollment is voluntary. Editors may provide verbal consent to an authorized Oddtopsy
          Reports administrator and supply a mobile phone number for authentication purposes.
        </p>
        <p>
          Agreeing to serve as an editor does not automatically constitute consent to receive SMS
          messages. Consent for SMS authentication is obtained separately.
        </p>
        <h4>Message Frequency and Charges</h4>
        <p>
          Messages are sent only when authentication or account verification is required. Message
          frequency varies according to account activity.
        </p>
        <p>
          Oddtopsy Reports does not charge editors for SMS authentication. Standard message and data
          rates from mobile carriers may apply.
        </p>
        <h4>Opting Out</h4>
        <p>
          Editors may decline SMS enrollment or withdraw their consent at any time by contacting{' '}
          <a className="page-link" href="mailto:editorial@oddtopsies.org">
            editorial@oddtopsies.org
          </a>
          .
        </p>
        <p>
          Upon processing an opt-out request, Oddtopsy Reports will disable SMS authentication for
          the affected account and provide an alternative supported authentication method, such as
          email MFA.
        </p>
        <h4>Assistance</h4>
        <p>
          For assistance with authentication messages, account access, or SMS enrollment, contact{' '}
          <a className="page-link" href="mailto:editorial@oddtopsies.org.">
            editorial@oddtopsies.org
          </a>
          .
        </p>
        <p>
          Where supported by the messaging service, recipients may also reply HELP for assistance or
          STOP to request that SMS messages cease. Contacting the editorial team is the reliable
          method for changing account MFA preferences.
        </p>
        <h4>Privacy</h4>
        <p>
          Mobile phone numbers are used only for authentication purposes and handled in accordance
          with the Oddtopsy Reports SMS Authentication Privacy Policy.
        </p>
        <h4>Changes</h4>
        <p>
          Oddtopsy Reports may update these terms as necessary to reflect changes to its
          authentication services. Material changes will be communicated to affected editorial
          users.
        </p>
        <h4>Contact</h4>
        <p>For privacy questions or requests to disable SMS authentication, contact:</p>
        <p>
          <b>Oddtopsy Reports</b>
          <br />
          <a className="page-link" href="mailto:editorial@oddtopsies.org">
            editorial@oddtopsies.org
          </a>
        </p>
      </section>
      <Footer />
    </main>
  )
}
