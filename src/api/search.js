import { apiRequest } from './client'
import { mapGame } from './catalog'
export async function searchGames(query, limit = 8, signal) {
  const term = query.trim()
  if (term.length < 2) return []
  const size = Math.min(100, Math.max(1, Math.trunc(Number(limit)) || 8))
  const params = new URLSearchParams({ q: term, limit: String(size) })
  let data
  try { data = await apiRequest('/search?' + params, { auth: false, signal }) }
  catch (error) {
    if (error.status !== 404) throw error
    // Current backend exposes /search/games; retain compatibility during rollout.
    data = await apiRequest('/search/games?' + params, { auth: false, signal })
  }
  const items = Array.isArray(data) ? data : data?.items
  if (!Array.isArray(items)) throw new Error('The server returned invalid search results.')
  return items.filter(game => game?.id != null && game.is_active !== false).slice(0, size).map(mapGame)
}
