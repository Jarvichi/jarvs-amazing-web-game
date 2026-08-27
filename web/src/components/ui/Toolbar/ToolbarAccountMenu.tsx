import React from 'react'
import type { User } from 'firebase/auth'
import { ToolbarButton } from './ToolbarButton'
import { ToolbarDropdown } from './ToolbarDropdown'
import { Icon } from '../icons/Icon'
import { LoginButton } from '../LoginButton'

interface Props {
  user: User | null
  playerName: string
  onSignIn?: () => void
  onSignOut?: () => void
  onPlayerTap?: () => void
  onFeedback: () => void
  /** Omitted where the host bar has no settings of its own — the row is then
   *  simply absent rather than wired to something else. */
  onSettings?: () => void
}

/**
 * The account cluster every hub toolbar ends with: who you are, feedback, and
 * settings. Sits inline while the toolbar is wide enough and collapses into a
 * single ▾ menu below the container-query breakpoint.
 *
 * Shared because HubStatusBar and HubWorldMap each carried their own copy, and
 * the copies had drifted: three buttons in three different visual languages
 * (the title screen's gold-outlined auth button, a `filter-btn`, and a green
 * `action-btn`), stacked at three different widths inside one small dropdown.
 * One component, one row style — change it here and both bars follow.
 */
export function ToolbarAccountMenu({
  user, playerName, onSignIn, onSignOut, onPlayerTap, onFeedback, onSettings,
}: Props) {
  /* Inline, the rows sit among the bar's other icon-only buttons and match
     them. In the dropdown there's room for text, and an unlabelled icon in a
     menu is a guessing game — so the same rows gain labels there. */
  const rows = (inMenu: boolean) => {
    const cls = inMenu ? 'filter-btn toolbar-menu-item' : undefined
    return (
      <>
        {/* Always a toolbar button, never the title screen's green action-btn:
            inline, the signed-out state used to shout SIGN IN in a colour and
            shape nothing else on the bar shared. */}
        <LoginButton
          className={cls ?? 'filter-btn'}
          onSignIn={() => onSignIn?.()}
          onSignOut={() => onSignOut?.()}
          onPlayerTap={onPlayerTap}
          user={user}
          playerName={playerName}
        />
        <ToolbarButton
          className={cls}
          onClick={onFeedback}
          title="Send feedback or report a bug"
          icon="🗣️"
          label={inMenu ? 'Feedback' : undefined}
        />
        {onSettings && (
          <ToolbarButton
            className={cls}
            onClick={onSettings}
            title="Settings"
            icon="⚙"
            label={inMenu ? 'Settings' : undefined}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div className="toolbar-overflow-inline">{rows(false)}</div>
      <div className="toolbar-overflow-dropdown">
        <ToolbarDropdown
          label={<Icon name="player" size={16} />}
          title="Account"
          align="right"
        >
          {rows(true)}
        </ToolbarDropdown>
      </div>
    </>
  )
}
