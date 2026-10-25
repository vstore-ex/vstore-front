import { getReviewSummary } from '../api/reviews'
import { getUserById } from '../api/users'
import { getNews, getNewsById } from '../api/news'
import { useEffect, useState } from 'react'
import { getDiscover, getGame, getGames, getTags, searchGames } from '../api/catalog'
import { getGameAchievements, getUserAchievements } from '../api/achievements'
import { useCurrency } from '../currency/context'
const pricedResources = ['game', 'games', 'discover', 'search']
const loaders = {
  reviewSummary: (key, signal) => getReviewSummary(JSON.parse(key).id, signal),
  userProfile: getUserById,
  userAchievements: getUserAchievements,
  news: (key, signal) => getNews(JSON.parse(key), signal),
  newsDetail: getNewsById,
  search: searchGames,
  discover: getDiscover,
  game: getGame,
  games: getGames,
  tags: getTags,
  achievements: (key, signal) => {
    const { id, page, pageSize } = JSON.parse(key)
    return getGameAchievements(id, { page, pageSize }, signal)
  },
}
export default function useCatalogResource(type, key = '', retainScope = null) {
  const currency = useCurrency()
  const priced = pricedResources.includes(type)
  const code = priced ? currency.code : ''
  const waiting = priced && (!code || currency.switching)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  useEffect(() => {
    if (waiting) return
    const controller = new AbortController()
    loaders[type](key, controller.signal, code).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ type, key, retainScope, attempt, code, data })
      },
      (error) => {
        if (!controller.signal.aborted)
          setResult((previous) => ({
            type,
            key,
            retainScope,
            attempt,
            code,
            error,
            data:
              retainScope !== null &&
              previous?.type === type &&
              previous.retainScope === retainScope &&
              previous.code === code
                ? previous.data
                : null,
          }))
      },
    )
    return () => controller.abort()
  }, [type, key, attempt, retainScope, code, waiting])
  if (priced && currency.unavailable)
    return {
      data: null,
      loading: false,
      error: new Error(currency.unavailable),
      retry: currency.retryPrices || currency.refreshWallet,
    }
  const current =
    !waiting &&
    result?.type === type &&
    result.key === key &&
    result.attempt === attempt &&
    result.retainScope === retainScope &&
    result.code === code
  const retained =
    !waiting &&
    retainScope !== null &&
    result?.type === type &&
    result.retainScope === retainScope &&
    result.code === code
  return {
    data: current || retained ? result?.data : null,
    error: current ? result.error : null,
    loading: !current,
    retry: () => setAttempt((value) => value + 1),
  }
}
