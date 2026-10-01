import { useEffect, useRef, useState } from 'react'
import { mediaUrl } from '../../api/catalog'
import Trailer from './Trailer'
import './Media.css'
export function MediaImage({ src, fallbackSrc, alt = '', className = '', eager = false }) {
  const [failed, setFailed] = useState([])
  const url = [mediaUrl(src), mediaUrl(fallbackSrc)].find(value => value && !failed.includes(value))
  return url ? <img src={url} alt={alt} className={className}
    loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(previous => [...previous, url])} />
    : <span className={'catalog-placeholder ' + className} role="img" aria-label={alt || 'Image unavailable'}>Image unavailable</span>
}
export default function MediaGallery({ game }) {
  const items = (game.media?.length ? game.media : (game.banners || []).map(b => ({ ...b, media_type: 'image', url: b.image_url })))
    .filter(item => mediaUrl(item.url))
  const [selected, setSelected] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const stage = useRef(null)
  const expandButton = useRef(null)
  const active = items[selected] || items[0]
  const fallback = game.heroImage || game.headerImage || game.image
  const nextImage = items.length ? Array.from({ length: items.length }, (_, offset) => (selected + offset + 1) % items.length)
    .find(index => items[index].media_type === 'image') : undefined
  useEffect(() => {
    if (!expanded) return
    const element = stage.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    const siblings = []
    for (let node = element; node?.parentElement; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling !== node) { siblings.push([sibling, sibling.inert]); sibling.inert = true }
      }
    }
    document.body.style.overflow = 'hidden'
    expandButton.current?.focus()
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); setExpanded(false) }
      if (event.key === 'Tab') {
        const focusable = [...element.querySelectorAll('button:not(:disabled), video, [href]')]
        const index = focusable.indexOf(document.activeElement)
        if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)?.focus() }
        else if (!event.shiftKey && (index === focusable.length - 1 || index === -1)) { event.preventDefault(); focusable[0]?.focus() }
      }
    }
    element.addEventListener('keydown', keydown)
    return () => {
      element.removeEventListener('keydown', keydown)
      document.body.style.overflow = previousOverflow
      siblings.forEach(([sibling, inert]) => { sibling.inert = inert })
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [expanded])
  return <section className="product-gallery" aria-label={game.title + ' media'}>
    <div className="gallery-stage-slot">
      <div ref={stage} className={'catalog-media-stage' + (expanded ? ' gallery-expanded' : '')}
        role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined}
        aria-label={expanded ? game.title + ' media viewer' : undefined}>
        {!active ? <p>No media available.</p> : active.media_type === 'video' ?
          <Trailer key={active.url} src={mediaUrl(active.url)} poster={mediaUrl(active.thumbnail_url) || mediaUrl(fallback)}
            title={game.title} onNextImage={nextImage === undefined ? undefined : () => setSelected(nextImage)} />
          : <MediaImage key={active.url} src={active.url} alt={game.title} eager />}
        {active && <button ref={expandButton} type="button" className="gallery-expand"
          onClick={() => setExpanded(value => !value)}>{expanded ? 'Close viewer' : 'Expand media'}</button>}
        {expanded && items.length > 1 && <div className="gallery-navigation">
          <button type="button" onClick={() => setSelected((items.indexOf(active) + items.length - 1) % items.length)}>Previous media</button>
          <button type="button" onClick={() => setSelected((items.indexOf(active) + 1) % items.length)}>Next media</button>
        </div>}
      </div>
    </div>
    <div className="product-gallery__thumbs">{items.map((item, index) => <button key={item.id ?? item.url} type="button"
      className={'product-gallery__thumb' + (active === item ? ' product-gallery__thumb--active' : '')}
      aria-label={'Show ' + item.media_type + ' ' + (index + 1)} aria-pressed={active === item} onClick={() => setSelected(index)}>
      <MediaImage src={item.thumbnail_url || (item.media_type === 'image' ? item.url : fallback)}
        fallbackSrc={item.media_type === 'video' ? fallback : item.url} />
      {item.media_type === 'video' && <span className="gallery-video-badge" aria-hidden="true">Video</span>}
    </button>)}</div>
  </section>
}
