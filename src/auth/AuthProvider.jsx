import { useEffect, useRef, useState } from 'react'
import { AuthContext } from './context'
import { getCurrentUser, loginUser, logoutUser } from '../api/auth'
import { resetSession } from '../api/client'

export default function AuthProvider({ children }) {
  const [currentUser, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [isRefreshing, setRefreshing] = useState(false)
  const [isLoggingOut, setLoggingOut] = useState(false)
  const identity = useRef(null)
  const version = useRef(0)
  const channel = useRef(null)
  const logoutLock = useRef(false)
  function updateUser(user) { identity.current = user; setUser(user) }
  function updateProfile(user) {
    if (identity.current && identity.current.id === user?.id) updateUser(user)
  }
  useEffect(() => {
    let disposed = false
    const initialVersion = version.current
    const clear = (nextStatus, message = '') => {
      version.current += 1; resetSession(false); updateUser(null); setStatus(nextStatus); setError(message)
    }
    const expired = () => clear('anonymous', identity.current ? 'Your session has ended. Please sign in again.' : '')
    const banned = () => clear('banned', 'Your account is blocked. Contact support for assistance.')
    const refreshing = event => setRefreshing(event.detail)
    const receive = event => { if (event.data === 'logout') clear('anonymous') }
    channel.current = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('vstore:auth')
    if (channel.current) channel.current.onmessage = receive
    window.addEventListener('vstore:session-expired', expired)
    window.addEventListener('vstore:account-banned', banned)
    window.addEventListener('vstore:refresh', refreshing)
    getCurrentUser().then(user => {
      if (!disposed && initialVersion === version.current) { updateUser(user); setStatus('authenticated') }
    }).catch(reason => {
      if (!disposed && initialVersion === version.current) {
        setStatus(reason.banned ? 'banned' : reason.status === 401 ? 'anonymous' : 'error')
        setError(reason.status === 401 ? '' : reason.message)
      }
    })
    return () => {
      disposed = true; channel.current?.close()
      window.removeEventListener('vstore:session-expired', expired)
      window.removeEventListener('vstore:account-banned', banned)
      window.removeEventListener('vstore:refresh', refreshing)
    }
  }, [])
  async function login(payload) {
    const attempt = ++version.current
    resetSession(); setError('')
    const result = await loginUser(payload)
    if (attempt !== version.current) throw new Error('The session changed. Please sign in again.')
    updateUser(result.data); setStatus('authenticated')
    return result
  }
  async function logout(all = false) {
    if (logoutLock.current) return
    logoutLock.current = true
    version.current += 1; resetSession(false)
    updateUser(null); setStatus('anonymous'); setError(''); setLoggingOut(true)
    channel.current?.postMessage('logout')
    try { await logoutUser(all) }
    catch (reason) { setError('Could not complete sign out on the server. Please retry. ' + reason.message); throw reason }
    finally { logoutLock.current = false; setLoggingOut(false) }
  }
  return <AuthContext.Provider value={{ currentUser, isAuthenticated: Boolean(currentUser), status, error,
    isRefreshing, isLoggingOut, login, logout, updateUser: updateProfile }}>{children}</AuthContext.Provider>
}
