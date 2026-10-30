import { useCallback, useId, useState } from 'react'
import Dialog from '../components/Dialog/Dialog'
import { MediaImage } from '../components/Catalog/Media'
import { ProductMarkdown } from '../pages/ProductDetailPage/ProductContent'
import { useAuth } from '../auth/context'
import { deleteCommunityItem, getCommunityItem } from '../api/community'
import useCommunityResource from './useCommunityResource'
import useCommunityTask from './useCommunityTask'
import { Author, CommunityError, DeleteConfirmation } from './CommunityParts'
import CommunityEditor from './CommunityEditor'
import ThreadComments from './ThreadComments'

export default function CommunityDetail({
  kind,
  id,
  gameId,
  onClose,
  onUpdated,
  onDeleted,
  onSignIn,
}) {
  const { currentUser, isAuthenticated } = useAuth()
  const loader = useCallback(
    async (signal) => {
      const item = await getCommunityItem(kind, id, signal)
      if (item.game_id !== gameId) throw new Error('This content belongs to a different game.')
      return item
    },
    [kind, id, gameId],
  )
  const resource = useCommunityResource(loader)
  const task = useCommunityTask()
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const heading = useId()
  const item = resource.data
  const own = isAuthenticated && currentUser?.id === item?.author_id
  return (
    <Dialog className="community-dialog" labelledBy={heading} onClose={onClose} busy={task.busy}>
      <h2 id={heading}>{item?.title || (kind === 'artwork' ? 'Artwork' : 'Discussion')}</h2>
      {resource.loading && <p role="status">Loading {kind}…</p>}
      <CommunityError error={resource.error} retry={resource.reload} disabled={resource.loading} />
      {item && (
        <>
          <Author item={item} />
          {editing && own ? (
            <CommunityEditor
              kind={kind}
              gameId={gameId}
              item={item}
              onCancel={() => setEditing(false)}
              onSaved={(saved) => {
                resource.apply(() => saved)
                onUpdated(saved)
                setEditing(false)
              }}
            />
          ) : (
            <>
              {kind === 'artwork' && (
                <MediaImage
                  className="community-detail-image"
                  src={item.image_url}
                  alt={item.title}
                  eager
                />
              )}
              <ProductMarkdown allowImages={kind !== 'artwork'}>
                {kind === 'artwork' ? item.description_md : item.content_md}
              </ProductMarkdown>
              {own && (
                <div className="community-actions">
                  <button
                    type="button"
                    disabled={task.busy || resource.loading || !!resource.error}
                    onClick={() => {
                      setEditing(true)
                      setConfirm(false)
                    }}
                  >
                    Edit {kind}
                  </button>
                  <button
                    type="button"
                    disabled={task.busy || resource.loading || !!resource.error}
                    onClick={() => setConfirm(true)}
                  >
                    Delete {kind}
                  </button>
                </div>
              )}
            </>
          )}
          {confirm && (
            <DeleteConfirmation
              label={kind}
              busy={task.busy}
              onCancel={() => setConfirm(false)}
              onConfirm={() =>
                task.run(
                  (signal) => deleteCommunityItem(kind, item.id, signal),
                  () => onDeleted(item.id),
                )
              }
            />
          )}
          <CommunityError error={task.error} />
          <ThreadComments
            key={item.thread_id}
            threadId={item.thread_id}
            isClosed={item.is_closed}
            onSignIn={onSignIn}
          />
        </>
      )}
    </Dialog>
  )
}
