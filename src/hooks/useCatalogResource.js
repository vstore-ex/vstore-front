import { getUserById, getUserAchievements } from '../api/users'
import { getNews, getNewsById } from '../api/news'
import { useEffect, useState } from 'react'
import { getDiscover, getGame, getGames, getTags, searchGames } from '../api/catalog'
import { getAchievements, getReviews } from '../api/product'
const loaders = { userProfile: getUserById, userAchievements: getUserAchievements, news: (key, signal) => getNews(JSON.parse(key), signal), newsDetail: getNewsById, search: searchGames, discover: getDiscover, game: getGame, games: getGames, tags: getTags, achievements: getAchievements, reviews: getReviews }
export default function useCatalogResource(type, key = '', retainScope = null) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    loaders[type](key, controller.signal).then(
      data => { if (!controller.signal.aborted) setResult({ type, key, retainScope, attempt, data }) },
      error => {
        if (!controller.signal.aborted) setResult(previous => ({
          type, key, retainScope, attempt, error,
          data: retainScope !== null && previous?.type === type && previous.retainScope === retainScope ? previous.data : null,
        }))
      },
    )
    return () => controller.abort()
  }, [type, key, attempt, retainScope])
  const current = result?.type === type && result.key === key && result.attempt === attempt && result.retainScope === retainScope
  const retained = retainScope !== null && result?.type === type && result.retainScope === retainScope
  return { data: current || retained ? result?.data : null, error: current ? result.error : null,
    loading: !current, retry: () => setAttempt(value => value + 1) }
}
