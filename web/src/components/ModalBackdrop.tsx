import React from 'react'
import ReactDOM from 'react-dom'

interface Props {
  onClose: () => void
  children: React.ReactNode
  zIndex?: number
}

export function ModalBackdrop({ onClose, children, zIndex }: Props) {
  return ReactDOM.createPortal(
    <div
      className="modal-backdrop"
      style={zIndex !== undefined ? { zIndex } : undefined}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  )
}
