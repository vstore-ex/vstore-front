// Preserve only supported protected routes and numeric pending additions.
export function protectedDestination() {
  const route = window.location.hash ? window.location.hash.replace(/^#\/?/, '')
    : window.location.pathname.replace(/^\//, '') + window.location.search
  const [path, query] = route.split('?')
  if (!['account', 'orders', 'cart', 'wishlist'].includes(path)) return 'discover'
  const id = new URLSearchParams(query).get('add')
  return ['cart', 'wishlist'].includes(path) && /^\d+$/.test(id || '') ? `${path}?add=${id}` : path
}
