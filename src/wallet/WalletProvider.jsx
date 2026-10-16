import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/context'
import { getWallet, topUpWallet, walletError } from '../api/wallet'
import { WalletContext } from './context'
import { changeCurrency } from '../api/currency'

function WalletSession({ owner, children }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(owner != null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [operation, setOperation] = useState(null)
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

  async function mutate(action, type) {
    if (owner == null) throw new Error('Please sign in to use your wallet.')
    if (lock.current) throw new Error('A wallet operation is already being processed.')
    lock.current = true
    request.current?.abort()
    setBusy(true); setOperation(type); setLoading(false)
    try {
      const wallet = await action()
      if (!active.current) return null
      setData(wallet); setError(''); setRevision(value => value + 1)
      return wallet
    } catch (reason) {
      // A lost response may still represent a successful deposit. Reconcile, never auto-retry a payment.
      lock.current = false
      await refresh()
      throw reason
    } finally { lock.current = false; if (active.current) { setBusy(false); setOperation(null) } }
  }

  return <WalletContext.Provider value={{ data, loading, error, busy, operation, revision, refresh,
    topUp: amount => mutate(() => topUpWallet(amount), 'top-up'),
    changeCurrency: code => mutate(() => changeCurrency(code), 'currency'),
  }}>{children}</WalletContext.Provider>
}

export default function WalletProvider({ children }) {
  const { currentUser } = useAuth()
  return <WalletSession key={currentUser?.id ?? 'guest'} owner={currentUser?.id}>{children}</WalletSession>
}
