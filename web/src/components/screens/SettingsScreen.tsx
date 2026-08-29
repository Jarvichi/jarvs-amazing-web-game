import React, { useState, useRef } from 'react'
import {
  signOut as firebaseSignOut, type User,
} from 'firebase/auth'
import { isSoundEnabled, setSoundEnabled, getSoundVolume, setSoundVolume, getMusicVolume, setMusicVolume } from '../../game/sound'
import { isHapticsSupported, isHapticsEnabled, setHapticsEnabled } from '../../game/haptics'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Section } from '../ui/Section'
import { Button } from '../ui/Button'
import { LoginModal } from '../modals/LoginModal'
import { SettingsRow } from './settings/SettingsRow'
import { SettingsToggle } from './settings/SettingsToggle'
import { SettingsSlider } from './settings/SettingsSlider'
import { SettingsMessage, type SettingsStatus } from './settings/SettingsMessage'
import rollbar from '../../rollbar'
import { auth } from '../../firebase'
import { uploadSave, applySave, getLastSyncTime, type CloudSave } from '../../game/cloudSave'
import { isDevMode } from '../../game/debug'
import { DevMenu } from '../admin/DevMenu'
import { GIFT_OWNER_UID } from '../../game/gifts'
import { isAdminUser } from '../../game/admin'
import { loadPlaytime, formatPlaytime } from '../../game/playtime'
import { isHubWorldUnlocked, unlockHubWorld, loadHubDefault, saveHubDefault } from '../../game/codex'

interface Props {
  onBack: () => void
  onResetGame: () => void
  user: User | null
  authLoading: boolean
  onDevCrystalsChanged?: (n: number) => void
  onDevHandicapChanged?: (n: number) => void
  onGiftAdmin?: () => void
  onNewsAdmin?: () => void
  onCampaignAdmin?: () => void
  onFeedbackAdmin?: () => void
  onTownAccessAdmin?: () => void
  onHubWorld?: () => void
  onTitleScreen?: () => void
  onCheckForUpdates?: () => Promise<void>
  onSceneryPreview?: () => void
}

const TEXT_SIZE_KEY      = 'jarv_text_size'
const TEXT_COLOR_KEY     = 'jarv_text_color'
const SKIP_INTRO_KEY     = 'jarv_skip_intro'
const EIGHTBIT_UNLOCKED_KEY = 'jarv_8bit_unlocked'
const EIGHTBIT_ENABLED_KEY  = 'jarv_8bit_enabled'
const BATTLE_POPUPS_KEY     = 'jarv_battle_popups'

export function loadSkipIntro(): boolean {
  try { return localStorage.getItem(SKIP_INTRO_KEY) === 'true' }
  catch { return false }
}

export function saveSkipIntro(val: boolean): void {
  try { localStorage.setItem(SKIP_INTRO_KEY, String(val)) } catch { /* ignore */ }
}

export function loadTextSize(): number {
  try { return parseFloat(localStorage.getItem(TEXT_SIZE_KEY) ?? '14') || 14 }
  catch { return 14 }
}

export function loadTextColor(): string {
  try { return localStorage.getItem(TEXT_COLOR_KEY) ?? '#33ff33' }
  catch { return '#33ff33' }
}

export function load8bitUnlocked(): boolean {
  try { return localStorage.getItem(EIGHTBIT_UNLOCKED_KEY) === 'true' }
  catch { return false }
}

export function unlock8bitMode(): void {
  try { localStorage.setItem(EIGHTBIT_UNLOCKED_KEY, 'true') } catch { /* ignore */ }
}

export function load8bitEnabled(): boolean {
  try { return localStorage.getItem(EIGHTBIT_ENABLED_KEY) === 'true' }
  catch { return false }
}

export function save8bitEnabled(val: boolean): void {
  try { localStorage.setItem(EIGHTBIT_ENABLED_KEY, String(val)) } catch { /* ignore */ }
}

export function apply8bitMode(enabled: boolean): void {
  document.documentElement.classList.toggle('eightbit-mode', enabled)
  window.dispatchEvent(new Event('eightbit-change'))
}

// Light mode was retired (#2184): only 5 of 654+ hardcoded colours in the
// stylesheet actually responded to it, so it produced dark panels on a
// cream background rather than a real light theme. This clears the stale
// preference for anyone who had it on, so they land on the (correct,
// readable) dark theme instead of a setting that no longer does anything.
export function clearLegacyLightMode(): void {
  try { localStorage.removeItem('jarv_light_mode') } catch { /* ignore */ }
}

export function loadMonochromeEnabled(): boolean {
  try { return localStorage.getItem('jarv_monochrome_enabled') === 'true' }
  catch { return false }
}

export function saveMonochromeEnabled(val: boolean): void {
  try { localStorage.setItem('jarv_monochrome_enabled', String(val)) } catch { /* ignore */ }
}

export function applyMonochromeMode(enabled: boolean): void {
  document.documentElement.classList.toggle('monochrome-mode', enabled)
  window.dispatchEvent(new Event('monochrome-change'))
}

export function loadBattlePopups(): boolean {
  try { return localStorage.getItem(BATTLE_POPUPS_KEY) !== 'false' }
  catch { return true }
}

export function saveBattlePopups(val: boolean): void {
  try { localStorage.setItem(BATTLE_POPUPS_KEY, String(val)) } catch { /* ignore */ }
}

export function applyTextSettings(): void {
  const size  = loadTextSize()
  const color = loadTextColor()
  document.documentElement.style.setProperty('--game-font-size', `${size}px`)
  document.documentElement.style.setProperty('--game-text-color', color)
}

const TEXT_COLOR_PRESETS = [
  { label: 'Terminal Green', value: '#33ff33' },
  { label: 'Amber',          value: '#ffbb33' },
  { label: 'Cyan',           value: '#33ddff' },
  { label: 'White',          value: '#e8e8e8' },
  { label: 'Pink',           value: '#ff88cc' },
]

const isDebugMode = new URLSearchParams(window.location.search).has('debug')


function exportLocalStorage(): void {
  const data: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) data[key] = localStorage.getItem(key) ?? ''
    }
  } catch { /* ignore */ }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `jarv-save-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}


export function SettingsScreen({ onBack, onResetGame, user, authLoading, onDevCrystalsChanged, onDevHandicapChanged, onGiftAdmin, onNewsAdmin, onCampaignAdmin, onFeedbackAdmin, onTownAccessAdmin, onHubWorld, onTitleScreen, onCheckForUpdates, onSceneryPreview }: Props) {
  const [soundOn,       setSoundOn]       = useState(isSoundEnabled)
  const [soundVolume,   setSoundVolumeState]   = useState(getSoundVolume)
  const [musicVolume,   setMusicVolumeState]   = useState(getMusicVolume)
  const [textSize,      setTextSize]      = useState(loadTextSize)
  const [textColor,     setTextColor]     = useState(loadTextColor)
  const [skipIntro,     setSkipIntro]     = useState(loadSkipIntro)
  const [eightbitOn,    setEightbitOn]    = useState(load8bitEnabled)
  const [eightbitUnlocked]               = useState(load8bitUnlocked)
  const [monochromeOn,   setMonochromeOn]   = useState(loadMonochromeEnabled)
  const [hapticsOn,      setHapticsOn]      = useState(isHapticsEnabled)
  const [battlePopups,  setBattlePopups]  = useState(loadBattlePopups)
  const [hubDefault,    setHubDefault]    = useState(loadHubDefault)
  const [confirmReset,  setConfirmReset]  = useState(false)
  const [updateStatus,  setUpdateStatus]  = useState<'idle' | 'checking' | 'done'>('idle')
  const [importMsg,     setImportMsg]     = useState<SettingsStatus | null>(null)
  const [rollbarMsg,    setRollbarMsg]    = useState<SettingsStatus | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  // Sync state
  const [syncing,          setSyncing]          = useState(false)
  const [syncMsg,          setSyncMsg]          = useState<SettingsStatus | null>(null)
  const [pendingCloudSave, setPendingCloudSave] = useState<CloudSave | null>(null)
  const [lastSync,         setLastSync]         = useState<Date | null>(getLastSyncTime)
  const [showLoginModal,   setShowLoginModal]   = useState(false)

  async function handleSync() {
    if (!user || user.isAnonymous) return
    setSyncing(true)
    setSyncMsg(null)
    try {
      await uploadSave(user.uid)
      const t = new Date()
      setLastSync(t)
      setSyncMsg({ text: 'Save synced.', kind: 'ok' })
    } catch {
      setSyncMsg({ text: 'Sync failed. Check your connection.', kind: 'error' })
    } finally {
      setSyncing(false)
    }
  }

  async function handleSignOut() {
    await firebaseSignOut(auth)
    setSyncMsg(null)
    setPendingCloudSave(null)
    setLastSync(null)
  }

  function handleLoadCloudSave() {
    if (!pendingCloudSave) return
    applySave(pendingCloudSave.data)
    setPendingCloudSave(null)
    setLastSync(new Date())
    setSyncMsg({ text: 'Cloud save loaded. Reload the page to apply all changes.', kind: 'ok' })
  }

  async function handleKeepLocal() {
    if (!user || user.isAnonymous) return
    setPendingCloudSave(null)
    try {
      await uploadSave(user.uid)
      const t = new Date()
      setLastSync(t)
      setSyncMsg({ text: 'Local save pushed to cloud.', kind: 'ok' })
    } catch {
      setSyncMsg({ text: 'Sync failed. Check your connection.', kind: 'error' })
    }
  }

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

  function handleSoundToggle() {
    const next = !soundOn
    setSoundOn(next)
    setSoundEnabled(next)
  }

  function handleSoundVolumeChange(val: number) {
    setSoundVolumeState(val)
    setSoundVolume(val)
  }

  function handleMusicVolumeChange(val: number) {
    setMusicVolumeState(val)
    setMusicVolume(val)
  }

  function handleEightbitToggle() {
    const next = !eightbitOn
    setEightbitOn(next)
    save8bitEnabled(next)
    apply8bitMode(next)
  }

  function handleMonochromeToggle() {
    const next = !monochromeOn
    setMonochromeOn(next)
    saveMonochromeEnabled(next)
    applyMonochromeMode(next)
  }

  function handleHapticsToggle() {
    const next = !hapticsOn
    setHapticsOn(next)
    setHapticsEnabled(next)
  }

  function handleBattlePopupsToggle() {
    const next = !battlePopups
    setBattlePopups(next)
    saveBattlePopups(next)
  }

  function handleSkipIntroToggle() {
    const next = !skipIntro
    setSkipIntro(next)
    saveSkipIntro(next)
  }

  function handleSizeChange(val: number) {
    setTextSize(val)
    try { localStorage.setItem(TEXT_SIZE_KEY, String(val)) } catch { /* ignore */ }
    document.documentElement.style.setProperty('--game-font-size', `${val}px`)
  }

  function handleColorChange(val: string) {
    setTextColor(val)
    try { localStorage.setItem(TEXT_COLOR_KEY, val) } catch { /* ignore */ }
    document.documentElement.style.setProperty('--game-text-color', val)
  }

  function handleReset() {
    if (!confirmReset) { setConfirmReset(true); return }
    onResetGame()
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

  async function handleCheckForUpdates() {
    setUpdateStatus('checking')
    await onCheckForUpdates?.()
    setUpdateStatus('done')
  }

  const { totalMs, battleMs } = loadPlaytime()

  return (
    <OverlayScreen title="SETTINGS" onBack={onBack} className="settings-screen u-col u-grow">
      <div className="settings-body u-col u-gap-3 u-grow">
        <Section bordered title="AUDIO">
          <SettingsRow label="Sound" sublabel="Procedurally generated audio">
            <SettingsToggle checked={soundOn} onChange={handleSoundToggle} label="Sound" />
          </SettingsRow>
          <SettingsRow label="Effects" sublabel="In game sounds">
            <SettingsSlider
              value={soundVolume}
              onChange={handleSoundVolumeChange}
              min={0} max={1} step={0.05}
              disabled={!soundOn}
              label="Effects volume"
              readout={`${Math.round(soundVolume * 100)}%`}
            />
          </SettingsRow>
          <SettingsRow label="Music" sublabel="Background music volume">
            <SettingsSlider
              value={musicVolume}
              onChange={handleMusicVolumeChange}
              min={0} max={1} step={0.05}
              label="Music volume"
              readout={`${Math.round(musicVolume * 100)}%`}
            />
          </SettingsRow>
        </Section>

        <Section bordered title="STARTUP">
          <SettingsRow label="Skip intro on startup" sublabel="Skip the Awesome Software splash screens">
            <SettingsToggle checked={skipIntro} onChange={handleSkipIntroToggle} label="Skip intro on startup" />
          </SettingsRow>
        </Section>

        <Section bordered title="BACKUP &amp; SYNC">
          {!user?.isAnonymous ? (
            // Signed in with Google
            <>
              <SettingsRow
                label={user?.displayName ?? user?.email ?? 'Google account'}
                sublabel={lastSync ? `Last synced: ${lastSync.toLocaleString()}` : 'Not yet synced'}
              >
                <div className="u-flex u-gap-4">
                  <Button onClick={handleSync} disabled={syncing}>
                    {syncing ? 'SYNCING...' : 'SYNC NOW'}
                  </Button>
                  <Button size="xs" onClick={handleSignOut}>SIGN OUT</Button>
                </div>
              </SettingsRow>
              {pendingCloudSave && (
                <SettingsRow
                  stacked
                  label={
                    <span className="settings-label--warn">
                      Cloud save found ({pendingCloudSave.savedAt.toDate().toLocaleString()})
                    </span>
                  }
                  sublabel="Load it? Your local progress will be replaced."
                >
                  <div className="u-flex u-gap-4">
                    <Button onClick={handleLoadCloudSave}>LOAD CLOUD SAVE</Button>
                    <Button size="xs" onClick={handleKeepLocal}>KEEP LOCAL</Button>
                  </div>
                </SettingsRow>
              )}
            </>
          ) : (
            // Anonymous — not yet signed in
            <SettingsRow label="Sync save across devices" sublabel="Sign in to back up and restore your progress">
              <Button onClick={() => setShowLoginModal(true)} disabled={authLoading}>
                SIGN IN
              </Button>
            </SettingsRow>
          )}
          {syncMsg && <SettingsMessage status={syncMsg} />}
        </Section>

        {eightbitUnlocked && (
          <Section bordered title="🕹 8-BIT MODE">
            <SettingsRow label="8-bit visual filter" sublabel="Posterised palette + pixelated sprites">
              <SettingsToggle checked={eightbitOn} onChange={handleEightbitToggle} label="8-bit visual filter" />
            </SettingsRow>
          </Section>
        )}

        <Section bordered title="MONOCHROME MODE">
          <SettingsRow label="Monochrome visual filter" sublabel="Green and black terminal-style palette">
            <SettingsToggle checked={monochromeOn} onChange={handleMonochromeToggle} label="Monochrome visual filter" />
          </SettingsRow>
        </Section>

        {/* Hidden entirely rather than shown-but-inert on iOS Safari (no
            Vibration API) — a toggle that visibly does nothing is worse
            than no toggle, same call as retiring light mode (#2184). */}
        {isHapticsSupported() && (
          <Section bordered title="HAPTICS">
            <SettingsRow label="Vibration" sublabel="Short pulses for card plays, hits, and wins/losses">
              <SettingsToggle checked={hapticsOn} onChange={handleHapticsToggle} label="Vibration" />
            </SettingsRow>
          </Section>
        )}

        <Section bordered title="DISPLAY">
          <SettingsRow
            label="Battle event popups"
            sublabel="Show mid-battle popups for notable events (e.g. hero summons)"
          >
            <SettingsToggle checked={battlePopups} onChange={handleBattlePopupsToggle} label="Battle event popups" />
          </SettingsRow>
          <SettingsRow label="Text size" sublabel={`${textSize}px`}>
            <SettingsSlider
              value={textSize}
              onChange={handleSizeChange}
              min={11} max={18} step={1}
              label="Text size"
              readout={`${textSize}px`}
            />
          </SettingsRow>
          <SettingsRow label="Text colour" sublabel="Choose a terminal palette">
            <div className="u-flex u-wrap u-gap-3">
              {TEXT_COLOR_PRESETS.map(p => (
                <button
                  key={p.value}
                  className={`filter-btn${textColor === p.value ? ' filter-btn--active' : ''}`}
                  style={textColor === p.value ? { borderColor: p.value, color: p.value } : { color: p.value, borderColor: p.value + '66' }}
                  onClick={() => handleColorChange(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </SettingsRow>
        </Section>

        <Section bordered title="GAME DATA">
          <SettingsRow
            label="Reset all progress"
            sublabel="Clears collection, deck, crystals, campaign and stats"
          />
          <SettingsRow>
            {confirmReset ? (
              <div className="settings-confirm-row u-flex u-gap-4 u-items-c u-just-end">
                <span className="settings-confirm-msg">Are you sure? This cannot be undone.</span>
                <Button variant="danger" className="settings-danger-btn" onClick={handleReset}>CONFIRM RESET</Button>
                <Button size="xs" onClick={() => setConfirmReset(false)}>CANCEL</Button>
              </div>
            ) : (
              <Button variant="danger" className="settings-danger-btn" onClick={handleReset}>
                RESET GAME
              </Button>
            )}
          </SettingsRow>
        </Section>

        {isHubWorldUnlocked() && (
          <Section bordered title="NAVIGATION">
            <SettingsRow label="Default startup screen" sublabel="Which screen opens when the game launches">
              <div className="u-flex u-gap-4">
                <Button
                  variant={hubDefault === 'hub' ? 'gold' : 'default'}
                  onClick={() => { saveHubDefault('hub'); setHubDefault('hub') }}
                >
                  HUB WORLD
                </Button>
                <Button
                  variant={hubDefault === 'title' ? 'gold' : 'default'}
                  onClick={() => { saveHubDefault('title'); setHubDefault('title') }}
                >
                  TITLE SCREEN
                </Button>
              </div>
            </SettingsRow>
          </Section>
        )}

        {user?.uid === GIFT_OWNER_UID && (onHubWorld || onTitleScreen) && (
          <Section bordered title="EXPERIMENTS">
            {onHubWorld && (
              <SettingsRow label="Hub World" sublabel="Prototype terrain canvas">
                <Button onClick={onHubWorld}>OPEN</Button>
              </SettingsRow>
            )}
            <SettingsRow label="Unlock Hub World" sublabel="Dev cheat — sets the hub world unlock flag">
              <Button onClick={() => { unlockHubWorld(); window.location.reload() }}>UNLOCK</Button>
            </SettingsRow>
          </Section>
        )}

        {(isDebugMode || user?.uid === GIFT_OWNER_UID) && (
          <Section bordered title="DEBUG">
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
          </Section>
        )}

        {user?.uid === GIFT_OWNER_UID && (onGiftAdmin || onNewsAdmin || onFeedbackAdmin || onCampaignAdmin || onTownAccessAdmin) && (
          <Section bordered title="ADMIN">
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
          </Section>
        )}

        {(isDevMode() || isAdminUser(user)) && onDevCrystalsChanged && onDevHandicapChanged && onSceneryPreview && (
          <DevMenu
            onCrystalsChanged={onDevCrystalsChanged}
            onHandicapChanged={onDevHandicapChanged}
            onSceneryPreview={onSceneryPreview}
          />
        )}

        <Section bordered title="ABOUT">
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
          <SettingsRow label="Time in game" sublabel={formatPlaytime(totalMs)} />
          <SettingsRow label="Time in battle" sublabel={formatPlaytime(battleMs)} />
          {onCheckForUpdates && (
            <SettingsRow
              label="Check for updates"
              sublabel={
                updateStatus === 'checking' ? 'Checking...'
                : updateStatus === 'done'   ? 'Done. If a new version was found the game will reload automatically.'
                : 'Manually fetch the latest version if auto-updates have failed'
              }
            >
              <Button onClick={handleCheckForUpdates} disabled={updateStatus === 'checking'}>
                {updateStatus === 'checking' ? 'CHECKING...' : 'CHECK FOR UPDATES'}
              </Button>
            </SettingsRow>
          )}
        </Section>
      </div>
      {showLoginModal && (
        <LoginModal
          user={user}
          authLoading={authLoading}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={({ pendingCloudSave, lastSync: newSync, status }) => {
            setShowLoginModal(false)
            if (pendingCloudSave) setPendingCloudSave(pendingCloudSave)
            if (newSync) setLastSync(newSync)
            if (status) setSyncMsg(status)
          }}
        />
      )}
    </OverlayScreen>
  )
}
