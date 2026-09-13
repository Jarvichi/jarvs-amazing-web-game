import React from 'react'
import { ModalBackdrop } from '../../ui/ModalBackdrop'
import { Button } from '../../ui/Button'

interface Props {
  deckCode: string
  shareCodeRef: React.RefObject<HTMLTextAreaElement>
  copyFeedback: boolean
  onCopy: () => void
  importCode: string
  importError: string
  onImportCodeChange: (value: string) => void
  onImport: () => void
  onClose: () => void
}

export function ShareDeckModal({
  deckCode, shareCodeRef, copyFeedback, onCopy,
  importCode, importError, onImportCodeChange, onImport,
  onClose,
}: Props) {
  return (
    <ModalBackdrop onClose={onClose} title="Share Deck">
      <div className="autobuild-panel share-panel">
        <div className="autobuild-title">🔗 SHARE DECK</div>
        <div className="share-section u-col u-gap-3">
          <div className="share-label">EXPORT — copy this code and share it:</div>
          <textarea
            ref={shareCodeRef}
            className="share-code-box"
            readOnly
            value={deckCode}
            onClick={e => (e.target as HTMLTextAreaElement).select()}
          />
          <Button
            size="sm"
            className="u-self-start"
            onClick={onCopy}
          >
            {copyFeedback ? '✓ COPIED!' : '📋 COPY'}
          </Button>
        </div>
        <div className="share-divider">──────────</div>
        <div className="share-section u-col u-gap-3">
          <div className="share-label">IMPORT — paste a deck code:</div>
          <textarea
            className="share-code-box"
            value={importCode}
            onChange={e => onImportCodeChange(e.target.value)}
            placeholder="Paste code here…"
            rows={3}
          />
          {importError && <div className="share-error">{importError}</div>}
          <Button
            size="sm"
            className="u-self-start"
            onClick={onImport}
            disabled={!importCode.trim()}
          >
            LOAD DECK
          </Button>
        </div>
        <Button className="autobuild-cancel" onClick={onClose}>
          CLOSE
        </Button>
      </div>
    </ModalBackdrop>
  )
}
