import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import { apiRequest } from '../src/api/client'
import ProfileFriendAction from '../src/pages/UserProfilePage/ProfileFriendAction'
import { conversation } from './message-fixtures'
vi.mock('../src/api/client', async original => ({ ...(await original()), apiRequest: vi.fn() }))
let friends
beforeEach(() => {
  friends = [{ id: 8, username: 'alex' }]
  apiRequest.mockReset().mockImplementation(async (path, options = {}) => {
    if (path === '/friends') return friends
    if (path === '/friends/requests/incoming' || path === '/friends/requests/outgoing') return []
    if (path === '/friends/8' && options.method === 'DELETE') { friends = []; return null }
    if (path === '/messages/conversations' && options.method === 'POST') return conversation()
    throw new Error('Unexpected API: ' + path)
  })
})
function setup() {
  render(<AuthContext.Provider value={{ currentUser: { id: 7 }, isAuthenticated: true }}><ProfileFriendAction userId={7} profileId={8} /><button>Outside</button></AuthContext.Provider>)
  return userEvent.setup()
}
test('friend menu closes with Escape and outside click, resets confirmation and still opens messages', async () => {
  const user = setup()
  const summary = await screen.findByText('Friends')
  const menu = summary.closest('details')
  await user.click(summary)
  expect(menu.open).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Remove friend' }))
  expect(screen.getByRole('group', { name: 'Confirm removal' })).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(menu.open).toBe(false)
  expect(summary).toHaveFocus()
  await user.click(summary)
  expect(await screen.findByRole('button', { name: 'Remove friend' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Outside' }))
  expect(menu.open).toBe(false)
  await user.click(summary)
  await user.click(screen.getByRole('button', { name: 'Message', exact: true }))
  await waitFor(() => expect(window.location.hash).toBe('#/messages/12'))
  expect(menu.open).toBe(false)
  expect(apiRequest).not.toHaveBeenCalledWith('/friends/8', expect.anything())
})
test('removing a friend still requires confirmation and uses the backend', async () => {
  const user = setup()
  await user.click(await screen.findByText('Friends'))
  await user.click(screen.getByRole('button', { name: 'Remove friend' }))
  await user.click(screen.getByRole('button', { name: 'Keep friend' }))
  expect(apiRequest).not.toHaveBeenCalledWith('/friends/8', expect.anything())
  await user.click(screen.getByRole('button', { name: 'Remove friend' }))
  await user.click(screen.getByRole('button', { name: 'Confirm removal' }))
  expect(await screen.findByText('Friend removed.')).toBeInTheDocument()
  expect(apiRequest).toHaveBeenCalledWith('/friends/8', expect.objectContaining({ method: 'DELETE' }))
})
