import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'
export default function usePublicContent(path) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    apiRequest(path, { auth: false, signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setResult({ path, attempt, data })
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ path, attempt, error: error.message })
    })
    return () => controller.abort()
  }, [path, attempt])
  const current = result?.path === path && result.attempt === attempt
  return { data: current ? result.data : null, error: current ? result.error : '', loading: !current,
    retry: () => setAttempt(value => value + 1) }
}
