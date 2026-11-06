import { useCallback, useState } from 'react'
import { useAuth } from '../auth/context'
import { getGameArtworks, getGameDiscussions } from '../api/community'
import { MediaImage } from '../components/Catalog/Media'
import { Author, CommunityError } from './CommunityParts'
import useCommunityResource from './useCommunityResource'
import CommunityEditor from './CommunityEditor'
import CommunityDetail from './CommunityDetail'
import './Community.css'

export function Collection({ gameId, kind, onSignIn }) {
  const { isAuthenticated } = useAuth()
  const loader = useCallback(
    (signal) => (kind === 'artwork' ? getGameArtworks : getGameDiscussions)(gameId, signal),
    [gameId, kind],
  )
  const resource = useCommunityResource(loader)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  function saved(item) {
    resource.apply((items) => [item, ...(items || []).filter((old) => old.id !== item.id)])
    setCreating(false)
    setSelected(item.id)
    setMessage(kind === 'artwork' ? 'Artwork published.' : 'Discussion published.')
  }
  return (
    <>
      <div className="community-actions">
        <button
          className="button button--accent"
          type="button"
          onClick={() => (isAuthenticated ? setCreating(true) : onSignIn())}
        >
          {isAuthenticated
            ? kind === 'artwork'
              ? 'Share artwork'
              : 'Start discussion'
            : 'Sign in to ' + (kind === 'artwork' ? 'share artwork' : 'start a discussion')}
        </button>
        <button type="button" disabled={resource.loading} onClick={resource.reload}>
          Refresh {kind === 'artwork' ? 'artworks' : 'discussions'}
        </button>
      </div>
      {creating && (
        <CommunityEditor
          kind={kind}
          gameId={gameId}
          onSaved={saved}
          onCancel={() => setCreating(false)}
        />
      )}
      {message && <p role="status">{message}</p>}
      {resource.loading && (
        <p role="status">Loading {kind === 'artwork' ? 'artworks' : 'discussions'}…</p>
      )}
      <CommunityError error={resource.error} retry={resource.reload} disabled={resource.loading} />
      {!resource.loading && !resource.error && !resource.data?.length && (
        <p>No {kind === 'artwork' ? 'artworks' : 'discussions'} yet. Be the first to share.</p>
      )}
      {!!resource.data?.length && (
        <ul className={'community-list community-list--' + kind}>
          {resource.data.map((item) => (
            <li key={item.id} className="community-card">
              <button type="button" className="community-open" onClick={() => setSelected(item.id)}>
                {kind === 'artwork' && (
                  <MediaImage className="community-thumbnail" src={item.image_url} alt="" />
                )}
                <span>{item.title}</span>
              </button>
              <Author item={item} />
            </li>
          ))}
        </ul>
      )}
      {selected != null && (
        <CommunityDetail
          key={kind + selected}
          kind={kind}
          id={selected}
          gameId={gameId}
          onClose={() => setSelected(null)}
          onUpdated={(item) =>
            resource.apply((items) => items.map((old) => (old.id === item.id ? item : old)))
          }
          onDeleted={(id) => {
            resource.apply((items) => items.filter((old) => old.id !== id))
            setSelected(null)
            setMessage(kind === 'artwork' ? 'Artwork deleted.' : 'Discussion deleted.')
          }}
          onSignIn={onSignIn}
        />
      )}
    </>
  )
}
function CommunitySession({ gameId, onSignIn }) {
  const [kind, setKind] = useState('discussion')
  return (
    <section className="game-community detail-section" aria-label="Community">
      <h2>Community</h2>
      <p>Talk about the game and share what you create.</p>
      <div className="community-switcher" role="group" aria-label="Community categories">
        <button
          type="button"
          aria-pressed={kind === 'discussion'}
          onClick={() => setKind('discussion')}
        >
          Discussions
        </button>
        <button type="button" aria-pressed={kind === 'artwork'} onClick={() => setKind('artwork')}>
          Artwork
        </button>
      </div>
      <Collection key={kind} gameId={gameId} kind={kind} onSignIn={onSignIn} />
    </section>
  )
}
export default function GameCommunity(props) {
  const { currentUser, isAuthenticated } = useAuth()
  return (
    <CommunitySession
      key={props.gameId + ':' + (isAuthenticated ? currentUser?.id : 'guest')}
      {...props}
    />
  )
}
