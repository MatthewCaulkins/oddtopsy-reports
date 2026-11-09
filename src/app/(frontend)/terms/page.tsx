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
        <h4>Last updated: November 8, 2026</h4>
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
          Enrollment is voluntary. A signed-in editor enrolls on the MFA Agreement page of the
          Oddtopsy Reports editorial site by entering a mobile phone number, checking a box to
          consent to receive SMS verification codes, and separately checking a box to accept these
          terms and the SMS Authentication Privacy Policy. Neither box is checked in advance. SMS
          authentication is turned on only after the editor confirms the number by entering a code
          sent to it.
        </p>
        <p>
          Agreeing to serve as an editor does not automatically constitute consent to receive SMS
          messages. Consent for SMS authentication is given separately, by the editor, and is never
          given on an editor's behalf by an administrator.
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
          Editors may decline SMS enrollment, or withdraw their consent at any time by selecting
          Disable SMS Verification on the MFA Agreement page or by contacting{' '}
          <a className="page-link" href="mailto:editorial@oddtopsies.org">
            editorial@oddtopsies.org
          </a>
          .
        </p>
        <p>
          When SMS authentication is disabled, sign-in verification codes are sent by email instead,
          and the editor's mobile phone number and SMS agreement are removed from the account.
        </p>
        <h4>Assistance</h4>
        <p>
          For assistance with authentication messages, account access, or SMS enrollment, contact{' '}
          <a className="page-link" href="mailto:editorial@oddtopsies.org">
            editorial@oddtopsies.org
          </a>
          .
        </p>
        <p>
          Recipients may also reply HELP for assistance or STOP to stop receiving SMS messages.
          Replying STOP does not change how the editor signs in, so an editor who replies STOP
          should also disable SMS verification on the MFA Agreement page, or contact the editorial
          team, to receive sign-in codes by email instead.
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
