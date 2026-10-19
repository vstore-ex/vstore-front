import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'

export default function useResource(path, revision = 0, keepPrevious = false) {
  const [state, setState] = useState({ path: null, revision: -1, data: null, error: '' })
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    apiRequest(path, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setState({ path, revision, data, error: '' })
      },
      (error) => {
        if (!controller.signal.aborted)
          setState({ path, revision, data: null, error: error.message })
      },
    )
    return () => controller.abort()
  }, [path, revision])
  return path && state.path === path && state.revision === revision
    ? { ...state, loading: false }
    : {
        data: keepPrevious && state.path === path ? state.data : null,
        error: '',
        loading: Boolean(path),
      }
}
