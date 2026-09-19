export default function ResourceStatus({ resource, label }) {
  if (resource.loading) return <p className="catalog-status" role="status">Loading {label}...</p>
  if (!resource.error) return null
  return <div className="catalog-status" role="alert"><p>{resource.error.message || `Could not load ${label}.`}</p>
    <button className="button button--secondary" type="button" onClick={resource.retry}>Retry {label}</button></div>
}
