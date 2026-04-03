import React, { useState, useRef } from 'react'
import {
  signOut as firebaseSignOut, type User,
} from 'firebase/auth'
import { isSoundEnabled, setSoundEnabled } from '../game/sound'
import { OverlayScreen } from './OverlayScreen'
import { Section } from './Section'
import { LoginModal } from './LoginModal'
import rollbar from '../rollbar'
import { auth } from '../firebase'
import { uploadSave, applySave, getLastSyncTime, type CloudSave } from '../game/cloudSave'
import { isDevMode } from '../game/debug'
import { DevMenu } from './DevMenu'
import { GIFT_OWNER_UID } from '../game/gifts'
import { loadPlaytime, formatPlaytime } from '../game/playtime'

interface Props {
  onBack: () => void
  onResetGame: () => void
  user: User | null
  authLoading: boolean
  onDevCrystalsChanged?: (n: number) => void
  onDevHandicapChanged?: (n: number) => void
  onGiftAdmin?: () => void
  onNewsAdmin?: () => void
}

const TEXT_SIZE_KEY      = 'jarv_text_size'
const TEXT_COLOR_KEY     = 'jarv_text_color'
const SKIP_INTRO_KEY     = 'jarv_skip_intro'
const EIGHTBIT_UNLOCKED_KEY = 'jarv_8bit_unlocked'
const EIGHTBIT_ENABLED_KEY  = 'jarv_8bit_enabled'
const LIGHT_MODE_KEY        = 'jarv_light_mode'

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

export function loadLightMode(): boolean {
  try { return localStorage.getItem(LIGHT_MODE_KEY) === 'true' }
  catch { return false }
}

export function saveLightMode(val: boolean): void {
  try { localStorage.setItem(LIGHT_MODE_KEY, String(val)) } catch { /* ignore */ }
}

export function applyLightMode(enabled: boolean): void {
  document.documentElement.classList.toggle('light-mode', enabled)
  // applyTextSettings() sets --game-text-color as an inline style, which has
  // higher specificity than the .light-mode CSS class rule. Remove the inline
  // override when light mode is on so the CSS variable takes effect; restore
  // the user's chosen colour when light mode is off.
  if (enabled) {
    document.documentElement.style.removeProperty('--game-text-color')
  } else {
    document.documentElement.style.setProperty('--game-text-color', loadTextColor())
  }
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

export function SettingsScreen({ onBack, onResetGame, user, authLoading, onDevCrystalsChanged, onDevHandicapChanged, onGiftAdmin, onNewsAdmin }: Props) {
  const [soundOn,       setSoundOn]       = useState(isSoundEnabled)
  const [textSize,      setTextSize]      = useState(loadTextSize)
  const [textColor,     setTextColor]     = useState(loadTextColor)
  const [skipIntro,     setSkipIntro]     = useState(loadSkipIntro)
  const [eightbitOn,    setEightbitOn]    = useState(load8bitEnabled)
  const [eightbitUnlocked]               = useState(load8bitUnlocked)
  const [lightModeOn,   setLightModeOn]   = useState(loadLightMode)
  const [confirmReset,  setConfirmReset]  = useState(false)
  const [importMsg,     setImportMsg]     = useState<string | null>(null)
  const [rollbarMsg,    setRollbarMsg]    = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  // Sync state
  const [syncing,          setSyncing]          = useState(false)
  const [syncMsg,          setSyncMsg]          = useState<string | null>(null)
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
      setSyncMsg('Save synced.')
    } catch {
      setSyncMsg('Sync failed. Check your connection.')
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
    setSyncMsg('Cloud save loaded. Reload the page to apply all changes.')
  }

  async function handleKeepLocal() {
    if (!user || user.isAnonymous) return
    setPendingCloudSave(null)
    try {
      await uploadSave(user.uid)
      const t = new Date()
      setLastSync(t)
      setSyncMsg('Local save pushed to cloud.')
    } catch {
      setSyncMsg('Sync failed. Check your connection.')
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
        setImportMsg('Save loaded! Reload the page to apply.')
      } catch {
        setImportMsg('Error: invalid save file.')
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

  function handleEightbitToggle() {
    const next = !eightbitOn
    setEightbitOn(next)
    save8bitEnabled(next)
    apply8bitMode(next)
  }

  function handleLightModeToggle() {
    const next = !lightModeOn
    setLightModeOn(next)
    saveLightMode(next)
    applyLightMode(next)
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
      setRollbarMsg('Info event sent to Rollbar.')
    } catch (e) {
      setRollbarMsg(`Failed: ${String(e)}`)
    }
  }

  function handleRollbarError() {
    try {
      rollbar.error(new Error('Intentional Rollbar test error from debug screen'))
      setRollbarMsg('Error sent to Rollbar — check dashboard.')
    } catch (e) {
      setRollbarMsg(`Failed: ${String(e)}`)
    }
  }

  return (
    <OverlayScreen title="SETTINGS" onBack={onBack} className="settings-screen">
      <div className="settings-body">
        <Section bordered title="AUDIO">
          <div className="settings-row">
            <div>
              <div className="settings-label">Sound effects</div>
              <div className="settings-sublabel">Procedurally generated audio</div>
            </div>
            <div className="settings-toggle" onClick={handleSoundToggle}>
              <div className={`settings-toggle-track${soundOn ? ' settings-toggle-track--on' : ''}`}>
                <div className="settings-toggle-thumb" />
              </div>
            </div>
          </div>
        </Section>

        <Section bordered title="STARTUP">
          <div className="settings-row">
            <div>
              <div className="settings-label">Skip intro on startup</div>
              <div className="settings-sublabel">Skip the Awesome Software splash screens</div>
            </div>
            <div className="settings-toggle" onClick={handleSkipIntroToggle}>
              <div className={`settings-toggle-track${skipIntro ? ' settings-toggle-track--on' : ''}`}>
                <div className="settings-toggle-thumb" />
              </div>
            </div>
          </div>
        </Section>

        <Section bordered title="BACKUP &amp; SYNC">
          {!user?.isAnonymous ? (
            // Signed in with Google
            <>
              <div className="settings-row">
                <div>
                  <div className="settings-label">{user?.displayName ?? user?.email ?? 'Google account'}</div>
                  <div className="settings-sublabel">
                    {lastSync ? `Last synced: ${lastSync.toLocaleString()}` : 'Not yet synced'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="action-btn" onClick={handleSync} disabled={syncing}>
                    {syncing ? 'SYNCING...' : 'SYNC NOW'}
                  </button>
                  <button className="action-btn" onClick={handleSignOut} style={{ fontSize: '11px', padding: '6px 12px' }}>
                    SIGN OUT
                  </button>
                </div>
              </div>
              {pendingCloudSave && (
                <div className="settings-row" style={{ flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                  <div className="settings-label" style={{ color: '#ffbb33' }}>
                    Cloud save found ({pendingCloudSave.savedAt.toDate().toLocaleString()})
                  </div>
                  <div className="settings-sublabel">Load it? Your local progress will be replaced.</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="action-btn" onClick={handleLoadCloudSave}>LOAD CLOUD SAVE</button>
                    <button className="action-btn" onClick={handleKeepLocal} style={{ fontSize: '11px', padding: '6px 12px' }}>KEEP LOCAL</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            // Anonymous — not yet signed in
            <div className="settings-row">
              <div>
                <div className="settings-label">Sync save across devices</div>
                <div className="settings-sublabel">Sign in to back up and restore your progress</div>
              </div>
              <button className="action-btn" onClick={() => setShowLoginModal(true)} disabled={authLoading}>
                SIGN IN
              </button>
            </div>
          )}
          {syncMsg && (
            <div className="settings-row">
              <div className="settings-sublabel" style={{ color: (syncMsg.includes('failed') || syncMsg.includes('Incorrect') || syncMsg.includes('No account') || syncMsg.includes('Invalid') || syncMsg.includes('already exists') || syncMsg.includes('must be') || syncMsg.includes('Could not')) ? '#ff5555' : '#33ff33' }}>
                {syncMsg}
              </div>
            </div>
          )}
        </Section>

        {eightbitUnlocked && (
          <Section bordered title="🕹 8-BIT MODE">
            <div className="settings-row">
              <div>
                <div className="settings-label">8-bit visual filter</div>
                <div className="settings-sublabel">Posterised palette + pixelated sprites</div>
              </div>
              <div className="settings-toggle" onClick={handleEightbitToggle}>
                <div className={`settings-toggle-track${eightbitOn ? ' settings-toggle-track--on' : ''}`}>
                  <div className="settings-toggle-thumb" />
                </div>
              </div>
            </div>
          </Section>
        )}

        <Section bordered title="DISPLAY">
          <div className="settings-row">
            <div>
              <div className="settings-label">Light mode</div>
              <div className="settings-sublabel">Switch to a light parchment background</div>
            </div>
            <div className="settings-toggle" onClick={handleLightModeToggle}>
              <div className={`settings-toggle-track${lightModeOn ? ' settings-toggle-track--on' : ''}`}>
                <div className="settings-toggle-thumb" />
              </div>
            </div>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-label">Text size</div>
              <div className="settings-sublabel">{textSize}px</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="range"
                className="settings-slider"
                min={11}
                max={18}
                step={1}
                value={textSize}
                onChange={e => handleSizeChange(Number(e.target.value))}
              />
              <span className="settings-value">{textSize}px</span>
            </div>
          </div>
          <div className="settings-row" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div className="settings-label">Text colour</div>
              <div className="settings-sublabel">Choose a terminal palette</div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
          </div>
        </Section>

        <Section bordered title="GAME DATA">
          <div className="settings-row">
            <div>
              <div className="settings-label">Reset all progress</div>
              <div className="settings-sublabel">Clears collection, deck, crystals, campaign and stats</div>
            </div>
          </div>
          <div className="settings-row">
            {confirmReset ? (
              <div className="settings-confirm-row">
                <span className="settings-confirm-msg">Are you sure? This cannot be undone.</span>
                <button className="action-btn action-btn--danger settings-danger-btn" onClick={handleReset}>CONFIRM RESET</button>
                <button className="action-btn" onClick={() => setConfirmReset(false)} style={{ fontSize: '11px', padding: '6px 12px' }}>CANCEL</button>
              </div>
            ) : (
              <button className="action-btn action-btn--danger settings-danger-btn" onClick={handleReset}>
                RESET GAME
              </button>
            )}
          </div>
        </Section>

        {isDebugMode && (
    
        )}

        {user?.uid === GIFT_OWNER_UID && (onGiftAdmin || onNewsAdmin) && (
<>
      <Section bordered title="DEBUG">
            <div className="settings-row">
              <div>
                <div className="settings-label">Export save data</div>
                <div className="settings-sublabel">Download all localStorage as a JSON file</div>
              </div>
              <button className="action-btn" onClick={exportLocalStorage}>EXPORT</button>
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-label">Import save data</div>
                <div className="settings-sublabel">Load a previously exported JSON save file</div>
              </div>
              <button className="action-btn" onClick={() => importRef.current?.click()}>IMPORT</button>
              <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
            </div>
            {importMsg && (
              <div className="settings-row">
                <div className="settings-sublabel" style={{ color: importMsg.startsWith('Error') ? '#ff5555' : '#33ff33' }}>
                  {importMsg}
                </div>
              </div>
            )}
            <div className="settings-row">
              <div>
                <div className="settings-label">Rollbar: send info</div>
                <div className="settings-sublabel">Send a test info event to Rollbar</div>
              </div>
              <button className="action-btn" onClick={handleRollbarTest}>SEND INFO</button>
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-label">Rollbar: trigger error</div>
                <div className="settings-sublabel">Throw an intentional error for Rollbar to capture</div>
              </div>
              <button className="action-btn action-btn--danger" onClick={handleRollbarError}>TRIGGER ERROR</button>
            </div>
            {rollbarMsg && (
              <div className="settings-row">
                <div className="settings-sublabel" style={{ color: '#33ff33' }}>
                  {rollbarMsg}
                </div>
              </div>
            )}
          </Section>
          <Section bordered title="ADMIN">
            {onGiftAdmin && (
              <div className="settings-row">
                <div>
                  <div className="settings-label">Gift management</div>
                  <div className="settings-sublabel">Create and delete one-off player gifts</div>
                </div>
                <button className="action-btn action-btn--gold" onClick={onGiftAdmin}>OPEN</button>
              </div>
            )}
            {onNewsAdmin && (
              <div className="settings-row">
                <div>
                  <div className="settings-label">News / What's New</div>
                  <div className="settings-sublabel">Post new feature announcements and patch notes</div>
                </div>
                <button className="action-btn action-btn--gold" onClick={onNewsAdmin}>OPEN</button>
              </div>
            )}
          </Section>
</>
        )}

        {isDevMode() && onDevCrystalsChanged && onDevHandicapChanged && (
          <DevMenu
            onCrystalsChanged={onDevCrystalsChanged}
            onHandicapChanged={onDevHandicapChanged}
          />
        )}

        <Section bordered title="ABOUT">
          <div className="settings-row">
            <div>
              <div className="settings-label">Jarv's Amazing Web Game</div>
              <div className="settings-sublabel">A browser-based strategy card game</div>
            </div>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-label">Build</div>
              <div className="settings-sublabel">{new Date(__BUILD_DATE__).toLocaleString()}</div>
            </div>
          </div>
          {(() => {
            const { totalMs, battleMs } = loadPlaytime()
            return (
              <>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Time in game</div>
                    <div className="settings-sublabel">{formatPlaytime(totalMs)}</div>
                  </div>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Time in battle</div>
                    <div className="settings-sublabel">{formatPlaytime(battleMs)}</div>
                  </div>
                </div>
              </>
            )
          })()}
        </Section>
      </div>
      {showLoginModal && (
        <LoginModal
          user={user}
          authLoading={authLoading}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={({ pendingCloudSave, lastSync: newSync, message }) => {
            setShowLoginModal(false)
            if (pendingCloudSave) setPendingCloudSave(pendingCloudSave)
            if (newSync) setLastSync(newSync)
            if (message) setSyncMsg(message)
          }}
        />
      )}
    </OverlayScreen>
  )
}
