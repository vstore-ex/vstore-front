import { useEffect, useState } from 'react'
import { getDiscover, getGame, getGames, getTags } from '../api/catalog'
const loaders = { discover: getDiscover, game: getGame, games: getGames, tags: getTags }
export default function useCatalogResource(type, key = '') {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    loaders[type](key, controller.signal).then(
      data => { if (!controller.signal.aborted) setResult({ type, key, attempt, data }) },
      error => { if (!controller.signal.aborted) setResult({ type, key, attempt, error }) },
    )
    return () => controller.abort()
  }, [type, key, attempt])
  const current = result?.type === type && result.key === key && result.attempt === attempt
  return { data: current ? result.data : null, error: current ? result.error : null,
    loading: !current, retry: () => setAttempt(value => value + 1) }
}
