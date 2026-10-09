import { useEffect, useState } from 'react'
import { getGame } from '../../api/catalog'
import useOrders from '../../hooks/useOrders'

export default function Library() {
  const orders = useOrders()
  const key = JSON.stringify([...orders.ownedIds].sort())
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    const ids = JSON.parse(key)
    const games = new Array(ids.length)
    let next = 0
    async function worker() {
      while (next < ids.length && !controller.signal.aborted) {
        const index = next++, id = ids[index]
        try {
          const game = await getGame(id, controller.signal)
          games[index] = { id, game, unavailable: !game }
        } catch (error) {
          games[index] = { id, unavailable: error.status === 404, error: error.status !== 404 }
        }
      }
    }
    // Limit concurrent detail requests for large libraries.
    Promise.all(Array.from({ length: Math.min(4, ids.length) }, worker)).then(() => {
      if (!controller.signal.aborted) setResult({ key, attempt, games })
    })
    return () => controller.abort()
  }, [key, attempt])
  const current = result?.key === key && result?.attempt === attempt
  return <section className="account-section user-library" aria-labelledby="library-title">
    <h2 id="library-title">Your library</h2>
    {orders.loading && <p role="status">Loading library...</p>}
    {orders.error && <div role="alert"><p>Could not load your purchases. {orders.error}</p><button onClick={orders.retry}>Retry library</button></div>}
    {!orders.loading && !orders.error && !orders.ownedIds.length && <p>Your library is empty. <a href="#/discover">Explore the catalog</a></p>}
    {!!orders.ownedIds.length && !current && <p role="status">Loading game details...</p>}
    {current && <>
      {result.games.some(item => item.error) && <p role="alert">Some games could not be loaded. <button onClick={() => setAttempt(value => value + 1)}>Retry game details</button></p>}
      <div className="library-grid">{result.games.map(({ id, game, unavailable, error }) => <article className="library-card" key={id}>
        <a href={`#/games/${id}`} aria-label={game?.title || `Game #${id}`}>
          {game?.libraryHero || game?.headerImage || game?.image ? <img src={game.libraryHero || game.headerImage || game.image} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true }} /> : <div className="library-cover-placeholder" aria-hidden="true" />}
          <h3>{game?.title || `Game #${id}`}</h3>
        </a>
        <p>{unavailable ? 'No longer available in the catalog' : error ? 'Game details unavailable' : 'In your library'}</p>
      </article>)}</div>
    </>}
  </section>
}
