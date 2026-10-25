import { useEffect, useRef } from 'react'

export default function Dialog({
  children,
  className = '',
  labelledBy,
  busy = false,
  initialFocusRef,
  closeLabel = 'Close dialog',
  closeContent = <span aria-hidden="true">×</span>,
  onClose,
}) {
  const dialog = useRef(null)

  useEffect(() => {
    const element = dialog.current
    const opener = document.activeElement
    element.showModal()
    initialFocusRef?.current?.focus()
    return () => {
      element.close()
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus()
        // A background refresh can disable the opener while the dialog is open.
        // Keep focus in its context instead of dropping keyboard users on the body.
        if (document.activeElement !== opener)
          opener.closest('dialog[open], [tabindex="-1"]')?.focus()
      }
    }
  }, [initialFocusRef])

  function cancel(event) {
    event.preventDefault()
    if (!busy) onClose()
  }

  return (
    <dialog
      ref={dialog}
      className={`ui-dialog ${className}`}
      aria-labelledby={labelledBy}
      aria-busy={busy}
      onCancel={cancel}
    >
      <button
        className="ui-dialog__close"
        type="button"
        aria-label={closeLabel}
        disabled={busy}
        onClick={onClose}
      >
        {closeContent}
      </button>
      {children}
    </dialog>
  )
}
