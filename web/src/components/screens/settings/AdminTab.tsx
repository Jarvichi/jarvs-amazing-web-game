import React, { useRef, useState } from 'react'
import { type User } from 'firebase/auth'
import rollbar from '../../../rollbar'
import { isDevMode } from '../../../game/debug'
import { isAdminUser } from '../../../game/admin'
import { GIFT_OWNER_UID } from '../../../game/gifts'
import { unlockHubWorld } from '../../../game/codex'
import { DevMenu } from '../../admin/DevMenu'
import { Button } from '../../ui/Button'
import { Panel } from '../../ui/Panel'
import { SettingsRow } from './SettingsRow'
import { SettingsMessage, type SettingsStatus } from './SettingsMessage'
import { exportLocalStorage, isDebugMode } from './settingsStorage'

export interface AdminTabProps {
  user: User | null
  onDevCrystalsChanged?: (n: number) => void
  onDevHandicapChanged?: (n: number) => void
  onGiftAdmin?: () => void
  onNewsAdmin?: () => void
  onCampaignAdmin?: () => void
  onFeedbackAdmin?: () => void
  onTownAccessAdmin?: () => void
  onHubWorld?: () => void
  onTitleScreen?: () => void
  onSceneryPreview?: () => void
}

/**
 * Whether this user sees the Admin tab at all. Kept next to the tab so
 * gating dev surfaces out of store builds (#2088) is a change in one place.
 */
export function canSeeAdminTab(props: AdminTabProps): boolean {
  const { user, onDevCrystalsChanged, onDevHandicapChanged, onSceneryPreview } = props
  return (
    isDebugMode ||
    user?.uid === GIFT_OWNER_UID ||
    ((isDevMode() || isAdminUser(user)) &&
      Boolean(onDevCrystalsChanged && onDevHandicapChanged && onSceneryPreview))
  )
}

/**
 * Owner-only tooling: the former EXPERIMENTS, DEBUG and ADMIN sections plus
 * the dev menu, which were four of the fourteen sections every player had to
 * scroll past.
 */
export function AdminTab(props: AdminTabProps) {
  const {
    user, onDevCrystalsChanged, onDevHandicapChanged, onGiftAdmin, onNewsAdmin,
    onCampaignAdmin, onFeedbackAdmin, onTownAccessAdmin, onHubWorld, onTitleScreen,
    onSceneryPreview,
  } = props

  const [importMsg,  setImportMsg]  = useState<SettingsStatus | null>(null)
  const [rollbarMsg, setRollbarMsg] = useState<SettingsStatus | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const isOwner = user?.uid === GIFT_OWNER_UID

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as Record<string, string>
        for (const [key, val] of Object.entries(data)) {
          localStorage.setItem(key, val)
        }
        setImportMsg({ text: 'Save loaded! Reload the page to apply.', kind: 'ok' })
      } catch {
        setImportMsg({ text: 'Error: invalid save file.', kind: 'error' })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleRollbarTest() {
    try {
      rollbar.info('Rollbar test from Jarv\'s Amazing Web Game debug screen')
      setRollbarMsg({ text: 'Info event sent to Rollbar.', kind: 'ok' })
    } catch (e) {
      setRollbarMsg({ text: `Failed: ${String(e)}`, kind: 'error' })
    }
  }

  function handleRollbarError() {
    try {
      rollbar.error(new Error('Intentional Rollbar test error from debug screen'))
      setRollbarMsg({ text: 'Error sent to Rollbar — check dashboard.', kind: 'ok' })
    } catch (e) {
      setRollbarMsg({ text: `Failed: ${String(e)}`, kind: 'error' })
    }
  }

  function handleResetHubData() {
    try { localStorage.removeItem('jarv_hub_quests') } catch { /* ignore */ }
    try { localStorage.removeItem('jarv_hub_pickups') } catch { /* ignore */ }
  }

  const showExperiments = isOwner && (onHubWorld || onTitleScreen)
  const showDebug       = isDebugMode || isOwner
  const showAdmin       = isOwner && (onGiftAdmin || onNewsAdmin || onFeedbackAdmin || onCampaignAdmin || onTownAccessAdmin)
  const showDevMenu     = (isDevMode() || isAdminUser(user)) && onDevCrystalsChanged && onDevHandicapChanged && onSceneryPreview

  return (
    <div className="u-col u-gap-5">
      {showExperiments && (
        <Panel elevation="raised" tone="gold" runeCorners>
          <div className="settings-panel-title">EXPERIMENTS</div>
          {onHubWorld && (
            <SettingsRow label="Hub World" sublabel="Prototype terrain canvas">
              <Button onClick={onHubWorld}>OPEN</Button>
            </SettingsRow>
          )}
          <SettingsRow label="Unlock Hub World" sublabel="Dev cheat — sets the hub world unlock flag">
            <Button onClick={() => { unlockHubWorld(); window.location.reload() }}>UNLOCK</Button>
          </SettingsRow>
        </Panel>
      )}

      {showDebug && (
        <Panel elevation="raised" tone="gold" runeCorners>
          <div className="settings-panel-title">DEBUG</div>
          <SettingsRow label="Export save data" sublabel="Download all localStorage as a JSON file">
            <Button onClick={exportLocalStorage}>EXPORT</Button>
          </SettingsRow>
          <SettingsRow label="Import save data" sublabel="Load a previously exported JSON save file">
            <Button onClick={() => importRef.current?.click()}>IMPORT</Button>
            <input ref={importRef} type="file" accept=".json" className="u-hidden" onChange={handleImport} />
          </SettingsRow>
          {importMsg && <SettingsMessage status={importMsg} />}
          <SettingsRow label="Rollbar: send info" sublabel="Send a test info event to Rollbar">
            <Button onClick={handleRollbarTest}>SEND INFO</Button>
          </SettingsRow>
          <SettingsRow label="Rollbar: trigger error" sublabel="Throw an intentional error for Rollbar to capture">
            <Button variant="danger" onClick={handleRollbarError}>TRIGGER ERROR</Button>
          </SettingsRow>
          {rollbarMsg && <SettingsMessage status={rollbarMsg} />}
        </Panel>
      )}

      {showAdmin && (
        <Panel elevation="raised" tone="gold" runeCorners>
          <div className="settings-panel-title">ADMIN</div>
          {onGiftAdmin && (
            <SettingsRow label="Gift management" sublabel="Create and delete one-off player gifts">
              <Button variant="gold" onClick={onGiftAdmin}>OPEN</Button>
            </SettingsRow>
          )}
          {onNewsAdmin && (
            <SettingsRow label="News / What's New" sublabel="Post new feature announcements and patch notes">
              <Button variant="gold" onClick={onNewsAdmin}>OPEN</Button>
            </SettingsRow>
          )}
          {onCampaignAdmin && (
            <SettingsRow label="Campaign editor" sublabel="Edit act nodes, enemy decks, and environments">
              <Button variant="gold" onClick={onCampaignAdmin}>OPEN</Button>
            </SettingsRow>
          )}
          {onFeedbackAdmin && (
            <SettingsRow label="Feedback inbox" sublabel="View and delete player-submitted feedback">
              <Button variant="gold" onClick={onFeedbackAdmin}>OPEN</Button>
            </SettingsRow>
          )}
          {onTownAccessAdmin && (
            <SettingsRow label="Town access" sublabel="Choose which hub-world towns players can enter">
              <Button variant="gold" onClick={onTownAccessAdmin}>OPEN</Button>
            </SettingsRow>
          )}
          <SettingsRow
            label="Reset hub quests &amp; pickups"
            sublabel="Clears all quest progress and collected pickup state"
          >
            <Button variant="danger" onClick={handleResetHubData}>RESET</Button>
          </SettingsRow>
        </Panel>
      )}

      {showDevMenu && (
        <DevMenu
          onCrystalsChanged={onDevCrystalsChanged}
          onHandicapChanged={onDevHandicapChanged}
          onSceneryPreview={onSceneryPreview}
        />
      )}
    </div>
  )
}
