import { useEffect, useId, useRef, useState } from 'react'
import { useCurrency } from './context'
import globeIcon from '../assets/discover/figma/977c7.svg'

export default function CurrencySelector({ profile = false }) {
  const currency = useCurrency()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const container = useRef(null)
  const trigger = useRef(null)
  useEffect(() => {
    if (!open) return
    const outside = event => { if (!container.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  const choices = <>
    {currency.loading && <p role="status">Loading currencies...</p>}
    {currency.error && <div role="alert"><p>{currency.error}</p><button type="button" onClick={currency.retry}>Retry currencies</button></div>}
    {currency.walletError && <div role="alert"><p>{currency.walletError}</p><button type="button" onClick={currency.refreshWallet}>Refresh wallet</button></div>}
    {!currency.loading && !currency.error && <label className="currency-field">{profile ? 'Wallet and store currency' : 'Store currency'}
      <select aria-label={profile ? 'Wallet and store currency' : 'Store currency'} value={currency.code || ''} disabled={currency.disabled} onChange={event => { currency.choose(event.target.value); setOpen(false); trigger.current?.focus() }}>
        {!currency.currencies.some(item => item.code === currency.code) && <option value={currency.code || ''}>{currency.code || 'Loading...'}</option>}
        {currency.currencies.map(item => <option value={item.code} key={item.code}>{item.code} · {item.symbol} · {item.name}</option>)}
      </select>
    </label>}
  </>
  if (profile) return <section className="account-section currency-settings" aria-label="Wallet and store currency"><h2>Wallet and store currency</h2>{choices}</section>
  return <div className="currency-menu" ref={container} onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus() } }}>
    <button type="button" className="currency-trigger" ref={trigger} aria-label="Choose currency" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)}>
      <img src={globeIcon} alt="" /><span>{currency.code || '...'}</span>
    </button>
    {open && <div className="currency-menu__panel" id={menuId}>{choices}</div>}
  </div>
}
