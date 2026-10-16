import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/context'
import { getWallet, topUpWallet, walletError } from '../api/wallet'
import { WalletContext } from './context'

function WalletSession({ owner, children }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(owner != null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const active = useRef(false)
  const lock = useRef(false)
  const request = useRef(null)

  const load = useCallback(() => {
    if (owner == null || !active.current || lock.current) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    return getWallet(controller.signal).then(wallet => {
      if (!controller.signal.aborted && active.current) {
        setData(wallet); setError(''); setRevision(value => value + 1)
      }
    }).catch(reason => {
      if (!controller.signal.aborted && active.current) setError(walletError(reason))
    }).finally(() => {
      if (!controller.signal.aborted && active.current) setLoading(false)
    })
  }, [owner])

  const refresh = useCallback(() => {
    if (owner == null || !active.current || lock.current) return
    setLoading(true)
    return load()
  }, [load, owner])

  useEffect(() => {
    active.current = true
    load()
    window.addEventListener('focus', refresh)
    return () => { active.current = false; request.current?.abort(); window.removeEventListener('focus', refresh) }
  }, [load, refresh])

  async function topUp(amount) {
    if (owner == null) throw new Error('Please sign in to top up your wallet.')
    if (lock.current) throw new Error('A top-up is already being processed.')
    lock.current = true
    request.current?.abort()
    setBusy(true); setLoading(false)
    try {
      const wallet = await topUpWallet(amount)
      if (!active.current) return null
      setData(wallet); setError(''); setRevision(value => value + 1)
      return wallet
    } catch (reason) {
      // A lost response may still represent a successful deposit. Reconcile, never auto-retry a payment.
      lock.current = false
      await refresh()
      throw reason
    } finally { lock.current = false; if (active.current) setBusy(false) }
  }

  return <WalletContext.Provider value={{ data, loading, error, busy, revision, refresh, topUp }}>{children}</WalletContext.Provider>
}

export default function WalletProvider({ children }) {
  const { currentUser } = useAuth()
  return <WalletSession key={currentUser?.id ?? 'guest'} owner={currentUser?.id}>{children}</WalletSession>
}
