import { useCallback, useId, useState } from 'react'
import { useAuth } from '../auth/context'
import { deleteComment, getComments, saveComment } from '../api/community'
import { ProductMarkdown } from '../pages/ProductDetailPage/ProductContent'
import useCommunityResource from './useCommunityResource'
import useCommunityTask from './useCommunityTask'
import { Author, CommunityError, DeleteConfirmation } from './CommunityParts'

function CommentForm({ item, threadId, onSaved, onCancel, onClosed, disabled }) {
  const [content, setContent] = useState(item?.content_md || '')
  const task = useCommunityTask()
  const id = useId()
  async function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    await task.run(
      async (signal) => {
        try {
          return await saveComment(threadId, { id: item?.id, content_md: content }, signal)
        } catch (error) {
          if (!signal.aborted && error.message === 'thread is closed') onClosed()
          throw error
        }
      },
      (saved) => {
        form.reset()
        setContent('')
        onSaved(saved)
      },
    )
  }
  return (
    <form
      className="community-editor"
      aria-label={item ? 'Edit comment' : 'Add comment'}
      onSubmit={submit}
    >
      <fieldset disabled={task.busy || disabled}>
        <label htmlFor={id}>{item ? 'Edit comment' : 'Your comment'}</label>
        <textarea
          id={id}
          rows={3}
          required
          maxLength={10000}
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <small>Markdown supported; images are not included in comments.</small>
        <div className="community-actions">
          <button type="submit" disabled={!content.trim()}>
            {task.busy ? 'Saving…' : item ? 'Save comment' : 'Post comment'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel}>
              Cancel editing
            </button>
          )}
        </div>
      </fieldset>
      <CommunityError error={task.error} />
    </form>
  )
}
function CommentCard({ item, threadId, readOnly, disabled, onSaved, onDeleted, onClosed }) {
  const { currentUser, isAuthenticated } = useAuth()
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const task = useCommunityTask()
  const own = isAuthenticated && currentUser?.id === item.author_id
  return (
    <li className="community-comment">
      <Author item={item} />
      {editing && !readOnly ? (
        <CommentForm
          item={item}
          disabled={disabled}
          threadId={threadId}
          onClosed={onClosed}
          onSaved={(saved) => {
            setEditing(false)
            onSaved(saved)
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <ProductMarkdown allowImages={false}>{item.content_md}</ProductMarkdown>
      )}
      {own && !readOnly && !editing && (
        <div className="community-actions">
          <button
            type="button"
            disabled={task.busy || disabled}
            onClick={() => {
              setEditing(true)
              setConfirm(false)
            }}
          >
            Edit comment
          </button>
          <button type="button" disabled={task.busy || disabled} onClick={() => setConfirm(true)}>
            Delete comment
          </button>
        </div>
      )}
      {confirm && !readOnly && (
        <DeleteConfirmation
          label="comment"
          busy={task.busy || disabled}
          onCancel={() => setConfirm(false)}
          onConfirm={() =>
            task.run(
              (signal) => deleteComment(item.id, signal),
              () => onDeleted(item.id),
            )
          }
        />
      )}
      <CommunityError error={task.error} />
    </li>
  )
}

export default function ThreadComments({ threadId, isClosed, onSignIn }) {
  const { isAuthenticated } = useAuth()
  const loader = useCallback(
    (signal) =>
      getComments(threadId, {}, signal).then((items) => ({
        items,
        offset: items.length,
        more: items.length === 20,
      })),
    [threadId],
  )
  const resource = useCommunityResource(loader)
  const more = useCommunityTask()
  const [closed, setClosed] = useState(false)
  const [message, setMessage] = useState('')
  const [fresh, setFresh] = useState([])
  const readOnly = isClosed === true || closed
  const items = [
    ...fresh.filter((item) => !resource.data?.items.some((old) => old.id === item.id)),
    ...(resource.data?.items || []),
  ]
  function saved(item) {
    setFresh((previous) => previous.map((old) => (old.id === item.id ? item : old)))
    resource.apply((data) => ({
      ...data,
      items: data.items.map((old) => (old.id === item.id ? item : old)),
    }))
    setMessage('Comment updated.')
  }
  function deleted(id) {
    setFresh((previous) => previous.filter((item) => item.id !== id))
    // Offset pagination shifts after deletion. Refresh from the first page.
    resource.apply((data) => ({ ...data, items: data.items.filter((item) => item.id !== id) }))
    resource.reload()
    setMessage('Comment deleted.')
  }
  function loadMore() {
    more.run(
      (signal) => getComments(threadId, { skip: resource.data.offset, limit: 20 }, signal),
      (next) =>
        resource.apply((data) => ({
          items: [
            ...data.items,
            ...next.filter((item) => !data.items.some((old) => old.id === item.id)),
          ],
          offset: data.offset + next.length,
          more: next.length === 20,
        })),
    )
  }
  function refresh() {
    setFresh([])
    resource.reload()
  }
  return (
    <section className="community-comments" aria-label="Comments">
      <div className="community-heading">
        <h3>Comments</h3>
        <button type="button" disabled={resource.loading || more.busy} onClick={refresh}>
          Refresh comments
        </button>
      </div>
      {readOnly && <p role="status">This thread is closed. Comments are read-only.</p>}
      {message && <p role="status">{message}</p>}
      {resource.loading && <p role="status">Loading comments…</p>}
      <CommunityError error={resource.error} retry={refresh} disabled={resource.loading} />
      {!resource.loading && !resource.error && !items.length && <p>No comments yet.</p>}
      {!!items.length && (
        <ol className="community-comment-list">
          {items.map((item) => (
            <CommentCard
              key={item.id}
              item={item}
              threadId={threadId}
              readOnly={readOnly}
              disabled={resource.loading || more.busy || !!resource.error}
              onSaved={saved}
              onDeleted={deleted}
              onClosed={() => setClosed(true)}
            />
          ))}
        </ol>
      )}
      <CommunityError
        error={more.error}
        retry={loadMore}
        disabled={more.busy || resource.loading || !!resource.error}
      />
      {resource.data?.more && !resource.error && (
        <button type="button" disabled={more.busy || resource.loading} onClick={loadMore}>
          {more.busy ? 'Loading…' : 'Load more comments'}
        </button>
      )}
      {!readOnly &&
        (isAuthenticated ? (
          resource.data && (
            <CommentForm
              threadId={threadId}
              disabled={resource.loading || !!resource.error}
              onClosed={() => setClosed(true)}
              onSaved={(item) => {
                setFresh((previous) => [item, ...previous])
                setMessage('Comment posted.')
              }}
            />
          )
        ) : (
          <button type="button" onClick={onSignIn}>
            Sign in to comment
          </button>
        ))}
    </section>
  )
}
