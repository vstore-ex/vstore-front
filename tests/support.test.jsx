import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import SupportPage from '../src/pages/SupportPage/SupportPage'
import { createSupportTicket, getMySupportTickets, getSupportArticles } from '../src/api/support'

vi.mock('../src/api/support', () => ({
  createSupportTicket: vi.fn(),
  getMySupportTickets: vi.fn(),
  getSupportArticles: vi.fn(),
  supportError: (error) => error.message,
}))

const article = (id, title = `Help article ${id}`) => ({
  id,
  title,
  content_md: 'Please read the **important details**.',
  category: 'General',
  created_at: '2026-11-05T10:00:00Z',
  updated_at: '2026-11-05T10:00:00Z',
})
const ticket = (id, subject, extra = {}) => ({
  id,
  user_id: 7,
  subject,
  message: 'Initial support request details.',
  status: 'open',
  priority: 'medium',
  created_at: '2026-11-05T10:00:00Z',
  updated_at: '2026-11-05T10:00:00Z',
  ...extra,
})

let records
let requests

beforeEach(() => {
  records = Array.from({ length: 9 }, (_, index) => article(index + 1))
  requests = [ticket(4, 'Payment issue')]
  getSupportArticles.mockReset().mockImplementation(async ({ page, pageSize, q }) => {
    const filtered = records.filter((item) =>
      `${item.title} ${item.content_md} ${item.category}`.toLowerCase().includes(q.toLowerCase()),
    )
    const start = (page - 1) * pageSize
    return {
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(filtered.length / pageSize),
    }
  })
  getMySupportTickets
    .mockReset()
    .mockImplementation(async (ownerId) => requests.filter((item) => item.user_id === ownerId))
  createSupportTicket.mockReset().mockImplementation(async (value, ownerId) => {
    const created = ticket(10, value.subject, { ...value, user_id: ownerId })
    requests = [created, ...requests]
    return created
  })
})

function setup(ownerId = 7) {
  const user = userEvent.setup()
  const view = render(
    <AuthContext.Provider
      value={{ isAuthenticated: ownerId != null, currentUser: ownerId ? { id: ownerId } : null }}
    >
      <SupportPage />
    </AuthContext.Provider>,
  )
  return { user, ...view }
}

test('shows public backend articles and keeps ticket endpoints private for guests', async () => {
  setup(null)
  expect(await screen.findByRole('button', { name: 'Help article 1' })).toBeInTheDocument()
  expect(getSupportArticles).toHaveBeenCalledWith(
    { page: 1, pageSize: 8, q: '' },
    expect.any(AbortSignal),
  )
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '#/login')
  expect(getMySupportTickets).not.toHaveBeenCalled()
  expect(createSupportTicket).not.toHaveBeenCalled()
})

test('searches and paginates help articles through the backend', async () => {
  const { user } = setup(null)
  await screen.findByRole('button', { name: 'Help article 1' })
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(await screen.findByRole('button', { name: 'Help article 9' })).toBeInTheDocument()
  expect(getSupportArticles).toHaveBeenLastCalledWith(
    { page: 2, pageSize: 8, q: '' },
    expect.any(AbortSignal),
  )
  const search = screen.getByRole('searchbox', { name: 'Find help' })
  await user.type(search, 'help article 3')
  expect(await screen.findByRole('button', { name: 'Help article 3' })).toBeInTheDocument()
  await waitFor(() =>
    expect(getSupportArticles).toHaveBeenLastCalledWith(
      { page: 1, pageSize: 8, q: 'help article 3' },
      expect.any(AbortSignal),
    ),
  )
  await user.click(screen.getByRole('button', { name: 'Help article 3' }))
  expect(screen.getByText('important details')).toBeInTheDocument()
})

test('loads private request history and submits a ticket with the backend contract', async () => {
  const { user } = setup()
  expect(await screen.findByRole('heading', { name: 'Payment issue' })).toBeInTheDocument()
  expect(screen.getByText('Initial support request details.')).toBeInTheDocument()
  expect(getMySupportTickets).toHaveBeenCalledWith(7, expect.any(AbortSignal))
  await user.type(screen.getByRole('textbox', { name: 'Subject' }), ' Cannot pay ')
  await user.type(
    screen.getByRole('textbox', { name: 'Describe your issue' }),
    ' Payment fails at checkout. ',
  )
  await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'high')
  await user.click(screen.getByRole('button', { name: 'Submit request' }))
  expect(await screen.findByText('Your support request was submitted.')).toBeInTheDocument()
  expect(createSupportTicket).toHaveBeenCalledWith(
    { subject: ' Cannot pay ', message: ' Payment fails at checkout. ', priority: 'high' },
    7,
    expect.any(AbortSignal),
  )
  expect(await screen.findByRole('heading', { name: 'Cannot pay' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveValue('')
  expect(screen.getByRole('textbox', { name: 'Describe your issue' })).toHaveValue('')
})

test('preserves ticket drafts when the backend rejects a request', async () => {
  createSupportTicket.mockRejectedValueOnce(new Error('Ticket submission failed.'))
  const { user } = setup()
  const subject = screen.getByRole('textbox', { name: 'Subject' })
  const message = screen.getByRole('textbox', { name: 'Describe your issue' })
  await user.type(subject, 'Please help')
  await user.type(message, 'The order is missing.')
  await user.click(screen.getByRole('button', { name: 'Submit request' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Ticket submission failed.')
  expect(subject).toHaveValue('Please help')
  expect(message).toHaveValue('The order is missing.')
})
