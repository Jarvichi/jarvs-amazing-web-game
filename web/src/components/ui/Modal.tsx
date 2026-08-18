import React from 'react'
import { ModalBackdrop } from './ModalBackdrop'
import { Panel, type PanelTone } from './Panel'
import { Icon } from './icons/Icon'

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  tone?: PanelTone
  closeOnEscape?: boolean
  zIndex?: number
}

/**
 * Standard dialog shell — ModalBackdrop (focus trap/Esc/scroll-lock) + Panel
 * (surface/border/elevation) + a header row with title and close button.
 * Not every ModalBackdrop consumer needs this (some want fully custom
 * layout), but new small centered dialogs should default to it.
 */
export function Modal({ title, onClose, children, footer, tone = 'neutral', closeOnEscape, zIndex }: Props) {
  return (
    <ModalBackdrop onClose={onClose} title={title} closeOnEscape={closeOnEscape} zIndex={zIndex}>
      <Panel elevation="floating" tone={tone} className="modal-shell">
        <div className="modal-shell-header">
          <span className="modal-shell-title">{title}</span>
          <button
            type="button"
            className="modal-shell-close"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="modal-shell-body">
          {children}
        </div>
        {footer && <div className="modal-shell-footer">{footer}</div>}
      </Panel>
    </ModalBackdrop>
  )
}
