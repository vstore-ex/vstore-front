import './NotFoundPage.css'

export default function NotFoundPage({
  title = 'Page not found',
  description = 'This page does not exist or its address has changed.',
}) {
  return (
    <section className="not-found-page" aria-labelledby="not-found-title">
      <p className="not-found-page__code">404</p>
      <h1 id="not-found-title">{title}</h1>
      <p>{description}</p>
      <div className="not-found-page__actions">
        <a className="button button--accent" href="#/discover">
          Back to store
        </a>
        <a className="button button--secondary" href="#/support">
          Contact support
        </a>
      </div>
    </section>
  )
}
