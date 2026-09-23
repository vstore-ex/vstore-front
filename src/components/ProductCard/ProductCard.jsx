import './ProductCard.css'
import WishlistButton from '../Wishlist/WishlistButton'
import AddToCartButton from '../Cart/AddToCartButton'
import { MediaImage } from '../Catalog/Media'

function ProductCard({ product, onSelect }) {
  function handleClick(event) {
    event.preventDefault()
    onSelect?.(product.id)
  }

  return (
    <article className="product-card">
      <a className="product-card__button" href={`#/products/${product.id}`} onClick={handleClick}>
        <span className="product-card__media">
          <MediaImage className="product-card__image" src={product.image} alt={product.title} />
        </span>

        <span className="product-card__type">{product.type}</span>
        <span className="product-card__title">{product.title}</span>

        {product.discount ? (
          <span className="product-card__deal" aria-label={`${product.discount} discount`}>
            <span className="product-card__discount">{product.discount}</span>
            <span className="product-card__prices">
              <span className="product-card__old-price">{product.originalPrice}</span>
              <span className="product-card__price">{product.price}</span>
            </span>
          </span>
        ) : (
          <span className="product-card__price">{product.price}</span>
        )}
      </a>
      <AddToCartButton productId={product.id} />
      <WishlistButton productId={product.id} />
    </article>
  )
}

export default ProductCard
