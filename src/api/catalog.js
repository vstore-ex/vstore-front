import { apiRequest, mediaUrl } from './client'
import { formatMoney, isMoneyAmount } from '../utils/money'
export { mediaUrl } from './client'

export const PAGE_SIZE = 24
export const offerUrl = (value) => mediaUrl(value, window.location.origin)
const array = (value) => (Array.isArray(value) ? value : [])
export const priceLabel = formatMoney
export function mapGame(game) {
  if (!game || game.id == null || typeof game.title !== 'string')
    throw new Error('The server returned an invalid game.')
  const currency = game.currency
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency))
    throw new Error('The server returned an invalid currency.')
  const banners = array(game.banners).filter(Boolean)
  const getBanner = (type) => banners.find((b) => b.banner_type === type)?.image_url

  // Standardized banners (4 formats):
  // Vertical poster (600x900): library_capsule
  const poster = getBanner('library_capsule') || banners[0]?.image_url

  // Horizontal hero (616x353): main_capsule -> library_hero
  const hero = getBanner('main_capsule') || getBanner('library_hero') || banners[0]?.image_url

  // Game page sidebar cover (616x353): main_capsule -> header_capsule -> library_hero
  const header =
    getBanner('main_capsule') ||
    getBanner('header_capsule') ||
    getBanner('library_hero') ||
    banners[0]?.image_url

  // Library hero (1920x620): library_hero -> header_capsule -> poster
  const libHero = getBanner('library_hero') || getBanner('header_capsule') || poster

  // Square icon: fallback to poster
  const icon = poster

  // Header capsule (460x215): header_capsule -> main_capsule
  const capsule = getBanner('header_capsule') || getBanner('main_capsule') || banners[0]?.image_url

  // Main capsule (616x353): main_capsule -> header_capsule
  const mainCapsule = getBanner('main_capsule') || getBanner('header_capsule') || hero

  const free = game.is_free === true
  if (!free && (!isMoneyAmount(game.price) || Number(game.price) < 0))
    throw new Error('The server returned an invalid game price.')
  const price = free ? 0 : Number(game.price)
  const original = isMoneyAmount(game.original_price) ? Number(game.original_price) : null
  return {
    ...game,
    is_free: free,
    currency,
    id: String(game.id),
    type: 'Base Game',
    image: mediaUrl(poster),
    posterImage: mediaUrl(poster),
    heroImage: mediaUrl(hero),
    headerImage: mediaUrl(header),
    libraryHero: mediaUrl(libHero),
    libraryPoster: mediaUrl(poster),
    iconImage: mediaUrl(icon),
    capsuleImage: mediaUrl(capsule),
    mainCapsule: mediaUrl(mainCapsule),
    amount: price,
    price: free ? 'Free' : priceLabel(price, currency),
    originalPrice: original > price ? priceLabel(original, currency) : '',
    discount: original > price ? `-${Math.round((1 - price / original) * 100)}%` : '',
    tags: array(game.tags).filter((tag) => tag?.id != null),
    banners,
    media: array(game.media)
      .filter((item) => item && ['image', 'video'].includes(item.media_type))
      .map((item) => ({
        ...item,
        url: mediaUrl(item.url),
        thumbnail_url: mediaUrl(item.thumbnail_url),
      }))
      .filter((item) => item.url)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
  }
}
function games(value, currency) {
  return array(value)
    .filter((game) => game?.id != null)
    .map((game) => checkedGame(game, currency))
}
function checkedGame(game, currency) {
  if (currency && game.currency !== currency)
    throw new Error('The server returned prices in a different currency. Please retry.')
  return mapGame(game)
}
function currencyQuery(query, currency) {
  const params = new URLSearchParams(query)
  if (currency) params.set('currency', currency)
  return params
}
const request = (path, signal) => apiRequest(path, { signal, auth: false, credentials: 'omit' })
export async function getGames(query, signal, currency) {
  const params = currencyQuery(query, currency)
  const data = await request('/games/?' + params, signal)
  if (!Array.isArray(data)) throw new Error('The server returned an invalid game list.')
  return games(data, currency)
}
export async function getGame(id, signal, currency) {
  if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
    const error = new Error('Game not found.')
    error.status = 404
    throw error
  }
  const data = await request(
    '/games/' + encodeURIComponent(String(id).trim()) + '?' + currencyQuery('', currency),
    signal,
  )
  if (!data || data.id == null) return null
  return checkedGame(data, currency)
}
export async function getTags(_key, signal) {
  const data = await request('/taxonomy/tags', signal)
  if (!Array.isArray(data)) throw new Error('The server returned an invalid tag list.')
  return data.filter((tag) => tag?.id != null)
}
export async function getDiscover(_key, signal, currency) {
  const data = await request('/discover/discover?' + currencyQuery('', currency), signal)
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('The server returned an invalid Discover layout.')
  return {
    featured: data.featured?.id != null ? checkedGame(data.featured, currency) : null,
    sections: array(data.sections)
      .filter(Boolean)
      .map((s) => ({ ...s, games: games(s.games, currency) })),
    promos: array(data.promos).filter(Boolean),
    deals: games(data.deals, currency),
    free_games: games(data.free_games, currency),
    ranked_columns: array(data.ranked_columns)
      .filter(Boolean)
      .map((c) => ({ ...c, games: games(c.games, currency) })),
    mobile_banner:
      data.mobile_banner && typeof data.mobile_banner === 'object' ? data.mobile_banner : null,
  }
}

export async function searchGames(query, signal, currency) {
  if (!query.trim()) return []
  const data = await request(
    '/search/games?' + currencyQuery({ q: query.trim() }, currency),
    signal,
  )
  if (!Array.isArray(data)) throw new Error('The server returned invalid search results.')
  // The deployed search endpoint returns base amounts without currency conversion.
  // Hydrate only unconverted matches, with bounded concurrency and cancellation.
  const result = new Array(data.length)
  let next = 0
  async function worker() {
    while (next < data.length) {
      signal?.throwIfAborted()
      const index = next++,
        game = data[index]
      result[index] =
        game.currency === currency && currency
          ? mapGame(game)
          : await getGame(game.id, signal, currency)
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, data.length) }, worker))
  return result.filter(Boolean)
}
