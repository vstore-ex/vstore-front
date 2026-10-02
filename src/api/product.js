import { apiRequest } from './client'
import { mediaUrl } from './catalog'

// Optional presentation metadata lives in GameOut.meta_info (a JSON string).
// Plain-text meta_info remains readable as additional information.
export function productPresentation(game) {
  let meta = {}
  let structured = false
  try {
    const value = JSON.parse(game.meta_info || '{}')
    if (value && typeof value === 'object' && !Array.isArray(value)) { meta = value; structured = true }
  } catch { /* Legacy plain-text metadata. */ }
  const text = value => typeof value === 'string' ? value : ''
  return {
    header: game.headerImage || game.heroImage || game.image,
    summary: text(meta.short_description) || text(game.description_md).split(/\n\s*\n/).find(p => p.trim() && !/^\s*[#!]/.test(p)) || '',
    releaseDate: text(meta.release_date),
    ratingImage: mediaUrl(meta.rating_image_url),
    ratingDescription: text(meta.rating_description),
    additional: structured ? text(meta.additional_information) : text(game.meta_info),
    reviewSummary: typeof meta.review_summary?.label === 'string' && Number.isInteger(meta.review_summary?.count) && meta.review_summary.count > 0
      ? { label: meta.review_summary.label, count: meta.review_summary.count } : null,
  }
}

export async function getAchievements(key, signal) {
  const { id, page = 1, pageSize = 6 } = JSON.parse(key)
  // Backend app/api/achievements.py:45 defines this separate route with page/page_size.
  const data = await apiRequest('/products/' + encodeURIComponent(id) + '/achievements?page=' + page + '&page_size=' + pageSize, { signal, auth: false })
  if (!Array.isArray(data?.items) || !Number.isInteger(data.total)) throw new Error('Could not read achievements.')
  return { ...data, items: data.items.filter(item => item?.id != null).map(item => ({
    ...item, icon: mediaUrl(item.icon),
    completion: typeof item.completion_percent === 'number' && Number.isFinite(item.completion_percent)
      ? Math.max(0, Math.min(100, item.completion_percent)) : null,
  })) }
}
