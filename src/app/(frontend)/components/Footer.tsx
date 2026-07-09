import Link from 'next/link'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-links">
          <a href="/">Home</a>
          <a href="/articles">Papers</a>
          <a href="/submit">Submit</a>
          <a href="/about">About</a>
          <a href="/subscribe">Subscribe</a>
        </div>

        <div className="footer-brand">
          <h3>Oddtopsy Reports</h3>
          <p>
            Dedicated to sharing anatomical findings, educational case reports, and cadaveric
            observations without the barriers of traditional publishing.
          </p>
        </div>

        <div className="footer-meta">
          <p>© {new Date().getFullYear()} Oddtopsy Reports</p>
        </div>
      </div>
    </footer>
  )
}
