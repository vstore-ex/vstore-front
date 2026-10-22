// Hash routes take precedence; direct paths are also supported on initial load.
export function readStoreLocation() {
  const route = window.location.hash
    ? window.location.hash.replace(/^#\/?/, '')
    : window.location.pathname.replace(/^\//, '') + window.location.search
  const separator = route.indexOf('?')
  return {
    path: separator < 0 ? route : route.slice(0, separator),
    params: new URLSearchParams(separator < 0 ? '' : route.slice(separator + 1)),
  }
}
