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
        <h4>Last updated: November 7, 2026</h4>
        <p>
          Oddtopsy Reports respects the privacy of its editorial staff and contributors. SMS
          authentication is an optional security feature available to authorized editorial users.
        </p>

        <h4>Information Collected</h4>
        <p>
          When an editor voluntarily enrolls in SMS authentication, Oddtopsy Reports collects and
          stores their mobile telephone number through its authentication provider, Amazon Web
          Services (AWS Cognito).
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
          Editors may voluntarily consent to SMS authentication during account enrollment or through
          direct communication with the editorial administration team.
        </p>
        <p>
          Participation in SMS authentication is optional. Editors who decline or withdraw consent
          may continue using email-based multifactor authentication, where supported by their
          account configuration.
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
          Phone numbers are retained while SMS authentication remains enabled for the editor's
          account or as otherwise required for legitimate security and compliance purposes.
        </p>
        <p>
          Editors may request removal of their phone numbers from the authentication system by
          contacting the editorial team.
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
