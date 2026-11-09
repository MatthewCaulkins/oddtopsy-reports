import { Footer } from '../components/Footer'
import { Header } from '../components/Header'

export default async function PrivacyPage() {
  return (
    <main className="site">
      <Header />
      <section className="page-hero">
        <h1>Oddtopsy Reports — SMS Authentication Privacy Policy</h1>
      </section>

      <section className="section privacy">
        <h4>Last updated: November 8, 2026</h4>
        <p>
          Oddtopsy Reports respects the privacy of its editorial staff and contributors. SMS
          authentication is an optional security feature available to authorized editorial users.
        </p>

        <h4>Information Collected</h4>
        <p>
          When an editor voluntarily enrolls in SMS authentication, Oddtopsy Reports collects their
          mobile telephone number and stores it with its authentication provider, Amazon Web
          Services (AWS Cognito). Oddtopsy Reports also records, with the editor's account, the
          enrolled number, the date and time the editor gave consent, and that the editor accepted
          the SMS Authentication Terms and Conditions and this policy.
        </p>
        <h4>Use of Information</h4>
        <p>
          Mobile phone numbers are used exclusively for account authentication, security
          verification, and delivery of one-time login codes.
        </p>
        <p>
          Oddtopsy Reports does not use these numbers for advertising, promotional messaging, or
          journal announcements.
        </p>
        <h4>Consent and Choice</h4>
        <p>
          Editors consent to SMS authentication themselves, on the MFA Agreement page of the
          Oddtopsy Reports editorial site, by checking a box to consent to receive SMS verification
          codes and separately checking a box to accept the terms and this policy. Neither box is
          checked in advance, and consent is never given on an editor's behalf by an administrator.
        </p>
        <p>
          Participation in SMS authentication is optional. Editors who decline or withdraw consent
          continue to receive sign-in verification codes by email.
        </p>
        <h4>Information Sharing</h4>
        <p>
          Phone numbers are processed by AWS and its messaging service providers solely as necessary
          to deliver authentication messages.
        </p>
        <p>
          SMS consent information and mobile numbers are not sold or shared with third parties for
          marketing or promotional purposes.
        </p>
        <h4>Data Retention and Removal</h4>
        <p>
          Phone numbers and SMS agreement details are retained only while SMS authentication remains
          enabled for the editor's account. When it is disabled, they are removed from the account
          and from the authentication system. If an editor replies STOP, the messaging service may
          keep a record of that request so that no further messages are sent to the number.
        </p>
        <p>
          Editors may remove their phone numbers at any time by selecting Disable SMS Verification
          on the MFA Agreement page, or by contacting the editorial team.
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
