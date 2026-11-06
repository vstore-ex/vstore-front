import facebookIcon from '../../assets/discover/figma/2c987.svg'
import twitterIcon from '../../assets/footer-twitter.svg'
import footerLogo from '../../assets/discover/figma/d5ed2.svg'
import chevronUp from '../../assets/discover/figma/0474f.svg'
import './Footer.css'

const footerLinks = [
  { label: 'Terms of service', topic: 'terms' },
  { label: 'Jobs', topic: 'jobs' },
  { label: 'Rules', topic: 'rules' },
  { label: 'Contracts', topic: 'contracts' },
  { label: 'Gift cards', topic: 'gift-cards' },
]

function Footer() {
  const storeUrl = encodeURIComponent(window.location.origin + window.location.pathname)
  const socialLinks = [
    {
      label: 'Share on Facebook',
      href: 'https://www.facebook.com/sharer/sharer.php?u=' + storeUrl,
      icon: facebookIcon,
      className: 'social-link__icon--facebook',
    },
    {
      label: 'Share on Twitter',
      href: 'https://twitter.com/intent/tweet?text=VStore&url=' + storeUrl,
      icon: twitterIcon,
      className: 'social-link__icon--twitter',
    },
  ]
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="store-footer" aria-label="Store footer">
      <div className="footer-content">
        <div className="footer-main">
          <div className="footer-copy">
            <div className="social-links" aria-label="Social links">
              {socialLinks.map(({ label, href, icon, className }) => (
                <a
                  className="social-link"
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  key={label}
                >
                  <img className={className} src={icon} alt="" />
                </a>
              ))}
            </div>

            <p className="legal-copy">
              <span>&copy; {new Date().getFullYear()} VStore.</span>
              <span>Game names and trademarks belong to their respective owners.</span>
            </p>

            <nav className="footer-nav" aria-label="Footer navigation">
              {footerLinks.map(({ label, topic }) => (
                <a href={`#/support?topic=${topic}`} key={label}>
                  {label}
                </a>
              ))}
              {socialLinks.map(({ label, href }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer">
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
