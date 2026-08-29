import React, { useState } from 'react'
import { isHapticsSupported, isHapticsEnabled, setHapticsEnabled } from '../../../game/haptics'
import { SettingsRow } from './SettingsRow'
import { SettingsToggle } from './SettingsToggle'
import { SettingsSlider } from './SettingsSlider'
import {
  loadBattlePopups, saveBattlePopups,
  loadTextSize, saveTextSize,
  loadTextColor, saveTextColor,
  loadMonochromeEnabled, saveMonochromeEnabled, applyMonochromeMode,
  load8bitUnlocked, load8bitEnabled, save8bitEnabled, apply8bitMode,
  TEXT_COLOR_PRESETS,
} from './settingsStorage'

/**
 * Everything that changes how the game looks or feels.
 *
 * 8-bit mode, monochrome mode and haptics each used to be their own
 * top-level section wrapping a single toggle; they are rows here. Both
 * conditional rows keep their original guards, and the tab itself is always
 * shown, so it never renders empty.
 */
export function DisplayTab() {
  const [battlePopups, setBattlePopups] = useState(loadBattlePopups)
  const [textSize,     setTextSize]     = useState(loadTextSize)
  const [textColor,    setTextColor]    = useState(loadTextColor)
  const [monochromeOn, setMonochromeOn] = useState(loadMonochromeEnabled)
  const [eightbitOn,   setEightbitOn]   = useState(load8bitEnabled)
  const [eightbitUnlocked]              = useState(load8bitUnlocked)
  const [hapticsOn,    setHapticsOn]    = useState(isHapticsEnabled)

  function handleSizeChange(val: number) {
    setTextSize(val)
    saveTextSize(val)
    document.documentElement.style.setProperty('--game-font-size', `${val}px`)
  }

  function handleColorChange(val: string) {
    setTextColor(val)
    saveTextColor(val)
    document.documentElement.style.setProperty('--game-text-color', val)
  }

  return (
    <>
      <SettingsRow
        label="Battle event popups"
        sublabel="Show mid-battle popups for notable events (e.g. hero summons)"
      >
        <SettingsToggle
          checked={battlePopups}
          onChange={() => { const next = !battlePopups; setBattlePopups(next); saveBattlePopups(next) }}
          label="Battle event popups"
        />
      </SettingsRow>

      <SettingsRow label="Text size" sublabel="Base font size for all game text">
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
              className={`filter-btn settings-swatch${textColor === p.value ? ' filter-btn--active' : ''}`}
              style={{ '--swatch': p.value } as React.CSSProperties}
              aria-pressed={textColor === p.value}
              onClick={() => handleColorChange(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </SettingsRow>

      <SettingsRow label="Monochrome visual filter" sublabel="Green and black terminal-style palette">
        <SettingsToggle
          checked={monochromeOn}
          onChange={() => {
            const next = !monochromeOn
            setMonochromeOn(next)
            saveMonochromeEnabled(next)
            applyMonochromeMode(next)
          }}
          label="Monochrome visual filter"
        />
      </SettingsRow>

      {eightbitUnlocked && (
        <SettingsRow label="8-bit visual filter" sublabel="Posterised palette + pixelated sprites">
          <SettingsToggle
            checked={eightbitOn}
            onChange={() => {
              const next = !eightbitOn
              setEightbitOn(next)
              save8bitEnabled(next)
              apply8bitMode(next)
            }}
            label="8-bit visual filter"
          />
        </SettingsRow>
      )}

      {/* Hidden entirely rather than shown-but-inert on iOS Safari (no
          Vibration API) — a toggle that visibly does nothing is worse
          than no toggle, same call as retiring light mode (#2184). */}
      {isHapticsSupported() && (
        <SettingsRow label="Vibration" sublabel="Short pulses for card plays, hits, and wins/losses">
          <SettingsToggle
            checked={hapticsOn}
            onChange={() => { const next = !hapticsOn; setHapticsOn(next); setHapticsEnabled(next) }}
            label="Vibration"
          />
        </SettingsRow>
      )}
    </>
  )
}
