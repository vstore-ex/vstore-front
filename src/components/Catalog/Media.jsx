import { useState } from 'react'
import { mediaUrl } from '../../api/catalog'
export function MediaImage({ src, alt = '', className = '', eager = false }) {
  const [failed, setFailed] = useState('')
  const url = mediaUrl(src)
  return url && failed !== url ? <img src={url} alt={alt} className={className}
    loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(url)} />
    : <span className={`catalog-placeholder ${className}`} role="img" aria-label={alt || 'Image unavailable'}>Image unavailable</span>
}
export default function MediaGallery({ game }) {
  const items = game.media.length ? game.media : game.banners.map(b => ({ ...b, media_type: 'image', url: b.image_url }))
  const [selected, setSelected] = useState(0)
  const [failed, setFailed] = useState('')
  const active = items[selected] || items[0]
  return <section className="product-gallery" aria-label={`${game.title} media`}>
    <div className="catalog-media-stage">
      {!active ? <p>No media available.</p> : active.media_type === 'video' ? <>
        <video key={active.url} src={mediaUrl(active.url)} poster={active.thumbnail_url || game.heroImage || undefined}
          controls playsInline preload="metadata" aria-label={`${game.title} video`} onError={() => setFailed(active.url)} />
        {failed === active.url && <p role="alert">This video could not be played.</p>}
      </> : <MediaImage src={active.url} alt={game.title} eager />}
    </div>
    <div className="product-gallery__thumbs">{items.map((item, index) => <button key={`${item.id}-${index}`} type="button"
      className={`product-gallery__thumb${active === item ? ' product-gallery__thumb--active' : ''}`}
      aria-label={`Show ${item.media_type} ${index + 1}`} aria-pressed={active === item} onClick={() => setSelected(index)}>
      <MediaImage src={item.media_type === 'video' ? item.thumbnail_url || game.heroImage : item.url} />
      {item.media_type === 'video' && <span className="catalog-video-label" aria-hidden="true">Video</span>}
    </button>)}</div>
  </section>
}
