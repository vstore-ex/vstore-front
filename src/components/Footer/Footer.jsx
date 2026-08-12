import facebookIcon from '../../assets/footer-facebook.svg'
import twitterIcon from '../../assets/footer-twitter.svg'
import youtubeIcon from '../../assets/footer-youtube.svg'
import footerLogo from '../../assets/footer-logo-mark.svg'
import chevronUp from '../../assets/footer-chevron-up.svg'
import './Footer.css'

const socialLinks = [
  {
    label: 'Facebook',
    href: '#facebook',
    icon: facebookIcon,
    className: 'social-link__icon--facebook',
  },
  {
    label: 'Twitter',
    href: '#twitter',
    icon: twitterIcon,
    className: 'social-link__icon--twitter',
  },
  {
    label: 'YouTube',
    href: '#youtube',
    icon: youtubeIcon,
    className: 'social-link__icon--youtube',
  },
]

const footerLinks = [
  { label: 'Terms of service', href: '#terms-of-service' },
  { label: 'Jobs', href: '#jobs' },
  { label: 'Rules', href: '#rules' },
  { label: 'Contracts', href: '#contracts' },
  { label: 'Gift cards', href: '#gift-cards' },
  { label: 'Facebook', href: '#facebook' },
  { label: 'Twitter', href: '#twitter' },
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
            <div className="social-links" aria-label="Social links">
              {socialLinks.map(({ label, href, icon, className }) => (
                <a className="social-link" href={href} aria-label={label} key={label}>
                  <img className={className} src={icon} alt="" />
                </a>
              ))}
            </div>

            <p className="legal-copy">
              <span>
                &copy; 2025 Valve Corporation. All rights reserved. All trademarks are property of
                their respective owners in the US and other countries.
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
