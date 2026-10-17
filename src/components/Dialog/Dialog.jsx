import { useEffect, useRef } from 'react'

export default function Dialog({ children, className = '', labelledBy, busy = false, initialFocusRef, onClose }) {
  const dialog = useRef(null)

  useEffect(() => {
    const element = dialog.current
    const opener = document.activeElement
    element.showModal()
    initialFocusRef?.current?.focus()
    return () => {
      element.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [initialFocusRef])

  function cancel(event) {
    event.preventDefault()
    if (!busy) onClose()
  }

  return <dialog ref={dialog} className={`ui-dialog ${className}`} aria-labelledby={labelledBy} aria-busy={busy} onCancel={cancel}>
    <button className="ui-dialog__close" type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}>
      <span aria-hidden="true">×</span>
    </button>
    {children}
  </dialog>
}
