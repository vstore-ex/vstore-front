import { ageRating } from '../../utils/ageRating'

export default function ProductAgeRating({ value, description }) {
  const rating = ageRating(value)
  if (!rating) return null
  const details = typeof description === 'string' ? description.trim() : ''
  return (
    <section className="product-rating" aria-label="Age rating">
      <span className="product-rating__eyebrow">Age rating</span>
      <div className="product-rating__summary">
        <strong className="product-rating__label">{rating.label}</strong>
        {rating.caption !== 'Age rating' && (
          <span className="product-rating__caption">{rating.caption}</span>
        )}
      </div>
      {details && <p className="product-rating__description">{details}</p>}
    </section>
  )
}
