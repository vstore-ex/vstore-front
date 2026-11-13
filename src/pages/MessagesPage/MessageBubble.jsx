import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './MessageBubble.css'

function hasBubbleSelection(container) {
  const selection = window.getSelection?.()
  if (!selection || !selection.toString()) return false
  if (
    (selection.anchorNode && container.contains(selection.anchorNode)) ||
    (selection.focusNode && container.contains(selection.focusNode))
  )
    return true
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    return Boolean(
      container.contains(range.startContainer) ||
      container.contains(range.endContainer) ||
      range.commonAncestorContainer === container,
    )
  }
  return false
}

function MessageMenu({ position, trigger, onClose, onEdit, onDelete }) {
  const menu = useRef(null)
  useLayoutEffect(() => {
    const node = menu.current
    const viewport = window.visualViewport
    const place = () => {
      const triggerBox = trigger.current?.getBoundingClientRect()
      if (!triggerBox) return
      const x = position.anchor === 'offset' ? triggerBox.left + position.offsetX : triggerBox.left
      const y =
        position.anchor === 'offset' ? triggerBox.top + position.offsetY : triggerBox.bottom + 4
      const box = node.getBoundingClientRect()
      const left = viewport?.offsetLeft || 0
      const top = viewport?.offsetTop || 0
      const width = viewport?.width || document.documentElement.clientWidth
      const height = viewport?.height || document.documentElement.clientHeight
      node.style.left = Math.max(left + 8, Math.min(x, left + width - box.width - 8)) + 'px'
      node.style.top = Math.max(top + 8, Math.min(y, top + height - box.height - 8)) + 'px'
    }
    const onScroll = () => {
      const triggerBox = trigger.current?.getBoundingClientRect()
      if (!triggerBox) return
      const scroller = trigger.current.closest?.('.message-history, [role="log"]')
      const bounds = scroller?.getBoundingClientRect()
      const viewTop = bounds && bounds.height > 0 ? bounds.top : viewport?.offsetTop || 0
      const viewBottom =
        bounds && bounds.height > 0
          ? bounds.bottom
          : (viewport?.offsetTop || 0) + (viewport?.height || document.documentElement.clientHeight)
      if (triggerBox.height > 0 && (triggerBox.bottom < viewTop || triggerBox.top > viewBottom)) {
        onClose(false)
        return
      }
      place()
    }
    place()
    node.querySelector('button')?.focus({ preventScroll: true })
    // Re-anchor to the trigger on scroll/resize so autoscroll never aims the menu at another bubble.
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)
    viewport?.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', place)
      viewport?.removeEventListener('resize', place)
    }
  }, [position, trigger, onClose])
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
  const [prevCanManage, setPrevCanManage] = useState(canManage)
  const trigger = useRef(null)
  const bubble = useRef(null)
  const wasOpen = useRef(false)
  if (canManage !== prevCanManage) {
    setPrevCanManage(canManage)
    if (!canManage && position) setPosition(null)
  }
  const close = useCallback((restoreFocus) => {
    setPosition(null)
    if (restoreFocus) (trigger.current || bubble.current)?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    if (canManage && position) {
      wasOpen.current = true
      return
    }
    if (wasOpen.current && !canManage) {
      wasOpen.current = false
      bubble.current?.focus({ preventScroll: true })
    } else if (!position) {
      wasOpen.current = false
    }
  }, [canManage, position])
  function open(event) {
    if (!canManage || !event.currentTarget.contains(event.target)) return
    if (event.target.closest?.('img, a')) return
    if (event.type === 'contextmenu' && hasBubbleSelection(event.currentTarget)) return
    event.preventDefault()
    const box = trigger.current.getBoundingClientRect()
    setPosition(
      event.type === 'contextmenu' && event.clientX > 0
        ? { anchor: 'offset', offsetX: event.clientX - box.left, offsetY: event.clientY - box.top }
        : { anchor: 'trigger' },
    )
  }
  return (
    <div
      ref={bubble}
      tabIndex={-1}
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
