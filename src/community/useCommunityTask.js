import { useEffect, useRef, useState } from 'react'

export default function useCommunityTask() {
  const request = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  useEffect(() => () => request.current?.abort(), [])
  async function run(action, onSuccess) {
    if (request.current) return false
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError(null)
    try {
      const result = await action(controller.signal)
      if (controller.signal.aborted) return false
      onSuccess?.(result)
      return true
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason)
      return false
    } finally {
      if (request.current === controller) {
        request.current = null
        if (!controller.signal.aborted) setBusy(false)
      }
    }
  }
  return { run, busy, error }
}
