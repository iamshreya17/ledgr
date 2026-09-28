import { useEffect, useRef } from 'react'

export default function ConfirmDialog({ open, title, message, busy = false, onCancel, onConfirm }) {
  const cancelRef = useRef(null)
  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKeyDown = event => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, busy, onCancel])
  if (!open) return null
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <div className="confirm-icon" aria-hidden="true">!</div>
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-message">{message}</p>
      <div className="confirm-actions"><button ref={cancelRef} className="button secondary-button" onClick={onCancel} disabled={busy}>Cancel</button><button className="button danger-solid-button" onClick={onConfirm} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</button></div>
    </div>
  </div>
}
