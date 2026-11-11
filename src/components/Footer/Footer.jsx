import footerLogo from '../../assets/discover/figma/d5ed2.svg'
import chevronUp from '../../assets/discover/figma/0474f.svg'
import './Footer.css'

// Only routes that exist in the store; placeholder anchors used to land on the 404 page.
const footerLinks = [
  { label: 'Store', href: '#/discover' },
  { label: 'News', href: '#/news' },
  { label: 'Support', href: '#/support' },
  { label: 'Wishlist', href: '#/wishlist' },
]

function Footer() {
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="store-footer" aria-label="Store footer">
      <div className="footer-content">
        <div className="footer-main">
          <div className="footer-copy">
            <p className="legal-copy">
              <span>
                &copy; {new Date().getFullYear()} VStore. All rights reserved. All trademarks are
                property of their respective owners.
              </span>
              <span>VAT included in all prices where applicable</span>
            </p>

            <nav className="footer-nav" aria-label="Footer navigation">
              {footerLinks.map(({ label, href }) => (
                <a href={href} key={label}>
                  {label}
                </a>
              ))}
            </nav>
          </div>

          <div className="footer-actions" aria-label="Footer actions">
            <button
              className="back-to-top"
              type="button"
              aria-label="Back to top"
              onClick={scrollToTop}
            >
              <img src={chevronUp} alt="" />
            </button>

            <img className="footer-logo" src={footerLogo} alt="" aria-hidden="true" />
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
