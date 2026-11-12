import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './MessageBubble.css'

function MessageMenu({ position, trigger, onClose, onEdit, onDelete }) {
  const menu = useRef(null)
  useLayoutEffect(() => {
    const node = menu.current
    const viewport = window.visualViewport
    const place = () => {
      const box = node.getBoundingClientRect()
      const left = viewport?.offsetLeft || 0
      const top = viewport?.offsetTop || 0
      const width = viewport?.width || document.documentElement.clientWidth
      const height = viewport?.height || document.documentElement.clientHeight
      node.style.left =
        Math.max(left + 8, Math.min(position.x, left + width - box.width - 8)) + 'px'
      node.style.top = Math.max(top + 8, Math.min(position.y, top + height - box.height - 8)) + 'px'
    }
    place()
    node.querySelector('button')?.focus({ preventScroll: true })
    // Keep an open menu usable during incoming-message autoscroll and mobile keyboard resize.
    window.addEventListener('resize', place)
    viewport?.addEventListener('resize', place)
    return () => {
      window.removeEventListener('resize', place)
      viewport?.removeEventListener('resize', place)
    }
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
    document.addEventListener('pointerdown', outside)
    return () => {
      document.removeEventListener('pointerdown', outside)
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
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault()
          return
        }
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
  const close = useCallback((restoreFocus) => {
    setPosition(null)
    if (restoreFocus) trigger.current?.focus({ preventScroll: true })
  }, [])
  function open(event) {
    if (!canManage || !event.currentTarget.contains(event.target)) return
    if (
      event.type === 'contextmenu' &&
      (window.getSelection()?.toString() || event.target.closest?.('img, a'))
    )
      return
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
