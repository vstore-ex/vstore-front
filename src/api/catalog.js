import { mediaUrl } from './client'
export { mediaUrl } from './client'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
export const PAGE_SIZE = 24
export const offerUrl = value => mediaUrl(value, window.location.origin)
const array = value => Array.isArray(value) ? value : []
export const priceLabel = value => new Intl.NumberFormat('en', { style: 'currency', currency: 'USD' }).format(Number(value) || 0)
export function mapGame(game) {
  const banners = array(game.banners).filter(Boolean)
  const getBanner = (type) => banners.find((b) => b.banner_type === type)?.image_url

  // Standardized banners (4 formats):
  // Vertical poster (600x900): library_capsule
  const poster = getBanner('library_capsule') || banners[0]?.image_url

  // Horizontal hero (616x353): main_capsule -> library_hero
  const hero = getBanner('main_capsule') || getBanner('library_hero') || banners[0]?.image_url

  // Game page sidebar cover (616x353): main_capsule -> header_capsule -> library_hero
  const header = getBanner('main_capsule') || getBanner('header_capsule') || getBanner('library_hero') || banners[0]?.image_url

  // Library hero (1920x620): library_hero -> header_capsule -> poster
  const libHero = getBanner('library_hero') || getBanner('header_capsule') || poster

  // Square icon: fallback to poster
  const icon = poster

  // Header capsule (460x215): header_capsule -> main_capsule
  const capsule = getBanner('header_capsule') || getBanner('main_capsule') || banners[0]?.image_url

  // Main capsule (616x353): main_capsule -> header_capsule
  const mainCapsule = getBanner('main_capsule') || getBanner('header_capsule') || hero

  const original = Number(game.original_price), price = game.is_free ? 0 : Number(game.price)
  return { ...game, id: String(game.id), type: 'Base Game', image: mediaUrl(poster),
    posterImage: mediaUrl(poster), heroImage: mediaUrl(hero), headerImage: mediaUrl(header),
    libraryHero: mediaUrl(libHero), libraryPoster: mediaUrl(poster), iconImage: mediaUrl(icon),
    capsuleImage: mediaUrl(capsule), mainCapsule: mediaUrl(mainCapsule), amount: price, price: game.is_free ? 'Free' : priceLabel(price),
    originalPrice: original > price ? priceLabel(original) : '',
    discount: original > price ? `-${Math.round((1 - price / original) * 100)}%` : '',
    tags: array(game.tags).filter(tag => tag?.id != null), banners,
    media: array(game.media).filter(item => item && ['image', 'video'].includes(item.media_type))
      .map(item => ({ ...item, url: mediaUrl(item.url), thumbnail_url: mediaUrl(item.thumbnail_url) }))
      .filter(item => item.url).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
  }
}
function games(value) { return array(value).filter(game => game?.id != null).map(mapGame) }
async function request(path, signal) {
  const response = await fetch(API_BASE + path, { credentials: 'omit',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) })
  if (!response.ok) {
    const error = new Error(response.status === 404 ? 'Game not found.' : `Could not load store data (${response.status}). Please try again.`)
    error.status = response.status; throw error
  }
  return response.json()
}
export async function getGames(query, signal) {
  const params = new URLSearchParams(query)
  const data = await request('/games/?' + params, signal)
  if (!Array.isArray(data)) throw new Error('The server returned an invalid game list.')
  return games(data)
}
export async function getGame(id, signal) {
  if (!id || (typeof id !== 'string' && typeof id !== 'number')) { const error = new Error('Game not found.'); error.status = 404; throw error }
  const data = await request('/games/' + encodeURIComponent(String(id).trim()), signal)
  if (!data || data.id == null) return null
  return mapGame(data)
}
export async function getTags(_key, signal) {
  const data = await request('/taxonomy/tags', signal)
  if (!Array.isArray(data)) throw new Error('The server returned an invalid tag list.')
  return data.filter(tag => tag?.id != null)
}
export async function getDiscover(_key, signal) {
  const data = await request('/discover/discover', signal)
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The server returned an invalid Discover layout.')
  return { featured: data.featured?.id != null ? mapGame(data.featured) : null,
    sections: array(data.sections).filter(Boolean).map(s => ({ ...s, games: games(s.games) })),
    promos: array(data.promos).filter(Boolean), deals: games(data.deals), free_games: games(data.free_games),
    ranked_columns: array(data.ranked_columns).filter(Boolean).map(c => ({ ...c, games: games(c.games) })),
    mobile_banner: data.mobile_banner && typeof data.mobile_banner === 'object' ? data.mobile_banner : null,
  }
}

export async function searchGames(query, signal) {
  if (!query.trim()) return []
  const data = await request('/search/games?' + new URLSearchParams({ q: query.trim() }), signal)
  if (!Array.isArray(data)) throw new Error('The server returned invalid search results.')
  return games(data)
}
