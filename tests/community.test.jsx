import { StrictMode, useState } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import GameCommunity from '../src/community/GameCommunity'
import { AuthContext } from '../src/auth/context'
import { apiRequest } from '../src/api/client'
import { deferred } from './helpers'

vi.mock('../src/api/client', async (original) => ({ ...(await original()), apiRequest: vi.fn() }))
const discussion = (extra = {}) => ({
  id: 1,
  game_id: 'game-a',
  title: 'Orbit tips',
  content_md: 'A **useful** discussion.',
  author_id: 7,
  username: 'player',
  thread_id: 101,
  created_at: '2026-10-29T12:00:00Z',
  ...extra,
})
const artwork = (extra = {}) => ({
  id: 2,
  game_id: 'game-a',
  title: 'Orbit landscape',
  description_md: 'My **artwork**',
  image_url: '/media/art.webp',
  author_id: 7,
  username: 'artist',
  thread_id: 201,
  created_at: '2026-10-29T12:00:00Z',
  ...extra,
})
const comment = (extra = {}) => ({
  id: 3,
  thread_id: 101,
  content_md: 'Great tips!',
  author_id: 7,
  username: 'player',
  created_at: '2026-10-29T12:00:00Z',
  ...extra,
})
let discussions, artworks, comments, onSignIn, nextId, listError, writeError, uploadError, uploads
beforeEach(() => {
  discussions = [discussion()]
  artworks = [artwork()]
  comments = [comment(), comment({ id: 4, thread_id: 201, content_md: 'Great picture!' })]
  nextId = 10
  listError = null
  writeError = null
  uploadError = null
  uploads = 0
  onSignIn = vi.fn()
  apiRequest.mockReset().mockImplementation(async (path, options = {}) => {
    const { method = 'GET', body } = options
    const artworkUpload = path.startsWith('/media/games/') && path.endsWith('/artworks')
    if (method !== 'GET' && !artworkUpload && writeError) throw writeError
    if (artworkUpload) {
      uploads++
      if (uploadError) throw uploadError
      return { url: '/media/upload.webp' }
    }
    if (path.startsWith('/community/games/')) {
      if (listError) throw listError
      return discussions.filter((item) => item.game_id === path.split('/')[3])
    }
    if (path.startsWith('/artworks/game/')) {
      if (listError) throw listError
      return artworks.filter((item) => item.game_id === path.split('/')[3])
    }
    if (path.startsWith('/community/threads/')) {
      const thread = Number(path.split('/')[3])
      if (method === 'GET') {
        const query = new URLSearchParams(path.split('?')[1])
        return comments
          .filter((item) => item.thread_id === thread)
          .slice(Number(query.get('skip')), Number(query.get('skip')) + Number(query.get('limit')))
      }
      const saved = comment({ id: nextId++, thread_id: thread, ...body })
      comments.push(saved)
      return saved
    }
    if (path.startsWith('/community/comments/')) {
      const id = Number(path.split('/').at(-1))
      if (method === 'DELETE') {
        comments = comments.filter((item) => item.id !== id)
        return null
      }
      comments = comments.map((item) => (item.id === id ? { ...item, ...body } : item))
      return comments.find((item) => item.id === id)
    }
    const art = path.startsWith('/artworks/')
    if (art || path.startsWith('/community/discussions')) {
      const id = Number(path.split('/').at(-1))
      let items = art ? artworks : discussions
      if (method === 'POST') {
        const saved = (art ? artwork : discussion)({
          id: nextId++,
          thread_id: nextId + 500,
          ...body,
        })
        items.push(saved)
        return saved
      }
      if (method === 'DELETE') {
        items = items.filter((item) => item.id !== id)
        if (art) artworks = items
        else discussions = items
        return null
      }
      if (method === 'PUT') {
        const item = items.find((item) => item.id === id)
        Object.assign(item, body)
        return item
      }
      const item = items.find((item) => item.id === id)
      if (!item) throw Object.assign(new Error('not found'), { status: 404 })
      return item
    }
    throw new Error('Unexpected request: ' + path)
  })
})
function Harness({ initialUser = 7 }) {
  const [id, setId] = useState(initialUser),
    [gameId, setGameId] = useState('game-a')
  return (
    <AuthContext.Provider value={{ currentUser: id ? { id } : null, isAuthenticated: !!id }}>
      <button onClick={() => setId(null)}>Logout</button>
      <button onClick={() => setId(8)}>Switch account</button>
      <button onClick={() => setGameId('game-b')}>Switch game</button>
      <GameCommunity gameId={gameId} onSignIn={onSignIn} />
    </AuthContext.Provider>
  )
}
function setup(props) {
  const user = userEvent.setup()
  return {
    user,
    ...render(
      <StrictMode>
        <Harness {...props} />
      </StrictMode>,
    ),
  }
}
const writes = () =>
  apiRequest.mock.calls.filter(([, options]) => options?.method && options.method !== 'GET')
async function openDiscussion(user) {
  await user.click(await screen.findByRole('button', { name: 'Orbit tips', exact: true }))
  return await screen.findByRole('dialog', { name: 'Orbit tips' })
}
async function openArt(user) {
  await user.click(screen.getByRole('button', { name: 'Artwork', exact: true }))
  await user.click(await screen.findByRole('button', { name: 'Orbit landscape', exact: true }))
  return await screen.findByRole('dialog', { name: 'Orbit landscape' })
}
async function fillPost(user, form, title, content) {
  const titleInput = within(form).getByLabelText('Title')
  await user.clear(titleInput)
  await user.click(titleInput)
  await user.paste(title)
  const input = within(form).getByRole('textbox', { name: /Discussion text|Description/ })
  await user.clear(input)
  if (content) {
    await user.click(input)
    await user.paste(content)
  }
}

test('public visitors browse discussion and artwork comments, while writes prompt sign-in', async () => {
  const { user } = setup({ initialUser: null })
  const dialog = await openDiscussion(user)
  expect(await within(dialog).findByText('Great tips!')).toBeInTheDocument()
  expect(within(dialog).getAllByRole('link', { name: 'player' })[0]).toHaveAttribute(
    'href',
    '#/users/7',
  )
  expect(within(dialog).queryByRole('button', { name: 'Edit discussion' })).not.toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Sign in to comment' }))
  await user.click(within(dialog).getByRole('button', { name: 'Close dialog' }))
  const art = await openArt(user)
  expect(await within(art).findByText('Great picture!')).toBeInTheDocument()
  expect(within(art).getByRole('img', { name: 'Orbit landscape' })).toHaveAttribute(
    'src',
    'http://localhost/media/art.webp',
  )
  await user.click(within(art).getByRole('button', { name: 'Close dialog' }))
  await user.click(screen.getByRole('button', { name: 'Sign in to share artwork' }))
  expect(onSignIn).toHaveBeenCalledTimes(2)
  expect(writes()).toHaveLength(0)
  expect(
    apiRequest.mock.calls.every(
      ([, options]) => options.auth === false && options.credentials === 'omit',
    ),
  ).toBe(true)
})

test.each(['discussion', 'artwork'])(
  '%s list handles loading, error/retry and empty state',
  async (kind) => {
    discussions = []
    artworks = []
    listError = new Error('Community unavailable')
    const { user } = setup()
    if (kind === 'artwork')
      await user.click(screen.getByRole('button', { name: 'Artwork', exact: true }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Community unavailable')
    listError = null
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByText(
        `No ${kind === 'artwork' ? 'artworks' : 'discussions'} yet. Be the first to share.`,
      ),
    ).toBeInTheDocument()
  },
)

test('author creates, edits and deletes a discussion with explicit confirmation', async () => {
  const { user } = setup()
  await user.click(screen.getByRole('button', { name: 'Start discussion' }))
  const form = screen.getByRole('form', { name: 'Create discussion' })
  expect(within(form).getByRole('button', { name: 'Publish discussion' })).toBeDisabled()
  await fillPost(user, form, 'New topic', 'Opening **message**')
  await user.click(within(form).getByRole('button', { name: 'Publish discussion' }))
  const dialog = await screen.findByRole('dialog', { name: 'New topic' })
  await user.click(await within(dialog).findByRole('button', { name: 'Edit discussion' }))
  await fillPost(
    user,
    screen.getByRole('form', { name: 'Edit discussion' }),
    'Updated topic',
    'Updated content',
  )
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByRole('dialog', { name: 'Updated topic' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Delete discussion' }))
  expect(writes().filter(([, options]) => options.method === 'DELETE')).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: 'Confirm deletion' }))
  await screen.findByText('Discussion deleted.')
  expect(screen.queryByRole('button', { name: 'Updated topic' })).not.toBeInTheDocument()
})

test('other authors have no edit/delete controls; server authorization errors preserve drafts', async () => {
  discussions = [discussion({ author_id: 8 })]
  comments = [comment({ author_id: 8 })]
  const { user } = setup()
  let dialog = await openDiscussion(user)
  await within(dialog).findByText('Great tips!')
  expect(
    within(dialog).queryByRole('button', {
      name: /Edit discussion|Delete discussion|Edit comment|Delete comment/,
    }),
  ).not.toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Close dialog' }))
  discussions = [discussion()]
  await user.click(screen.getByRole('button', { name: 'Refresh discussions' }))
  dialog = await openDiscussion(user)
  await user.click(await within(dialog).findByRole('button', { name: 'Edit discussion' }))
  const form = screen.getByRole('form', { name: 'Edit discussion' })
  await fillPost(user, form, 'Preserved draft', 'Content')
  writeError = Object.assign(new Error('not allowed'), { status: 403 })
  await user.click(within(form).getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('You are not allowed')
  expect(within(form).getByLabelText('Title')).toHaveValue('Preserved draft')
  writeError = null
  await user.click(within(form).getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByRole('dialog', { name: 'Preserved draft' })).toBeInTheDocument()
})

test.each(['discussion', 'artwork'])(
  'comments on %s use its thread and support create/edit/delete',
  async (kind) => {
    const { user } = setup()
    const dialog = kind === 'artwork' ? await openArt(user) : await openDiscussion(user)
    const threadId = kind === 'artwork' ? 201 : 101
    const section = within(dialog).getByRole('region', { name: 'Comments' })
    await user.type(await within(section).findByLabelText('Your comment'), 'My new comment')
    await user.click(within(section).getByRole('button', { name: 'Post comment' }))
    const posted = await within(section).findByText('My new comment')
    const card = posted.closest('li')
    expect(writes().at(-1)[0]).toBe(`/community/threads/${threadId}/comments`)
    await user.click(within(card).getByRole('button', { name: 'Edit comment' }))
    const form = within(card).getByRole('form', { name: 'Edit comment' })
    await user.clear(within(form).getByLabelText('Edit comment'))
    await user.type(within(form).getByLabelText('Edit comment'), 'Changed comment')
    await user.click(within(form).getByRole('button', { name: 'Save comment' }))
    const edited = await screen.findByText('Changed comment')
    await user.click(within(edited.closest('li')).getByRole('button', { name: 'Delete comment' }))
    await user.click(screen.getByRole('button', { name: 'Confirm deletion' }))
    await screen.findByText('Comment deleted.')
    expect(screen.queryByText('Changed comment')).not.toBeInTheDocument()
  },
)

test('closed-thread rejection makes comments read-only without claiming success', async () => {
  const { user } = setup()
  const dialog = await openDiscussion(user)
  await user.type(await within(dialog).findByLabelText('Your comment'), 'Cannot publish')
  writeError = Object.assign(new Error('thread is closed'), { status: 400 })
  await user.click(screen.getByRole('button', { name: 'Post comment' }))
  expect(
    await screen.findByText('This thread is closed. Comments are read-only.'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('form', { name: 'Add comment' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit comment' })).not.toBeInTheDocument()
  expect(screen.queryByText('Comment posted.')).not.toBeInTheDocument()
})

test.each([
  ['discussion', 7],
  ['discussion', null],
  ['artwork', 7],
  ['artwork', null],
])('closed %s is immediately read-only for user %s', async (kind, initialUser) => {
  discussions = [discussion({ is_closed: true })]
  artworks = [artwork({ is_closed: true })]
  const { user } = setup({ initialUser })
  const dialog = kind === 'artwork' ? await openArt(user) : await openDiscussion(user)
  const region = within(dialog).getByRole('region', { name: 'Comments' })
  await within(region).findByText(kind === 'artwork' ? 'Great picture!' : 'Great tips!')
  expect(
    within(region).getByText('This thread is closed. Comments are read-only.'),
  ).toBeInTheDocument()
  expect(within(region).queryByRole('form', { name: 'Add comment' })).not.toBeInTheDocument()
  for (const name of ['Post comment', 'Edit comment', 'Delete comment', 'Sign in to comment']) {
    expect(within(region).queryByRole('button', { name })).not.toBeInTheDocument()
  }
  await user.click(within(region).getByRole('button', { name: 'Refresh comments' }))
  await within(region).findByText(kind === 'artwork' ? 'Great picture!' : 'Great tips!')
  expect(within(region).queryByRole('form', { name: 'Add comment' })).not.toBeInTheDocument()
  expect(writes()).toHaveLength(0)
})

test('comment pagination appends without duplicates', async () => {
  comments = Array.from({ length: 21 }, (_, index) =>
    comment({ id: index + 1, content_md: `Comment ${index + 1}` }),
  )
  const { user } = setup()
  const dialog = await openDiscussion(user)
  await user.click(await within(dialog).findByRole('button', { name: 'Load more comments' }))
  expect(await screen.findByText('Comment 21')).toBeInTheDocument()
  expect(
    apiRequest.mock.calls.some(
      ([path]) => path === '/community/threads/101/comments?skip=20&limit=20',
    ),
  ).toBe(true)
  expect(screen.queryByRole('button', { name: 'Load more comments' })).not.toBeInTheDocument()
  expect(within(dialog).getAllByRole('listitem')).toHaveLength(21)
})

test('missing detail and failed comment reads provide a retry path', async () => {
  const { user } = setup()
  await screen.findByRole('button', { name: 'Orbit tips', exact: true })
  discussions = []
  await user.click(screen.getByRole('button', { name: 'Orbit tips', exact: true }))
  expect(await screen.findByRole('alert')).toHaveTextContent('no longer available')
  discussions = [discussion()]
  const server = apiRequest.getMockImplementation()
  apiRequest.mockImplementation((path, options) =>
    path.includes('/threads/')
      ? Promise.reject(new Error('Comments unavailable'))
      : server(path, options),
  )
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Comments unavailable')
  expect(screen.queryByRole('button', { name: 'Post comment' })).not.toBeInTheDocument()
  apiRequest.mockImplementation(server)
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('Great tips!')).toBeInTheDocument()
})

test('a failed comment submission preserves its text and permits retry', async () => {
  const { user } = setup()
  await openDiscussion(user)
  const field = await screen.findByLabelText('Your comment')
  await user.type(field, 'Keep this draft')
  writeError = Object.assign(new Error('not allowed'), { status: 403 })
  await user.click(screen.getByRole('button', { name: 'Post comment' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('not allowed')
  expect(field).toHaveValue('Keep this draft')
  writeError = null
  await user.click(screen.getByRole('button', { name: 'Post comment' }))
  expect(await screen.findByText('Comment posted.')).toBeInTheDocument()
  expect(field).toHaveValue('')
})

test('refreshing comments preserves an in-flight submission and its draft', async () => {
  const { user } = setup()
  await openDiscussion(user)
  const field = await screen.findByLabelText('Your comment')
  await user.type(field, 'Pending comment')
  const server = apiRequest.getMockImplementation(),
    pending = deferred()
  apiRequest.mockImplementation(async (path, options) => {
    if (path.includes('/threads/') && options.method === 'POST') await pending.promise
    return server(path, options)
  })
  await user.click(screen.getByRole('button', { name: 'Post comment' }))
  const signal = writes().at(-1)[1].signal
  await user.click(screen.getByRole('button', { name: 'Refresh comments' }))
  await waitFor(() => expect(screen.queryByText('Loading comments…')).not.toBeInTheDocument())
  expect(field).toHaveValue('Pending comment')
  expect(signal.aborted).toBe(false)
  await act(async () => pending.resolve())
  expect(await screen.findByText('Comment posted.')).toBeInTheDocument()
  expect(screen.getByText('Pending comment')).toBeInTheDocument()
})

test('upload failure does not publish artwork; retry reuses a successful upload if publishing fails', async () => {
  const { user } = setup()
  await user.click(screen.getByRole('button', { name: 'Artwork', exact: true }))
  await user.click(screen.getByRole('button', { name: 'Share artwork' }))
  const form = screen.getByRole('form', { name: 'Create artwork' })
  await fillPost(user, form, 'Space painting', '')
  await user.upload(
    within(form).getByLabelText('Artwork image'),
    new File(['image'], 'painting.png', { type: 'image/png' }),
  )
  uploadError = new Error('Upload failed')
  await user.click(within(form).getByRole('button', { name: 'Publish artwork' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Upload failed')
  expect(writes().filter(([path]) => path === '/artworks/')).toHaveLength(0)
  uploadError = null
  writeError = new Error('Publishing unavailable')
  await user.click(within(form).getByRole('button', { name: 'Publish artwork' }))
  await screen.findByText('Publishing unavailable')
  expect(uploads).toBe(2)
  writeError = null
  await user.click(within(form).getByRole('button', { name: 'Publish artwork' }))
  expect(await screen.findByRole('dialog', { name: 'Space painting' })).toBeInTheDocument()
  expect(uploads).toBe(2)
})

test('authors edit and delete artwork without reuploading its unchanged image', async () => {
  const { user } = setup()
  const dialog = await openArt(user)
  await user.click(await within(dialog).findByRole('button', { name: 'Edit artwork' }))
  await fillPost(
    user,
    screen.getByRole('form', { name: 'Edit artwork' }),
    'Retouched landscape',
    'New description',
  )
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByRole('dialog', { name: 'Retouched landscape' })).toBeInTheDocument()
  expect(uploads).toBe(0)
  await user.click(screen.getByRole('button', { name: 'Delete artwork' }))
  await user.click(screen.getByRole('button', { name: 'Confirm deletion' }))
  await screen.findByText('Artwork deleted.')
  expect(screen.queryByRole('button', { name: 'Retouched landscape' })).not.toBeInTheDocument()
})

test('switching games aborts old reads and ignores their late responses', async () => {
  const pending = deferred(),
    server = apiRequest.getMockImplementation()
  apiRequest.mockImplementation((path, options) =>
    path.includes('/games/game-a/') ? pending.promise : server(path, options),
  )
  const { user } = setup()
  const signals = apiRequest.mock.calls.map(([, options]) => options.signal)
  expect(screen.getByRole('status')).toHaveTextContent('Loading discussions')
  await user.click(screen.getByRole('button', { name: 'Switch game' }))
  await screen.findByText('No discussions yet. Be the first to share.')
  await act(async () => pending.resolve([discussion()]))
  expect(signals.every((signal) => signal.aborted)).toBe(true)
  expect(screen.queryByRole('button', { name: 'Orbit tips' })).not.toBeInTheDocument()
})

test('account change aborts an upload and prevents a late artwork submission', async () => {
  const pending = deferred(),
    server = apiRequest.getMockImplementation()
  apiRequest.mockImplementation((path, options) =>
    path.startsWith('/media/games/') && path.endsWith('/artworks')
      ? pending.promise
      : server(path, options),
  )
  const { user } = setup()
  await user.click(screen.getByRole('button', { name: 'Artwork', exact: true }))
  await user.click(screen.getByRole('button', { name: 'Share artwork' }))
  const form = screen.getByRole('form', { name: 'Create artwork' })
  await fillPost(user, form, 'Private draft', '')
  await user.upload(
    within(form).getByLabelText('Artwork image'),
    new File(['image'], 'art.png', { type: 'image/png' }),
  )
  await user.click(within(form).getByRole('button', { name: 'Publish artwork' }))
  const signal = apiRequest.mock.calls.find(
    ([path]) => path.startsWith('/media/games/') && path.endsWith('/artworks'),
  )[1].signal
  await user.click(screen.getByRole('button', { name: 'Switch account' }))
  expect(signal.aborted).toBe(true)
  await act(async () => pending.resolve({ url: '/media/late.webp' }))
  expect(writes().filter(([path]) => path === '/artworks/')).toHaveLength(0)
  expect(screen.queryByDisplayValue('Private draft')).not.toBeInTheDocument()
})

test('renders safe Markdown and suppresses images in comments', async () => {
  discussions = [
    discussion({
      content_md:
        '<script>alert(1)</script>\n\n[External](https://example.com)\n\n[Unsafe](javascript:alert(1))',
    }),
  ]
  comments = [comment({ content_md: '![Tracking](https://example.com/track.png) **Safe text**' })]
  const { user } = setup()
  const dialog = await openDiscussion(user)
  await within(dialog).findByText('Safe text')
  expect(within(dialog).getByRole('link', { name: 'External' })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  )
  expect(dialog.querySelector('script')).toBeNull()
  expect(dialog.querySelector('a[href^="javascript:"]')).toBeNull()
  expect(dialog.querySelector('img')).toBeNull()
})
