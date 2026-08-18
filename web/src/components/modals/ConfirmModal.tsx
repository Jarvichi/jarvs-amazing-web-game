import React from 'react'
import { Modal } from '../ui/Modal'

interface Props {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      tone="danger"
      footer={
        <>
          <button className="action-btn" onClick={onCancel}>Cancel</button>
          <button className="action-btn action-btn--danger" onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      {body}
    </Modal>
  )
}
