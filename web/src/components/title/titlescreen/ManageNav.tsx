import React from 'react'
import { Icon } from '../../ui/icons/Icon'
import { SpriteImg } from '../../ui/SpriteImg'

interface Props {
  onPlayer: () => void
  achievementAlert: boolean
  onDeckBuilder: () => void
  onCollection: () => void
  collectionAlert: boolean
  onShop: () => void
  shopAlert: boolean
  onCodex: () => void
  onChronicle: () => void
  chronicleAlert: boolean
  onNews: () => void
  hasUnreadNews: boolean
  onSettings: () => void
  commanderName?: string | null
  onCommander?: () => void
}

function NavItem({ onClick, alert, children }: { onClick: () => void; alert?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" className="title-nav-item" onClick={onClick}>
      {children}
      {alert && <span className="title-nav-badge" aria-hidden="true" />}
    </button>
  )
}

/** The "manage" nav grid — visually quiet compared to the play tiers above,
 *  since these are account/collection management screens, not game modes. */
export function ManageNav({
  onPlayer, achievementAlert, onDeckBuilder, onCollection, collectionAlert,
  onShop, shopAlert, onCodex, onChronicle, chronicleAlert, onNews, hasUnreadNews,
  onSettings, commanderName, onCommander,
}: Props) {
  return (
    <div className="title-nav-section">
      <div className="title-nav-label">MANAGE</div>
      <div className="title-nav-grid">
        <NavItem onClick={onPlayer} alert={achievementAlert}><Icon name="player" size={14} /> PLAYER</NavItem>
        <NavItem onClick={onDeckBuilder}><Icon name="deck" size={14} /> DECK</NavItem>
        <NavItem onClick={onCollection} alert={collectionAlert}><Icon name="collection" size={14} /> COLLECTION</NavItem>
        <NavItem onClick={onShop} alert={shopAlert}><Icon name="shop" size={14} /> SHOP</NavItem>
        <NavItem onClick={onCodex}><Icon name="codex" size={14} /> CODEX</NavItem>
        <NavItem onClick={onChronicle} alert={chronicleAlert}><Icon name="chronicle" size={14} /> CHRONICLE</NavItem>
        <NavItem onClick={onNews} alert={hasUnreadNews}><Icon name="news" size={14} /> WHAT'S NEW</NavItem>
        <NavItem onClick={onSettings}><Icon name="settings" size={14} /> SETTINGS</NavItem>
        {commanderName && onCommander && (
          <NavItem onClick={onCommander}>
            <SpriteImg name={commanderName} className="commander-btn-sprite" />
            {commanderName.toUpperCase()}
          </NavItem>
        )}
      </div>
    </div>
  )
}
