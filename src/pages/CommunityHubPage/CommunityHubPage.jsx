import { useCallback, useEffect, useId, useState } from 'react'
import { getGameArtworks, getGameDiscussions } from '../../api/community'
import useCatalogResource from '../../hooks/useCatalogResource'
import useDocumentTitle, { pageTitle } from '../../hooks/useDocumentTitle'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import { MediaImage } from '../../components/Catalog/Media'
import NewsCard from '../../components/News/NewsCard'
import { readStoreLocation } from '../../utils/location'
import { Collection } from '../../community/GameCommunity'
import CommunityDetail from '../../community/CommunityDetail'
import { Author, CommunityError } from '../../community/CommunityParts'
import useCommunityResource from '../../community/useCommunityResource'
import ProductReviews from '../ProductDetailPage/ProductReviews'
import NotFoundPage from '../NotFoundPage/NotFoundPage'
import '../../community/Community.css'
import '../ProductDetailPage/ProductDetailPage.css'
import './CommunityHubPage.css'

/**
 * Steam-style Community Hub for one game: a hero header and tabs for all
 * activity, discussions, artwork, reviews and news. The active tab is kept in
 * the URL (#/games/:id/community?tab=…) so it can be shared.
 */
const TABS = [
  { id: 'all', title: 'All' },
  { id: 'discussions', title: 'Discussions' },
  { id: 'artwork', title: 'Artwork' },
  { id: 'reviews', title: 'Reviews' },
  { id: 'news', title: 'News' },
]

function readTab() {
  const tab = readStoreLocation().params.get('tab')
  return TABS.some((item) => item.id === tab) ? tab : 'all'
}

function excerpt(value, length = 180) {
  const plain = String(value || '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > length ? plain.slice(0, length).trimEnd() + '…' : plain
}

/** The "All" tab: a mixed tile wall of recent artwork, discussions and news. */
function HubOverview({ gameId, onSignIn, onShowTab }) {
  const discussions = useCommunityResource(
    useCallback((signal) => getGameDiscussions(gameId, signal), [gameId]),
  )
  const artworks = useCommunityResource(
    useCallback((signal) => getGameArtworks(gameId, signal), [gameId]),
  )
  const news = useCatalogResource('news', JSON.stringify({ game_id: gameId, limit: 4 }))
  const [selected, setSelected] = useState(null)
  const tiles = [
    ...(artworks.data || []).slice(0, 8).map((item) => ({ kind: 'artwork', item })),
    ...(discussions.data || []).slice(0, 8).map((item) => ({ kind: 'discussion', item })),
  ].sort((a, b) => Date.parse(b.item.created_at || 0) - Date.parse(a.item.created_at || 0))
  const loading = discussions.loading || artworks.loading
  function reload() {
    discussions.reload()
    artworks.reload()
  }
  return (
    <div className="hub-overview">
      {loading && !tiles.length && <p role="status">Loading community activity…</p>}
      <CommunityError error={discussions.error} retry={discussions.reload} disabled={loading} />
      <CommunityError error={artworks.error} retry={artworks.reload} disabled={loading} />
      {!loading && !discussions.error && !artworks.error && !tiles.length && (
        <div className="hub-empty">
          <p>No community activity yet. Start a discussion or share your artwork.</p>
          <div>
            <button type="button" onClick={() => onShowTab('discussions')}>
              Go to discussions
            </button>
            <button type="button" onClick={() => onShowTab('artwork')}>
              Go to artwork
            </button>
          </div>
        </div>
      )}
      {!!tiles.length && (
        <ul className="hub-wall" aria-label="Recent community activity">
          {tiles.map(({ kind, item }) => (
            <li key={kind + item.id} className={'hub-tile hub-tile--' + kind}>
              <button
                type="button"
                className="hub-tile__open"
                onClick={() => setSelected({ kind, id: item.id })}
              >
                {kind === 'artwork' ? (
                  <MediaImage className="hub-tile__image" src={item.image_url} alt="" />
                ) : (
                  <span className="hub-tile__label">Discussion</span>
                )}
                <span className="hub-tile__title">{item.title}</span>
                {kind === 'discussion' && item.content_md && (
                  <span className="hub-tile__excerpt">{excerpt(item.content_md)}</span>
                )}
              </button>
              <Author item={item} />
            </li>
          ))}
        </ul>
      )}
      {!!news.data?.length && (
        <section className="hub-overview__news" aria-labelledby="hub-news-title">
          <header className="hub-section-heading">
            <h2 id="hub-news-title">Latest news</h2>
            <button type="button" onClick={() => onShowTab('news')}>
              All news
            </button>
          </header>
          <div className="news-grid">
            {news.data.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
      {selected && (
        <CommunityDetail
          key={selected.kind + selected.id}
          kind={selected.kind}
          id={selected.id}
          gameId={gameId}
          onClose={() => setSelected(null)}
          onUpdated={reload}
          onDeleted={() => {
            setSelected(null)
            reload()
          }}
          onSignIn={onSignIn}
        />
      )}
    </div>
  )
}

function HubNews({ gameId }) {
  const resource = useCatalogResource('news', JSON.stringify({ game_id: gameId, limit: 20 }))
  return (
    <>
      <ResourceStatus resource={resource} label="game news" />
      {resource.data?.length === 0 && <p>No news for this game yet.</p>}
      {!!resource.data?.length && (
        <div className="news-grid">
          {resource.data.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  )
}

function Hub({ game, onSignIn }) {
  const [tab, setTab] = useState(readTab)
  const baseId = useId()
  useEffect(() => {
    const sync = () => setTab(readTab())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  function show(next) {
    setTab(next)
    const hash = `#/games/${game.id}/community` + (next === 'all' ? '' : `?tab=${next}`)
    // Keep the tab shareable without re-running the router's scroll-to-top.
    window.history.replaceState(null, '', hash)
  }
  function tabKeys(event) {
    let index = TABS.findIndex((item) => item.id === tab)
    if (event.key === 'ArrowRight') index = (index + 1) % TABS.length
    else if (event.key === 'ArrowLeft') index = (index + TABS.length - 1) % TABS.length
    else if (event.key === 'Home') index = 0
    else if (event.key === 'End') index = TABS.length - 1
    else return
    event.preventDefault()
    show(TABS[index].id)
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[index]?.focus()
  }
  const active = TABS.find((item) => item.id === tab)
  return (
    <div className="community-hub">
      <header className="hub-hero">
        <MediaImage
          className="hub-hero__backdrop"
          src={game.libraryHero}
          fallbackSrc={game.heroImage}
          alt=""
          eager
        />
        <div className="hub-hero__inner">
          <MediaImage
            className="hub-hero__capsule"
            src={game.capsuleImage}
            fallbackSrc={game.heroImage}
            alt=""
            eager
          />
          <div className="hub-hero__text">
            <p className="hub-hero__eyebrow">Community Hub</p>
            <h1>{game.title}</h1>
            {(game.developer || game.publisher) && (
              <p className="hub-hero__studio">
                {[game.developer, game.publisher]
                  .filter((value, index, all) => value && all.indexOf(value) === index)
                  .join(' · ')}
              </p>
            )}
          </div>
          <a className="hub-hero__store" href={`#/games/${game.id}`}>
            Store Page
          </a>
        </div>
      </header>
      <div className="community-hub__inner">
        <div className="hub-tabs" role="tablist" aria-label="Community Hub sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={item.id === tab}
              aria-controls={`${baseId}-panel`}
              tabIndex={item.id === tab ? 0 : -1}
              onClick={() => show(item.id)}
              onKeyDown={tabKeys}
            >
              {item.title}
            </button>
          ))}
        </div>
        <section
          className={'hub-panel hub-panel--' + tab}
          id={`${baseId}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab}`}
        >
          <h2 className="hub-panel__title">{active.title}</h2>
          {tab === 'all' && <HubOverview gameId={game.id} onSignIn={onSignIn} onShowTab={show} />}
          {tab === 'discussions' && (
            <Collection key="discussion" gameId={game.id} kind="discussion" onSignIn={onSignIn} />
          )}
          {tab === 'artwork' && (
            <Collection key="artwork" gameId={game.id} kind="artwork" onSignIn={onSignIn} />
          )}
          {tab === 'reviews' && (
            <div className="product-detail-page hub-reviews">
              <ProductReviews onSignIn={onSignIn} id={game.id} isFree={game.is_free} />
            </div>
          )}
          {tab === 'news' && <HubNews gameId={game.id} />}
        </section>
      </div>
    </div>
  )
}

export default function CommunityHubPage({ id, onSignIn }) {
  const resource = useCatalogResource('game', String(id))
  const game = resource.data
  useDocumentTitle(
    resource.error?.status === 404
      ? pageTitle('Game not found')
      : pageTitle(game ? `${game.title} community` : 'Community Hub'),
  )
  if (resource.error?.status === 404)
    return (
      <NotFoundPage
        title="Game not found"
        description="This game is unavailable or has been removed from the store."
      />
    )
  if (!game)
    return (
      <div className="community-hub">
        <div className="community-hub__inner">
          <ResourceStatus resource={resource} label="community hub" />
        </div>
      </div>
    )
  return <Hub key={game.id} game={game} onSignIn={onSignIn} />
}
