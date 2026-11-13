// Optional presentation metadata lives in GameOut.meta_info (a JSON string).
// Plain-text meta_info remains readable as additional information.
export function productPresentation(game) {
  let meta = {}
  let structured = false
  try {
    const value = JSON.parse(game.meta_info || '{}')
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      meta = value
      structured = true
    }
  } catch {
    /* Legacy plain-text metadata. */
  }
  const text = (value) => (typeof value === 'string' ? value : '')
  return {
    header:
      game.mainCapsule || game.headerImage || game.capsuleImage || game.heroImage || game.image,
    summary:
      text(meta.short_description) ||
      text(game.description_md)
        .split(/\n\s*\n/)
        .find((p) => p.trim() && !/^\s*[#!]/.test(p)) ||
      '',
    releaseDate: text(meta.release_date),
    ratingDescription: text(meta.rating_description),
    additional: structured ? text(meta.additional_information) : text(game.meta_info),
    reviewSummary:
      typeof meta.review_summary?.label === 'string' &&
      Number.isInteger(meta.review_summary?.count) &&
      meta.review_summary.count > 0
        ? { label: meta.review_summary.label, count: meta.review_summary.count }
        : null,
  }
}
