import { apiRequest, mediaUrl } from './client'

const positiveId = (value) =>
  /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0
function idPath(value) {
  if (!positiveId(value)) throw new Error('Invalid community item ID.')
  return encodeURIComponent(value)
}
function gamePath(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value))
    throw new Error('Invalid game ID.')
  return encodeURIComponent(value)
}
function text(value, label, max, required = true) {
  if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > max)
    throw new Error(`${label} must contain ${required ? '1' : '0'}–${max} characters.`)
  return value.trim()
}
function normalize(item, kind) {
  if (
    !positiveId(item?.id) ||
    !positiveId(item.author_id) ||
    !positiveId(item.thread_id) ||
    typeof item.username !== 'string'
  )
    throw new Error('Could not read community content. Please refresh.')
  const content = kind === 'artwork' ? item.description_md : item.content_md
  if (
    (kind !== 'artwork' && typeof content !== 'string') ||
    (content != null && typeof content !== 'string') ||
    (kind !== 'comment' && (typeof item.title !== 'string' || typeof item.game_id !== 'string'))
  )
    throw new Error('Could not read community content. Please refresh.')
  return {
    id: Number(item.id),
    author_id: Number(item.author_id),
    thread_id: Number(item.thread_id),
    username: item.username,
    created_at:
      typeof item.created_at === 'string' && Number.isFinite(Date.parse(item.created_at))
        ? item.created_at
        : null,
    ...(kind === 'comment' ? {} : { game_id: item.game_id, title: item.title }),
    ...(kind === 'artwork'
      ? { description_md: content || '', image_url: mediaUrl(item.image_url) }
      : { content_md: content }),
    // Current API omits this field; retain it when the backend exposes thread status.
    is_closed: typeof item.is_closed === 'boolean' ? item.is_closed : null,
  }
}
async function readList(path, kind, signal) {
  const items = await apiRequest(path, { signal, auth: false, credentials: 'omit' })
  if (!Array.isArray(items)) throw new Error('Could not read the community list. Please refresh.')
  const result = items.map((item) => normalize(item, kind))
  if (new Set(result.map((item) => item.id)).size !== result.length)
    throw new Error('Could not read the community list. Please refresh.')
  return result
}
async function gameList(path, gameId, kind, signal) {
  const items = await readList(path + gamePath(gameId), kind, signal)
  if (items.some((item) => item.game_id !== gameId))
    throw new Error('Could not verify the game for this content. Please refresh.')
  return items
}
export async function getGameDiscussions(gameId, signal) {
  const items = await readList(
    '/community/games/' + gamePath(gameId) + '/discussions',
    'discussion',
    signal,
  )
  if (items.some((item) => item.game_id !== gameId))
    throw new Error('Could not verify the game for this content. Please refresh.')
  return items
}
export const getGameArtworks = (gameId, signal) =>
  gameList('/artworks/game/', gameId, 'artwork', signal)
export async function getCommunityItem(kind, id, signal) {
  const base = kind === 'artwork' ? '/artworks/' : '/community/discussions/'
  const item = normalize(
    await apiRequest(base + idPath(id), { signal, auth: false, credentials: 'omit' }),
    kind,
  )
  if (item.id !== Number(id))
    throw new Error('Could not verify this community item. Please refresh.')
  return item
}
export async function saveCommunityItem(
  kind,
  { id, game_id, title, content_md, description_md, image_url },
  signal,
) {
  const body = { title: text(title, 'Title', 200) }
  if (id != null) idPath(id)
  if (!id) {
    gamePath(game_id)
    body.game_id = game_id
  }
  if (kind === 'artwork') {
    if (!mediaUrl(image_url)) throw new Error('Upload an image before publishing artwork.')
    body.image_url = image_url
    body.description_md = text(description_md || '', 'Description', 10000, false)
  } else body.content_md = text(content_md, 'Discussion', 10000)
  const base = kind === 'artwork' ? '/artworks/' : '/community/discussions'
  const path = id ? base.replace(/\/$/, '') + '/' + idPath(id) : base
  const item = normalize(
    await apiRequest(path, { method: id ? 'PUT' : 'POST', body, signal }),
    kind,
  )
  if ((id != null && item.id !== Number(id)) || (game_id != null && item.game_id !== game_id))
    throw new Error('Could not confirm the saved community item. Please refresh before retrying.')
  return item
}
export const deleteCommunityItem = (kind, id, signal) =>
  apiRequest((kind === 'artwork' ? '/artworks/' : '/community/discussions/') + idPath(id), {
    method: 'DELETE',
    signal,
  })

export async function getComments(threadId, { skip = 0, limit = 20 } = {}, signal) {
  if (
    !Number.isSafeInteger(skip) ||
    skip < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new Error('Invalid comment pagination.')
  const items = await readList(
    '/community/threads/' + idPath(threadId) + '/comments?' + new URLSearchParams({ skip, limit }),
    'comment',
    signal,
  )
  if (items.some((item) => item.thread_id !== Number(threadId)))
    throw new Error('Could not verify the comment thread. Please refresh.')
  return items
}
export async function saveComment(threadId, { id, content_md }, signal) {
  idPath(threadId)
  if (id != null) idPath(id)
  const path = id
    ? '/community/comments/' + idPath(id)
    : '/community/threads/' + idPath(threadId) + '/comments'
  const item = normalize(
    await apiRequest(path, {
      method: id ? 'PUT' : 'POST',
      body: { content_md: text(content_md, 'Comment', 10000) },
      signal,
    }),
    'comment',
  )
  if (item.thread_id !== Number(threadId) || (id != null && item.id !== Number(id)))
    throw new Error('Could not confirm the saved comment. Please refresh before retrying.')
  return item
}
export const deleteComment = (id, signal) =>
  apiRequest('/community/comments/' + idPath(id), { method: 'DELETE', signal })

export const ARTWORK_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export function validateArtworkFile(file) {
  if (!(file instanceof File) || !ARTWORK_IMAGE_TYPES.includes(file.type))
    throw new Error('Choose a JPG, PNG, WebP or GIF image.')
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new Error('Choose an image between 1 byte and 10 MB.')
}
export async function uploadArtworkImage(file, signal) {
  validateArtworkFile(file)
  const body = new FormData()
  body.append('file', file)
  const result = await apiRequest('/media/upload', { method: 'POST', body, signal })
  const url = mediaUrl(result?.url)
  if (!url) throw new Error('The image upload could not be confirmed. Please try again.')
  return url
}
export function communityError(error) {
  if (error.status === 401) return 'Please sign in to continue.'
  if (error.status === 403)
    return 'You are not allowed to change this content. Refresh to check its current state.'
  if (error.status === 404) return 'This community content is no longer available.'
  if (error.message === 'thread is closed') return 'This thread is closed. Comments are read-only.'
  return error instanceof TypeError
    ? 'Could not connect. Please try again.'
    : error.message || 'Could not update community content. Please try again.'
}
