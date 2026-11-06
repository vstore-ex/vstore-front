import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import Footer from '../src/components/Footer/Footer'
import SupportPage from '../src/pages/SupportPage/SupportPage'
import {
  createSupportTicket,
  getMySupportTickets,
  getSupportArticles,
  getSupportTicketDetails,
  sendSupportTicketMessage,
} from '../src/api/support'

vi.mock('../src/api/support', () => ({
  createSupportTicket: vi.fn(),
  getMySupportTickets: vi.fn(),
  getSupportArticles: vi.fn(),
  getSupportTicketDetails: vi.fn(),
  sendSupportTicketMessage: vi.fn(),
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
  message_count: 1,
  last_message_at: '2026-11-05T10:00:00Z',
  created_at: '2026-11-05T10:00:00Z',
  updated_at: '2026-11-05T10:00:00Z',
  ...extra,
})

let records
let requests
let threadMessages

beforeEach(() => {
  records = Array.from({ length: 9 }, (_, index) => article(index + 1))
  requests = [ticket(4, 'Payment issue')]
  threadMessages = new Map()
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
  getSupportTicketDetails.mockReset().mockImplementation(async (ticketId, ownerId) => {
    const current = requests.find((item) => item.id === ticketId) || ticket(ticketId, 'New request')
    return {
      ...current,
      messages: threadMessages.get(ticketId) || [
        {
          id: ticketId,
          ticket_id: ticketId,
          sender_id: ownerId,
          sender_username: 'reader',
          sender_role: 'customer',
          body: current.message,
          created_at: current.created_at,
        },
      ],
      events:
        ticketId === 4
          ? [
              {
                id: 30,
                ticket_id: 4,
                actor_id: 1,
                actor_username: 'admin',
                event_type: 'status_changed',
                old_value: 'open',
                new_value: 'waiting_for_customer',
                created_at: '2026-11-05T10:05:00Z',
              },
            ]
          : [],
    }
  })
  sendSupportTicketMessage.mockReset().mockImplementation(async (ticketId, body) => {
    const posted = {
      id: 20,
      ticket_id: ticketId,
      sender_id: 7,
      sender_username: 'reader',
      sender_role: 'customer',
      body,
      created_at: '2026-11-05T10:05:00Z',
    }
    threadMessages.set(ticketId, [...(threadMessages.get(ticketId) || []), posted])
    return posted
  })
  createSupportTicket.mockReset().mockImplementation(async (value, ownerId) => {
    const created = ticket(10, value.subject, { ...value, user_id: ownerId })
    requests = [created, ...requests]
    return created
  })
})

function setup(ownerId = 7, onSignIn = vi.fn()) {
  const user = userEvent.setup()
  const view = render(
    <AuthContext.Provider
      value={{ isAuthenticated: ownerId != null, currentUser: ownerId ? { id: ownerId } : null }}
    >
      <SupportPage onSignIn={onSignIn} />
    </AuthContext.Provider>,
  )
  return { user, onSignIn, ...view }
}

test('shows public backend articles and keeps ticket endpoints private for guests', async () => {
  const { user, onSignIn } = setup(null)
  expect(await screen.findByRole('button', { name: 'Help article 1' })).toBeInTheDocument()
  expect(getSupportArticles).toHaveBeenCalledWith(
    { page: 1, pageSize: 8, q: '' },
    expect.any(AbortSignal),
  )
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(onSignIn).toHaveBeenCalledOnce()
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

test('opens a private ticket thread and submits replies', async () => {
  const { user } = setup()
  await screen.findByRole('heading', { name: 'Payment issue' })
  await user.click(screen.getByRole('button', { name: 'Open conversation (1)' }))
  expect(
    await screen.findByRole('heading', { name: 'Conversation for request #4' }),
  ).toBeInTheDocument()
  expect(getSupportTicketDetails).toHaveBeenCalledWith(4, 7, expect.any(AbortSignal))
  expect(screen.getByText('Initial support request details.')).toBeInTheDocument()
  expect(screen.getByText('Status changed from open to waiting for customer')).toBeInTheDocument()
  const reply = screen.getByRole('textbox', { name: 'Your reply' })
  await user.type(reply, 'I have a new detail.')
  await user.click(screen.getByRole('button', { name: 'Send reply' }))
  expect(await screen.findByText('Reply sent.')).toBeInTheDocument()
  expect(await screen.findByText('I have a new detail.')).toBeInTheDocument()
  expect(sendSupportTicketMessage).toHaveBeenCalledWith(
    4,
    'I have a new detail.',
    expect.any(AbortSignal),
  )
})

test('preserves a failed reply draft and allows an explicit retry', async () => {
  sendSupportTicketMessage.mockRejectedValueOnce(new Error('Reply could not be sent.'))
  const { user } = setup()
  await screen.findByRole('heading', { name: 'Payment issue' })
  await user.click(screen.getByRole('button', { name: 'Open conversation (1)' }))
  const reply = await screen.findByRole('textbox', { name: 'Your reply' })
  await user.type(reply, 'I attached more details.')
  await user.click(screen.getByRole('button', { name: 'Send reply' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Reply could not be sent.')
  expect(reply).toHaveValue('I attached more details.')
  await user.click(screen.getByRole('button', { name: 'Send reply' }))
  expect(await screen.findByText('Reply sent.')).toBeInTheDocument()
  expect(await screen.findByText('I attached more details.')).toBeInTheDocument()
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

test('footer topics search real articles and prefill a support request without losing ticket conversations', async () => {
  const { user } = setup()
  render(<Footer />)
  await user.click(screen.getByRole('link', { name: 'Jobs' }))
  await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Find help' })).toHaveValue('Jobs'))
  expect(screen.getByLabelText('Subject')).toHaveValue('Jobs')
  await waitFor(() => expect(getSupportArticles).toHaveBeenCalledWith({ page: 1, pageSize: 8, q: 'Jobs' }, expect.any(AbortSignal)))
  expect(await screen.findByRole('button', { name: 'Open conversation (1)' })).toBeInTheDocument()
  for (const link of screen.getAllByRole('link', { name: /Share on/ })) {
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link.href).not.toContain('#/support')
  }
  expect(screen.queryByRole('link', { name: 'YouTube' })).not.toBeInTheDocument()
})

test('article links render safe Markdown and lead to a shareable detail route', async () => {
  records = [{ ...article(12), content_md: '**Formatted** [More help](https://example.com/help)' }]
  const { user } = setup(null)
  await user.click(await screen.findByRole('button', { name: 'Help article 12' }))
  expect(screen.getByText('Formatted').tagName).toBe('STRONG')
  expect(screen.getByRole('link', { name: 'More help' })).toHaveAttribute('rel', 'noopener noreferrer')
  expect(screen.getByRole('link', { name: 'Open full article' })).toHaveAttribute('href', '#/support/articles/12')
})

test('unrecognized support topics fall back to normal help search', async () => {
  window.history.replaceState(null, '', '/#/support?topic=constructor')
  setup(null)
  await screen.findByRole('button', { name: 'Help article 1' })
  expect(screen.getByRole('searchbox', { name: 'Find help' })).toHaveValue('')
})
