import { useEffect, useRef, useState } from 'react'
import { getMessageAttachment, messageError } from '../api/messages'
import './ImageViewer.css'

function LightboxImage({ conversationId, attachment, index, total }) {
  const [zoom, setZoom] = useState(1)
  const [shift, setShift] = useState({ x: 0, y: 0 })
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const dragging = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let objectUrl = ''
    getMessageAttachment(conversationId, attachment, controller.signal)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((reason) => {
        if (active && !controller.signal.aborted) setError(messageError(reason))
      })
    return () => {
      active = false
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment, conversationId, attempt])

  useEffect(() => {
    const wheel = (event) => {
      event.preventDefault()
      setZoom((current) => Math.min(4, Math.max(1, current * (event.deltaY < 0 ? 1.2 : 0.8))))
    }
    window.addEventListener('wheel', wheel, { passive: false })
    return () => window.removeEventListener('wheel', wheel)
  }, [])

  function onPointerDown(event) {
    if (zoom <= 1 || event.button !== 0) return
    event.preventDefault()
    dragging.current = {
      pointer: event.pointerId,
      x: event.clientX - shift.x,
      y: event.clientY - shift.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function onPointerMove(event) {
    const drag = dragging.current
    if (!drag || event.pointerId !== drag.pointer) return
    setShift({ x: event.clientX - drag.x, y: event.clientY - drag.y })
  }
  function onPointerEnd(event) {
    if (event.pointerId === dragging.current?.pointer) dragging.current = null
  }

  if (error)
    return (
      <div className="lightbox-error" role="alert">
        <p>Could not load image: {error}</p>
        <button
          type="button"
          className="messages-text-button"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Retry
        </button>
      </div>
    )
  return url ? (
    <img
      className="lightbox-image"
      src={url}
      alt={`Image ${index + 1} of ${total}`}
      style={{
        transform: `translate(calc(-50% + ${shift.x}px), calc(-50% + ${shift.y}px)) scale(${zoom})`,
        cursor: zoom > 1 ? 'grab' : 'default',
      }}
      draggable={false}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={() => {
        setZoom(zoom > 1 ? 1 : 2)
        setShift({ x: 0, y: 0 })
      }}
    />
  ) : (
    <div className="lightbox-loading" role="status">
      Loading image...
    </div>
  )
}

export default function ImageViewer({ conversationId, images, index, onIndex, onClose }) {
  const dialog = useRef(null)
  const attachment = images[index]

  useEffect(() => {
    dialog.current?.focus()
    const keys = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      if (event.key === 'ArrowRight' && index < images.length - 1) onIndex(index + 1)
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [images.length, index, onClose, onIndex])

  return (
    <div
      ref={dialog}
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Image viewer, ${index + 1} of ${images.length}`}
      tabIndex={-1}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <LightboxImage
        key={index}
        conversationId={conversationId}
        attachment={attachment}
        index={index}
        total={images.length}
      />
      <button
        type="button"
        className="lightbox-button lightbox-close"
        aria-label="Close image viewer"
        title="Close (Esc)"
        onClick={onClose}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      {images.length > 1 && (
        <>
          <button
            type="button"
            className="lightbox-button lightbox-nav"
            aria-label="Previous image"
            title="Previous (←)"
            disabled={index === 0}
            onClick={() => onIndex(index - 1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            className="lightbox-button lightbox-nav lightbox-nav--next"
            aria-label="Next image"
            title="Next (→)"
            disabled={index === images.length - 1}
            onClick={() => onIndex(index + 1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <span className="lightbox-counter">
            {index + 1} / {images.length}
          </span>
        </>
      )}
    </div>
  )
}
