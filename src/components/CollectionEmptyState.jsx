import './CollectionEmptyState.css'

export default function CollectionEmptyState({ title, className = '' }) {
  return (
    <section className={`collection-empty ${className}`}>
      <h2>{title}</h2>
      <a href="#/discover">Browse the catalog</a>
    </section>
  )
}
