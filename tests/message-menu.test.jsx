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

test('touch-friendly trigger opens image-only actions; outside click dismisses the menu but scrolling does not', async () => {
  const user = userEvent.setup()
  const { onDelete } = setup({ onEdit: undefined })
  const trigger = screen.getByRole('button', { name: 'Message actions' })
  await user.click(trigger)
  expect(screen.getAllByRole('menuitem')).toHaveLength(1)
  await user.click(document.body)
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  await user.click(trigger)
  fireEvent.scroll(window)
  expect(screen.getByRole('menu')).toBeInTheDocument()
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

test('text selection preserves the native Copy context menu', () => {
  setup()
  const text = screen.getByText('Hello')
  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(text)
  selection.removeAllRanges()
  selection.addRange(range)
  try {
    expect(fireEvent.contextMenu(text)).toBe(true)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  } finally {
    selection.removeAllRanges()
  }
})

test('images and links preserve their native context menus; ellipsis still offers Delete', async () => {
  const user = userEvent.setup()
  const onDelete = vi.fn()
  render(
    <MessageBubble canManage onDelete={onDelete}>
      <img alt="Attachment" src="/test.webp" />
      <a href="https://example.com">Attachment link</a>
    </MessageBubble>,
  )
  expect(fireEvent.contextMenu(screen.getByRole('img'))).toBe(true)
  expect(fireEvent.contextMenu(screen.getByRole('link'))).toBe(true)
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Message actions' }))
  await user.click(screen.getByRole('menuitem', { name: 'Delete message' }))
  expect(onDelete).toHaveBeenCalledTimes(1)
})

test('portal context-menu and keyboard events neither reposition the menu nor reset focus', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Message actions' }))
  const menu = screen.getByRole('menu')
  const position = menu.style.cssText
  const remove = screen.getByRole('menuitem', { name: 'Delete message' })
  remove.focus()
  fireEvent.contextMenu(remove, { clientX: 400, clientY: 500 })
  fireEvent.keyDown(remove, { key: 'ContextMenu' })
  fireEvent.keyDown(remove, { key: 'F10', shiftKey: true })
  expect(screen.getByRole('menu')).toBe(menu)
  expect(menu.style.cssText).toBe(position)
  expect(remove).toHaveFocus()
})

test('unrelated scroll, chat autoscroll and mobile keyboard resize keep the menu usable', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Message actions' }))
  const remove = screen.getByRole('menuitem', { name: 'Delete message' })
  remove.focus()
  fireEvent.scroll(document.body)
  fireEvent.scroll(screen.getByText('Hello').parentElement)
  fireEvent.resize(window)
  expect(screen.getByRole('menu')).toBeInTheDocument()
  expect(remove).toHaveFocus()
})
