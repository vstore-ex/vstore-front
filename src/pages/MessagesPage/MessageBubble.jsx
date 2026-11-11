import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './MessageBubble.css'

function MessageMenu({ position, trigger, onClose, onEdit, onDelete }) {
  const menu = useRef(null)
  useLayoutEffect(() => {
    const node = menu.current
    const box = node.getBoundingClientRect()
    node.style.left =
      Math.max(8, Math.min(position.x, document.documentElement.clientWidth - box.width - 8)) + 'px'
    node.style.top =
      Math.max(8, Math.min(position.y, document.documentElement.clientHeight - box.height - 8)) +
      'px'
    node.querySelector('button')?.focus()
  }, [position])
  useEffect(() => {
    const outside = (event) => {
      if (
        event.target instanceof Node &&
        (menu.current?.contains(event.target) || trigger.current?.contains(event.target))
      )
        return
      onClose(false)
    }
    const dismiss = () => onClose(false)
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', outside, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', outside, true)
    }
  }, [onClose, trigger])
  function choose(action) {
    onClose(true)
    action()
  }
  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label="Message actions"
      className="message-context-menu"
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose(true)
        } else if (event.key === 'Tab') {
          onClose(true)
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault()
          const items = Array.from(menu.current.querySelectorAll('button'))
          const current = items.indexOf(document.activeElement)
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? items.length - 1
                : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
          items[next]?.focus()
        }
      }}
    >
      {onEdit && (
        <button type="button" role="menuitem" onClick={() => choose(onEdit)}>
          Edit message
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        className="message-context-menu__delete"
        onClick={() => choose(onDelete)}
      >
        Delete message
      </button>
    </div>,
    document.body,
  )
}

export default function MessageBubble({ canManage, onEdit, onDelete, children, ...props }) {
  const [position, setPosition] = useState(null)
  const trigger = useRef(null)
  function close(restoreFocus) {
    setPosition(null)
    if (restoreFocus) trigger.current?.focus()
  }
  function open(event) {
    if (!canManage) return
    event.preventDefault()
    const box = trigger.current.getBoundingClientRect()
    setPosition(
      event.type === 'contextmenu' && event.clientX > 0
        ? { x: event.clientX, y: event.clientY }
        : { x: box.left, y: box.bottom + 4 },
    )
  }
  return (
    <div
      {...props}
      onContextMenu={open}
      onKeyDown={(event) => {
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) open(event)
      }}
    >
      {children}
      {canManage && (
        <span className="message-actions">
          <button
            ref={trigger}
            type="button"
            className="message-action"
            aria-label="Message actions"
            aria-haspopup="menu"
            aria-expanded={!!position}
            onClick={position ? () => close(true) : open}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        </span>
      )}
      {canManage && position && (
        <MessageMenu
          position={position}
          trigger={trigger}
          onClose={close}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}
