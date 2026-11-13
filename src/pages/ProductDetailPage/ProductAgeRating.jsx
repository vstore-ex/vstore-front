import { useState } from 'react'
import { ageRating } from '../../utils/ageRating'
import { mediaUrl } from '../../api/client'

function RatingArtwork({ image, rating }) {
  const [failed, setFailed] = useState([])
  const src = [mediaUrl(image), rating.image].find((url) => url && !failed.includes(url))
  return src ? (
    <img
      className="product-rating__image"
      src={src}
      alt={rating.alt}
      loading="lazy"
      onError={() => setFailed((previous) => [...previous, src])}
    />
  ) : (
    <span className="product-rating__fallback" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z" />
        <path d="M12 8v5m0 3h.01" />
      </svg>
    </span>
  )
}

export default function ProductAgeRating({ value, image, description }) {
  const rating = ageRating(value)
  if (!rating) return null
  const details = typeof description === 'string' ? description.trim() : ''
  return (
    <section className="product-rating" aria-label="Age rating">
      <RatingArtwork key={value + ':' + (image || '')} image={image} rating={rating} />
      <div className="product-rating__details">
        <strong className="product-rating__label">{rating.label}</strong>
        <span className="product-rating__description">{details || rating.caption}</span>
      </div>
    </section>
  )
}
