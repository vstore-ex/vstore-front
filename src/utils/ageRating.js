// Presentation of backend codes, not a classification of individual games.
const esrbRatings = {
  E: { label: 'Everyone', caption: 'ESRB' },
  'E10+': { label: '10+', caption: 'Everyone 10+ · ESRB' },
  T: { label: '13+', caption: 'Teen · ESRB' },
  M: { label: '17+', caption: 'Mature · ESRB' },
  AO: { label: '18+', caption: 'Adults Only · ESRB' },
  RP: { label: 'Rating pending', caption: 'ESRB' },
}

export function ageRating(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const raw = value.trim()
  const code = raw
    .toUpperCase()
    .replace(/^ESRB\s*:?\s*/, '')
    .trim()
  const esrb = esrbRatings[code === 'E10' ? 'E10+' : code]
  if (esrb) return esrb
  const pegi = /^PEGI\s*(3|7|12|16|18)\+?$/i.exec(raw)
  if (pegi)
    return {
      label: pegi[1] + '+',
      caption: 'PEGI',
    }
  // Preserve unfamiliar ratings without guessing an age or rating authority.
  return { label: raw, caption: 'Age rating' }
}
