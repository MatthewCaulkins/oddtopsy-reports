import { Footer } from '../components/Footer'
import { Header } from '../components/Header'

export default function SubscribePage() {
  return (
    <main className="site">
      <Header />

      <section className="page-hero">
        <h1>Subscribe to Oddtopsy Reports</h1>
        <p>
          Follow new case papers, anatomical findings, and project updates as the publication grows.
        </p>
      </section>

      <section className="section subscribe-layout">
        <div className="content-panel">
          <h2>Stay connected</h2>
          <p>
            Subscriptions are not active yet, but this page will eventually support publication
            updates, reader memberships, and ways to help sustain the archive.
          </p>

          <form className="submit-form">
            <label>
              Email address
              <input type="email" name="email" placeholder="you@example.com" />
            </label>

            <button className="button primary" type="button">
              Notify Me
            </button>
          </form>
        </div>

        <aside className="content-panel">
          <h2>Possible model</h2>
          <p>
            We are exploring a low-cost model that keeps reading accessible while helping cover
            hosting, editorial labor, and publication support.
          </p>
          <p>
            The goal is to reduce publication barriers, not recreate the cost and friction of
            traditional journals.
          </p>
        </aside>
      </section>

      <Footer />
    </main>
  )
}
