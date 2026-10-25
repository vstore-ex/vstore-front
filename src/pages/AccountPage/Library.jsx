import { useEffect, useRef, useState } from 'react'
import { getGame } from '../../api/catalog'
import useOrders from '../../hooks/useOrders'
import { useCurrency } from '../../currency/context'
import { useWallet } from '../../wallet/context'
import { MediaImage } from '../../components/Catalog/Media'
import { useAuth } from '../../auth/context'

function LibrarySession() {
  const orders = useOrders()
  const { code, unavailable, refreshWallet } = useCurrency()
  const { loading: walletLoading, busy: walletBusy } = useWallet()
  const key = JSON.stringify([...orders.ownedIds].sort())
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  const [query, setQuery] = useState('')
  const cache = useRef({ code: null, games: new Map() })
  useEffect(() => {
    if (!code) return
    const controller = new AbortController()
    const ids = JSON.parse(key)
    if (cache.current.code !== code) cache.current = { code, games: new Map() }
    const games = cache.current.games
    const owned = new Set(ids)
    for (const id of games.keys()) {
      if (!owned.has(id)) games.delete(id)
    }
    const missing = ids.filter((id) => !games.has(id) || games.get(id).error)
    const publish = (complete = false) => {
      if (!controller.signal.aborted)
        setResult({ key, attempt, code, games: new Map(games), complete })
    }
    let next = 0
    async function worker() {
      while (next < missing.length && !controller.signal.aborted) {
        const id = missing[next++]
        let detail
        try {
          const game = await getGame(id, controller.signal, code)
          detail = { id, game, unavailable: !game }
        } catch (error) {
          detail = { id, unavailable: error.status === 404, error: error.status !== 404 }
        }
        if (!controller.signal.aborted) {
          games.set(id, detail)
          publish()
        }
      }
    }
    // Publish each completed card, reuse known details and keep large libraries bounded.
    Promise.all(Array.from({ length: Math.min(4, missing.length) }, worker)).then(() =>
      publish(true),
    )
    return () => controller.abort()
  }, [key, attempt, code])
  const current =
    result?.key === key && result?.attempt === attempt && result?.code === code && result.complete
  // Ownership is authoritative even while metadata requests are pending.
  const games =
    result?.code === code ? orders.ownedIds.map((id) => result.games.get(id)).filter(Boolean) : []
  const search = query.trim().normalize('NFKC').toLocaleLowerCase()
  const visibleGames = games.filter(({ id, game }) =>
    (game?.title || `Game #${id}`).normalize('NFKC').toLocaleLowerCase().includes(search),
  )
  return (
    <section className="account-section user-library" aria-labelledby="library-title">
      <h2 id="library-title">Your library</h2>
      {orders.loading && <p role="status">Loading library...</p>}
      {orders.error && (
        <div role="alert">
          <p>Could not load your purchases. {orders.error}</p>
          <button onClick={orders.retry}>Retry library</button>
        </div>
      )}
      {!orders.loading && !orders.error && !orders.ownedIds.length && (
        <p>
          Your library is empty. <a href="#/discover">Explore the catalog</a>
        </p>
      )}
      {!!orders.ownedIds.length &&
        !current &&
        (unavailable ? (
          <div role="alert">
            <p>Could not load your wallet currency. {unavailable}</p>
            <button type="button" disabled={walletLoading || walletBusy} onClick={refreshWallet}>
              Retry wallet
            </button>
          </div>
        ) : (
          <p role="status">Loading game details...</p>
        ))}
      {!!orders.ownedIds.length && (
        <>
          {games.some((item) => item.error) && (
            <p role="alert">
              Some games could not be loaded.{' '}
              <button disabled={!current} onClick={() => setAttempt((value) => value + 1)}>
                Retry game details
              </button>
            </p>
          )}
          {!!orders.ownedIds.length && (
            <>
              <div className="library-search">
                <label htmlFor="library-search">Search your library</label>
                <div>
                  <input
                    id="library-search"
                    type="search"
                    value={query}
                    maxLength={200}
                    placeholder="Game title"
                    onChange={(event) => setQuery(event.target.value)}
                    aria-controls="library-games"
                  />
                  {query && (
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => setQuery('')}
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </div>
              <p role="status">
                Showing {visibleGames.length} of {orders.ownedIds.length} games
              </p>
              {current && !visibleGames.length && (
                <p>No games in your library match this search.</p>
              )}
            </>
          )}
          <div id="library-games" className="library-grid">
            {visibleGames.map(({ id, game, unavailable, error }) => (
              <article className="library-card" key={id} aria-labelledby={`library-title-${id}`}>
                <a
                  className="library-card__cover"
                  href={`#/games/${encodeURIComponent(id)}`}
                  aria-label={game?.title || `Game #${id}`}
                >
                  <MediaImage
                    src={game?.libraryPoster || game?.image}
                    fallbackSrc={game?.headerImage || game?.libraryHero}
                    alt=""
                  />
                </a>
                <h3 id={`library-title-${id}`}>{game?.title || `Game #${id}`}</h3>
                <p>
                  {unavailable
                    ? 'No longer available in the catalog'
                    : error
                      ? 'Game details unavailable'
                      : 'In your library'}
                </p>
                <div className="library-card__actions">
                  <a
                    className="button button--secondary"
                    href={`#/games/${encodeURIComponent(id)}`}
                  >
                    View game
                  </a>
                  <a
                    className="button button--secondary"
                    href={`#/products/${encodeURIComponent(id)}/achievements`}
                  >
                    Achievements
                  </a>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

export default function Library() {
  const { currentUser } = useAuth()
  return currentUser ? <LibrarySession key={currentUser.id} /> : null
}
