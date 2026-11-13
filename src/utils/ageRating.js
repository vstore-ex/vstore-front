import everyone from '../assets/ratings/esrb-E.svg'
import everyone10 from '../assets/ratings/esrb-E10plus.svg'
import teen from '../assets/ratings/esrb-T.svg'
import mature from '../assets/ratings/esrb-M.svg'
import adults from '../assets/ratings/esrb-AO.svg'
import pending from '../assets/ratings/esrb-RP.svg'
import pegi3 from '../assets/ratings/pegi-3.png'
import pegi7 from '../assets/ratings/pegi-7.png'
import pegi12 from '../assets/ratings/pegi-12.png'
import pegi16 from '../assets/products/rating-16.png'
import pegi18 from '../assets/ratings/pegi-18.png'

// Presentation of backend codes, not a classification of individual games.
const esrbRatings = {
  E: { label: 'Everyone', caption: 'ESRB', image: everyone },
  'E10+': { label: '10+', caption: 'Everyone 10+ · ESRB', image: everyone10 },
  T: { label: '13+', caption: 'Teen · ESRB', image: teen },
  M: { label: '17+', caption: 'Mature · ESRB', image: mature },
  AO: { label: '18+', caption: 'Adults Only · ESRB', image: adults },
  RP: { label: 'Rating pending', caption: 'ESRB', image: pending },
}
const pegiImages = { 3: pegi3, 7: pegi7, 12: pegi12, 16: pegi16, 18: pegi18 }

export function ageRating(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const raw = value.trim()
  const code = raw
    .toUpperCase()
    .replace(/^ESRB\s*:?\s*/, '')
    .trim()
  const esrb = esrbRatings[code === 'E10' ? 'E10+' : code]
  if (esrb) return { ...esrb, alt: 'ESRB ' + code }
  const pegi = /^PEGI\s*(3|7|12|16|18)\+?$/i.exec(raw)
  if (pegi)
    return {
      label: pegi[1] + '+',
      caption: 'PEGI',
      image: pegiImages[pegi[1]],
      alt: 'PEGI ' + pegi[1],
    }
  // Preserve unfamiliar ratings without guessing an age or rating authority.
  return { label: raw, caption: 'Age rating', image: '', alt: raw }
}
