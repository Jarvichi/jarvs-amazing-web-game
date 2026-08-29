import { useState } from 'react'
import {
  isSoundEnabled, setSoundEnabled,
  getSoundVolume, setSoundVolume,
  getMusicVolume, setMusicVolume,
} from '../../../game/sound'
import { SettingsRow } from './SettingsRow'
import { SettingsToggle } from './SettingsToggle'
import { SettingsSlider } from './SettingsSlider'

/**
 * Audio settings. Owns its own state — nothing outside the settings screen
 * reads these values, they are written straight through to the sound module.
 */
export function AudioTab() {
  const [soundOn,     setSoundOn]          = useState(isSoundEnabled)
  const [soundVolume, setSoundVolumeState] = useState(getSoundVolume)
  const [musicVolume, setMusicVolumeState] = useState(getMusicVolume)

  return (
    <>
      <SettingsRow label="Sound" sublabel="Procedurally generated audio">
        <SettingsToggle
          checked={soundOn}
          onChange={() => { const next = !soundOn; setSoundOn(next); setSoundEnabled(next) }}
          label="Sound"
        />
      </SettingsRow>

      <SettingsRow label="Effects" sublabel="In game sounds">
        <SettingsSlider
          value={soundVolume}
          onChange={val => { setSoundVolumeState(val); setSoundVolume(val) }}
          min={0} max={1} step={0.05}
          disabled={!soundOn}
          label="Effects volume"
          readout={`${Math.round(soundVolume * 100)}%`}
        />
      </SettingsRow>

      <SettingsRow label="Music" sublabel="Background music volume">
        <SettingsSlider
          value={musicVolume}
          onChange={val => { setMusicVolumeState(val); setMusicVolume(val) }}
          min={0} max={1} step={0.05}
          label="Music volume"
          readout={`${Math.round(musicVolume * 100)}%`}
        />
      </SettingsRow>
    </>
  )
}
