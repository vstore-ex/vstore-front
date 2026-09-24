import { useEffect, useId, useRef, useState } from 'react'
import { searchGames } from '../../api/search'
import { MediaImage } from '../Catalog/Media'
import searchIcon from '../../assets/icon-search.svg'
import './StoreSearch.css'

export default function StoreSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [composing, setComposing] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  const [selected, setSelected] = useState(-1)
  const root = useRef(null), input = useRef(null)
  const id = useId()
  const term = query.trim()
  const eligible = term.length >= 2 && !composing
  const current = result?.term === term && result.attempt === attempt
  const games = current ? result.games || [] : []
  const error = current ? result.error : ''
  const loading = eligible && !current
  const visible = open && eligible
  useEffect(() => {
    if (!open || !eligible) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchGames(term, 8, controller.signal).then(games => {
        if (!controller.signal.aborted) setResult({ term, attempt, games })
      }).catch(error => {
        if (!controller.signal.aborted) setResult({ term, attempt, error: error.message || 'Search is unavailable. Please try again.' })
      })
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [term, attempt, open, eligible])
  useEffect(() => {
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false) }
    const navigate = () => { setOpen(false); setQuery(''); setSelected(-1) }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('hashchange', navigate)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('hashchange', navigate) }
  }, [])
  useEffect(() => {
    if (selected >= 0 && visible) document.getElementById(`${id}-${selected}`)?.scrollIntoView({ block: 'nearest' })
  }, [selected, visible, id])
  function choose(game) {
    setQuery(''); setOpen(false); setSelected(-1)
    window.location.hash = `#/products/${game.id}`
  }
  function keyDown(event) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setSelected(-1) }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true)
      if (games.length) setSelected(index => event.key === 'ArrowDown' ? (index + 1) % games.length : (index <= 0 ? games.length - 1 : index - 1))
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (visible && !loading && games.length) choose(games[selected] || games[0])
      else setOpen(true)
    }
  }
  return <div className="store-search" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <div className="search-field">
      <img className="search-field__icon" src={searchIcon} alt="" />
      <input ref={input} className="search-field__input" type="search" placeholder="Search store" aria-label="Search store"
        role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={visible ? id : undefined}
        aria-activedescendant={visible && selected >= 0 && games[selected] ? `${id}-${selected}` : undefined}
        value={query} autoComplete="off" onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={keyDown}
        onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}
        onChange={event => { setQuery(event.target.value); setOpen(true); setSelected(-1) }} />
      {query && <button className="store-search__clear" type="button" aria-label="Clear search" onClick={() => { setQuery(''); setOpen(false); setSelected(-1); input.current?.focus() }}>&times;</button>}
    </div>
    {visible && <div className="store-search__dropdown">
      {loading && <p role="status">Searching...</p>}
      {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => { setAttempt(a => a + 1); setSelected(-1) }}>Retry search</button></div>}
      {!loading && !error && !games.length && <p role="status">No games found for "{term}".</p>}
      <ul id={id} role="listbox" aria-label="Game search results">{games.map((game, index) => <li role="presentation" key={game.id}>
        <a id={`${id}-${index}`} role="option" aria-selected={selected === index} tabIndex={-1} href={`#/products/${game.id}`}
          className="store-search__result" onClick={event => { event.preventDefault(); choose(game) }}>
          <MediaImage className="store-search__cover" src={game.image} alt="" />
          <span className="store-search__text"><strong>{game.title}</strong><span>{game.tags.map(tag => tag.name).join(', ')}</span>
            <span className="store-search__price">{game.discount && <span>{game.discount} </span>}{game.originalPrice && <del>{game.originalPrice}</del>} {game.price}</span>
          </span>
        </a>
      </li>)}</ul>
    </div>}
  </div>
}
