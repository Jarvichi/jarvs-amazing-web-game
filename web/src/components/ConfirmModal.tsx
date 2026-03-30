import React from 'react'
import { ModalBackdrop } from './ModalBackdrop'

interface Props {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <ModalBackdrop onClose={onCancel}>
      <div className="confirm-modal">
        <div className="confirm-modal-title">{title}</div>
        <div className="confirm-modal-body">{body}</div>
        <div className="confirm-modal-actions">
          <button className="action-btn" onClick={onCancel}>[ Cancel ]</button>
          <button className="action-btn action-btn--danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </ModalBackdrop>
  )
}
