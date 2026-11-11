import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import MessageBubble from '../src/pages/MessagesPage/MessageBubble'

function setup(props = {}) {
  const onDelete = vi.fn()
  const onEdit = vi.fn()
  const result = render(
    <MessageBubble canManage onDelete={onDelete} onEdit={onEdit} {...props}>
      <p>Hello</p>
    </MessageBubble>,
  )
  return { ...result, onDelete, onEdit }
}

test('hover does not expose delete; the action menu opens by right click and deletes only on selection', async () => {
  const user = userEvent.setup()
  const { onDelete } = setup()
  await user.hover(screen.getByText('Hello'))
  expect(screen.queryByRole('menuitem', { name: 'Delete message' })).not.toBeInTheDocument()
  fireEvent.contextMenu(screen.getByText('Hello'), { clientX: 100, clientY: 100 })
  expect(onDelete).not.toHaveBeenCalled()
  await user.click(screen.getByRole('menuitem', { name: 'Delete message' }))
  expect(onDelete).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})

test('keyboard opens the menu, moves focus and dismisses without deleting', async () => {
  const user = userEvent.setup()
  const { onDelete } = setup()
  const trigger = screen.getByRole('button', { name: 'Message actions' })
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'F10', shiftKey: true })
  expect(screen.getByRole('menuitem', { name: 'Edit message' })).toHaveFocus()
  await user.keyboard('{ArrowDown}')
  expect(screen.getByRole('menuitem', { name: 'Delete message' })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(trigger).toHaveFocus()
  expect(onDelete).not.toHaveBeenCalled()
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})

test('touch-friendly trigger opens image-only actions; outside click and scrolling dismiss the menu', async () => {
  const user = userEvent.setup()
  const { onDelete } = setup({ onEdit: undefined })
  const trigger = screen.getByRole('button', { name: 'Message actions' })
  await user.click(trigger)
  expect(screen.getAllByRole('menuitem')).toHaveLength(1)
  await user.click(document.body)
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  await user.click(trigger)
  fireEvent.scroll(window)
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(onDelete).not.toHaveBeenCalled()
})

test('incoming, deleted or editing messages cannot expose management actions', () => {
  const { onDelete } = setup({ canManage: false })
  fireEvent.contextMenu(screen.getByText('Hello'))
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Message actions' })).not.toBeInTheDocument()
  expect(onDelete).not.toHaveBeenCalled()
})

test('pressing the menu trigger again closes it without deleting', async () => {
  const user = userEvent.setup()
  const { onDelete } = setup()
  const trigger = screen.getByRole('button', { name: 'Message actions' })
  await user.click(trigger)
  expect(screen.getByRole('menu')).toBeInTheDocument()
  await user.click(trigger)
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(onDelete).not.toHaveBeenCalled()
})
