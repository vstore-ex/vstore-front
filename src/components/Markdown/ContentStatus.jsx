export default function ContentStatus({ resource }) {
  if (resource.loading) return <p role="status">Loading...</p>
  if (resource.error) return <div role="alert"><p>{resource.error}</p><button onClick={resource.retry}>Retry</button></div>
  return null
}
