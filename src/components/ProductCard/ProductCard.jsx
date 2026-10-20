import { useEffect, useRef, useState } from 'react'
import { getGame, mediaUrl } from '../../api/catalog'
import HoverVideo from './HoverVideo'
import './ProductCard.css'
import { MediaImage } from '../Catalog/Media'

function ProductCard({ product, onSelect }) {
  const timer = useRef(null)
  const card = useRef(null)
  const pending = useRef(null)
  const cached = useRef(null)
  const [preview, setPreview] = useState('')
  const videoUrl = mediaUrl(
    product.media?.find((item) => item.media_type === 'video' && mediaUrl(item.url))?.url,
  )
  function stopPreview() {
    clearTimeout(timer.current)
    pending.current?.abort()
    setPreview('')
  }
  function startPreview(event) {
    if (
      event.pointerType === 'touch' ||
      document.hidden ||
      navigator.connection?.saveData ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !window.matchMedia('(hover: hover)').matches
    )
      return
    clearTimeout(timer.current)
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    timer.current = setTimeout(async () => {
      let url = videoUrl
      if (!url && !product.media?.length) {
        if (cached.current?.id === product.id) url = cached.current.url
        else {
          try {
            const game = await getGame(String(product.id), controller.signal, product.currency)
            url = mediaUrl(game?.media.find((item) => item.media_type === 'video')?.url)
            if (!controller.signal.aborted) cached.current = { id: product.id, url }
          } catch {
            return
          }
        }
      }
      if (!controller.signal.aborted && url) setPreview({ id: product.id, url })
    }, 500)
  }
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        clearTimeout(timer.current)
        pending.current?.abort()
        setPreview('')
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        clearTimeout(timer.current)
        pending.current?.abort()
        setPreview('')
      }
    })
    observer.observe(card.current)
    document.addEventListener('visibilitychange', hide)
    return () => {
      clearTimeout(timer.current)
      pending.current?.abort()
      observer.disconnect()
      document.removeEventListener('visibilitychange', hide)
    }
  }, [])
  function handleClick(event) {
    if (!onSelect || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    stopPreview()
    onSelect(product.id)
  }

  return (
    <article
      ref={card}
      className="product-card"
      onPointerEnter={startPreview}
      onPointerLeave={stopPreview}
    >
      <a className="product-card__button" href={`#/games/${product.id}`} onClick={handleClick}>
        <span className="product-card__media">
          <MediaImage className="product-card__image" src={product.image} alt={product.title} />
          {preview && preview.id === product.id && (
            <HoverVideo key={preview.url} src={preview.url} />
          )}
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
    </article>
  )
}

export default ProductCard
