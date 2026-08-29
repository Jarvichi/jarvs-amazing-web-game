import { useState } from 'react'
import { isHubWorldUnlocked, loadHubDefault, saveHubDefault } from '../../../game/codex'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { SettingsRow } from './SettingsRow'
import { SettingsToggle } from './SettingsToggle'
import { loadSkipIntro, saveSkipIntro } from './settingsStorage'

interface Props {
  onResetGame: () => void
}

/** Startup behaviour and the destructive progress reset. */
export function GameTab({ onResetGame }: Props) {
  const [skipIntro,    setSkipIntro]    = useState(loadSkipIntro)
  const [hubDefault,   setHubDefault]   = useState(loadHubDefault)
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <>
      <SettingsRow
        label="Skip intro on startup"
        sublabel="Skip the Awesome Software splash screens"
      >
        <SettingsToggle
          checked={skipIntro}
          onChange={() => { const next = !skipIntro; setSkipIntro(next); saveSkipIntro(next) }}
          label="Skip intro on startup"
        />
      </SettingsRow>

      {isHubWorldUnlocked() && (
        <SettingsRow
          label="Default startup screen"
          sublabel="Which screen opens when the game launches"
        >
          <div className="u-flex u-gap-4">
            <Button
              variant={hubDefault === 'hub' ? 'gold' : 'default'}
              aria-pressed={hubDefault === 'hub'}
              onClick={() => { saveHubDefault('hub'); setHubDefault('hub') }}
            >
              HUB WORLD
            </Button>
            <Button
              variant={hubDefault === 'title' ? 'gold' : 'default'}
              aria-pressed={hubDefault === 'title'}
              onClick={() => { saveHubDefault('title'); setHubDefault('title') }}
            >
              TITLE SCREEN
            </Button>
          </div>
        </SettingsRow>
      )}

      <SettingsRow
        label="Reset all progress"
        sublabel="Clears collection, deck, crystals, campaign and stats"
      >
        <Button variant="danger" className="settings-danger-btn" onClick={() => setConfirmReset(true)}>
          RESET GAME
        </Button>
      </SettingsRow>

      {/* Was an inline "are you sure?" row swap. A destructive, irreversible
          action gets a real dialog — Modal is the standard shell (#2174). */}
      {confirmReset && (
        <Modal
          title="RESET GAME"
          tone="danger"
          onClose={() => setConfirmReset(false)}
          footer={
            <div className="u-flex u-gap-4 u-just-end">
              <Button onClick={() => setConfirmReset(false)}>CANCEL</Button>
              <Button variant="danger" onClick={onResetGame}>CONFIRM RESET</Button>
            </div>
          }
        >
          <p className="settings-confirm-msg">Are you sure? This cannot be undone.</p>
          <p className="settings-sublabel">
            Your collection, deck, crystals, campaign progress and stats will all be cleared.
          </p>
        </Modal>
      )}
    </>
  )
}
