import { useState } from 'react'
import { loadPlaytime, formatPlaytime } from '../../../game/playtime'
import { Button } from '../../ui/Button'
import { SettingsRow } from './SettingsRow'

interface Props {
  onCheckForUpdates?: () => Promise<void>
}

const UPDATE_SUBLABEL = {
  idle:     'Manually fetch the latest version if auto-updates have failed',
  checking: 'Checking...',
  done:     'Done. If a new version was found the game will reload automatically.',
} as const

/** Build metadata, credits, playtime, and the manual update check. */
export function AboutTab({ onCheckForUpdates }: Props) {
  const [updateStatus, setUpdateStatus] = useState<keyof typeof UPDATE_SUBLABEL>('idle')
  const { totalMs, battleMs } = loadPlaytime()

  async function handleCheckForUpdates() {
    setUpdateStatus('checking')
    await onCheckForUpdates?.()
    setUpdateStatus('done')
  }

  return (
    <>
      <SettingsRow label="Jarv's Amazing Web Game" sublabel="A browser-based strategy card game" />
      <SettingsRow label="Build" sublabel={new Date(__BUILD_DATE__).toLocaleString()} />
      <SettingsRow
        label="Build ID"
        sublabel={import.meta.env.VITE_GIT_SHA ? import.meta.env.VITE_GIT_SHA.slice(0, 7) : 'local build'}
      />
      <SettingsRow
        label="Tileset art"
        sublabel={<a href="https://pipoya.itch.io/" target="_blank" rel="noreferrer">Pipoya</a>}
      />
      <SettingsRow label="Time in game"   sublabel={formatPlaytime(totalMs)} />
      <SettingsRow label="Time in battle" sublabel={formatPlaytime(battleMs)} />

      {onCheckForUpdates && (
        <SettingsRow label="Check for updates" sublabel={UPDATE_SUBLABEL[updateStatus]}>
          <Button onClick={handleCheckForUpdates} disabled={updateStatus === 'checking'}>
            {updateStatus === 'checking' ? 'CHECKING...' : 'CHECK FOR UPDATES'}
          </Button>
        </SettingsRow>
      )}
    </>
  )
}
