import { useEffect } from 'react'
import { useAuth } from '../auth/context'
import { sendPresence } from '../api/friends'

// Backend presence expires after 120 seconds. One request per active minute is enough.
const INTERVAL = 60000

export default function PresenceHeartbeat() {
  const { currentUser, isAuthenticated } = useAuth()
  const userId = currentUser?.id
  useEffect(() => {
    if (!isAuthenticated || userId == null) return
    let disposed = false,
      denied = false,
      focused = document.hasFocus(),
      pageActive = true
    let timer,
      request,
      nextAttempt = 0,
      failures = 0
    const active = () =>
      !disposed && !denied && pageActive && focused && document.visibilityState === 'visible'
    function schedule() {
      clearTimeout(timer)
      if (active() && !request) timer = setTimeout(heartbeat, Math.max(0, nextAttempt - Date.now()))
    }
    async function heartbeat() {
      if (!active() || request) return
      const controller = new AbortController()
      request = controller
      nextAttempt = Date.now() + INTERVAL
      try {
        await sendPresence(controller.signal)
        if (!controller.signal.aborted) failures = 0
      } catch (error) {
        if (!controller.signal.aborted) {
          denied = [401, 403].includes(error.status)
          failures += 1
          nextAttempt = Date.now() + Math.min(INTERVAL * 2 ** Math.min(failures, 3), 300000)
        }
      } finally {
        if (request === controller) request = null
        schedule()
      }
    }
    function sync() {
      if (active()) schedule()
      else {
        clearTimeout(timer)
        request?.abort()
      }
    }
    const focus = () => {
      focused = true
      sync()
    }
    const blur = () => {
      focused = false
      sync()
    }
    const hide = () => {
      pageActive = false
      sync()
    }
    const show = () => {
      pageActive = true
      focused = document.hasFocus()
      sync()
    }
    window.addEventListener('focus', focus)
    window.addEventListener('blur', blur)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    document.addEventListener('visibilitychange', sync)
    schedule()
    return () => {
      disposed = true
      clearTimeout(timer)
      request?.abort()
      window.removeEventListener('focus', focus)
      window.removeEventListener('blur', blur)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', show)
      document.removeEventListener('visibilitychange', sync)
      // Let the backend TTL expire; an offline write could hide another active device.
    }
  }, [isAuthenticated, userId])
  return null
}
