import { useCallback, useEffect, useRef, useState } from 'react'
import { CarouselPageContext } from './carouselPage'
import { MediaImage } from '../Catalog/Media'
import './StoreParts.css'

/**
 * Shared Steam-style store building blocks. Layout and proportions follow the
 * Steam storefront; colors and typography come from the VStore design tokens.
 */

function gameHref(id) {
  return '#/games/' + id
}

/** A link to a game page that routes through the store's selection callback. */
export function GameLink({ game, onSelect, className, children, label, ...rest }) {
  return (
    <a
      className={className}
      href={gameHref(game.id)}
      aria-label={label}
      onClick={(event) => {
        if (!onSelect || event.metaKey || event.ctrlKey || event.shiftKey || event.button) return
        event.preventDefault()
        onSelect(game.id)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}

/** Steam discount block: a percentage badge followed by the old and final price. */
export function PriceBlock({ game, className = '' }) {
  if (game.discount)
    return (
      <span
        className={'store-price store-price--discounted ' + className}
        aria-label={`${game.discount} discount, ${game.originalPrice} now ${game.price}`}
      >
        <span className="store-price__pct">{game.discount}</span>
        <span className="store-price__prices">
          <del className="store-price__original">{game.originalPrice}</del>
          <span className="store-price__final">{game.price}</span>
        </span>
      </span>
    )
  return (
    <span className={'store-price ' + className}>
      <span className="store-price__final">{game.price}</span>
    </span>
  )
}

export function TagList({ tags = [], limit = 4, className = '' }) {
  const visible = tags.filter((tag) => tag?.name).slice(0, limit)
  if (!visible.length) return null
  return (
    <ul className={'store-tags ' + className} aria-label="Tags">
      {visible.map((tag) => (
        <li key={tag.id ?? tag.name}>{tag.name}</li>
      ))}
    </ul>
  )
}

function Chevron({ direction }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Paged carousel like the Steam home rows: a scroll-snapping track, side arrows and
 * page dots. Items per page are set in CSS (--carousel-per-view), so it stays responsive.
 */
export function Carousel({
  title,
  label,
  action,
  className = '',
  autoplay = 0,
  children,
  itemCount,
}) {
  const track = useRef(null)
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(1)
  const [paused, setPaused] = useState(false)
  const measure = useCallback(() => {
    const box = track.current
    if (!box || !box.clientWidth) return
    setPages(Math.max(1, Math.round(box.scrollWidth / box.clientWidth)))
    setPage(Math.round(box.scrollLeft / box.clientWidth))
  }, [])
  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure, itemCount])
  const go = useCallback(
    (next) => {
      const box = track.current
      if (!box || !box.clientWidth) return
      const target = (next + pages) % pages
      const left = target * box.clientWidth
      if (typeof box.scrollTo === 'function') box.scrollTo({ left, behavior: 'smooth' })
      else box.scrollLeft = left
      setPage(target)
    },
    [pages],
  )
  useEffect(() => {
    if (!autoplay || paused || pages < 2) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => go(page + 1), autoplay)
    return () => window.clearInterval(timer)
  }, [autoplay, paused, pages, page, go])
  const name = label || title
  return (
    <section
      className={'store-carousel ' + className}
      aria-roledescription="carousel"
      aria-label={name}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {(title || action) && (
        <header className="store-section-heading">
          {title && <h2>{title}</h2>}
          {action}
        </header>
      )}
      <div className="store-carousel__viewport">
        {pages > 1 && (
          <button
            type="button"
            className="store-carousel__arrow store-carousel__arrow--prev"
            aria-label={`Previous ${name}`}
            onClick={() => go(page - 1)}
          >
            <Chevron direction="left" />
          </button>
        )}
        <div className="store-carousel__track" ref={track} onScroll={measure}>
          <CarouselPageContext.Provider value={page}>{children}</CarouselPageContext.Provider>
        </div>
        {pages > 1 && (
          <button
            type="button"
            className="store-carousel__arrow store-carousel__arrow--next"
            aria-label={`Next ${name}`}
            onClick={() => go(page + 1)}
          >
            <Chevron direction="right" />
          </button>
        )}
      </div>
      {pages > 1 && (
        <div className="store-carousel__dots">
          {Array.from({ length: pages }, (_, index) => (
            <button
              type="button"
              key={index}
              aria-label={`${name}: page ${index + 1} of ${pages}`}
              aria-current={index === page ? 'true' : undefined}
              onClick={() => go(index)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/** Steam header capsule (460x215) with the price bar underneath, used in home rows. */
export function HeaderCapsule({ game, onSelect, ribbon, image }) {
  return (
    <GameLink game={game} onSelect={onSelect} className="store-capsule">
      <span className="store-capsule__media">
        <MediaImage
          src={image || game.capsuleImage}
          fallbackSrc={game.heroImage}
          alt={game.title}
        />
        {ribbon && <span className="store-capsule__ribbon">{ribbon}</span>}
      </span>
      <span className="store-capsule__bar">
        <span className="store-capsule__title">{game.title}</span>
        <PriceBlock game={game} />
      </span>
    </GameLink>
  )
}

/**
 * Steam search-result row: small capsule, title with tags and studio, release
 * information, and the price block on the right.
 */
export function GameRow({ game, onSelect, children, meta }) {
  return (
    <article className="store-row" aria-label={game.title}>
      <GameLink game={game} onSelect={onSelect} className="store-row__link">
        <span className="store-row__capsule">
          <MediaImage
            src={game.capsuleImage}
            fallbackSrc={game.heroImage}
            alt=""
            className="store-row__image"
          />
        </span>
        <span className="store-row__info">
          <span className="store-row__title">{game.title}</span>
          <TagList tags={game.tags} limit={4} className="store-row__tags" />
          {(meta || game.developer) && (
            <span className="store-row__meta">{meta || game.developer}</span>
          )}
        </span>
        <PriceBlock game={game} className="store-row__price" />
      </GameLink>
      {children && <div className="store-row__actions">{children}</div>}
    </article>
  )
}
