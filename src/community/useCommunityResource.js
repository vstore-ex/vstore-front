import { useCallback, useEffect, useRef, useState } from 'react'

export default function useCommunityResource(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const request = useRef(null)
  const reload = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setState((previous) => ({ ...previous, loading: true, error: null }))
    try {
      const data = await loader(controller.signal)
      if (!controller.signal.aborted) setState({ data, loading: false, error: null })
    } catch (error) {
      if (!controller.signal.aborted)
        setState((previous) => ({ ...previous, loading: false, error }))
    }
  }, [loader])
  useEffect(() => {
    reload()
    return () => request.current?.abort()
  }, [reload])
  function apply(update) {
    request.current?.abort()
    setState((previous) => ({ data: update(previous.data), loading: false, error: null }))
  }
  return { ...state, reload, apply }
}
