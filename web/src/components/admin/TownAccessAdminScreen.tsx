import React, { useState, useEffect } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Section } from '../ui/Section'
import {
  ALWAYS_OPEN_LOCATION_IDS, TOGGLEABLE_LOCATIONS,
  fetchEnabledTownIds, saveEnabledTownIds,
} from '../../game/townAccess'

interface Props {
  onBack: () => void
  previewAsPlayer: boolean
  onTogglePreviewAsPlayer: () => void
}

export function TownAccessAdminScreen({ onBack, previewAsPlayer, onTogglePreviewAsPlayer }: Props) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    fetchEnabledTownIds().then(ids => { setEnabled(new Set(ids)); setLoading(false) })
  }, [])

  async function toggle(id: string) {
    const next = new Set(enabled)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setEnabled(next)
    setStatus(null)
    try {
      await saveEnabledTownIds(Array.from(next))
    } catch (e) {
      setStatus(`Error: ${String(e)}`)
    }
  }

  return (
    <OverlayScreen title="TOWN ACCESS" onBack={onBack}>
      <Section bordered title="Preview">
        <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
          <div>
            <div className="settings-label">Preview as player</div>
            <div className="settings-sublabel">
              See the world map fogged over exactly like a non-admin player would.
              Come back here (or Settings) to turn it back off.
            </div>
          </div>
          <div
            className="settings-toggle u-flex u-items-c u-gap-3 u-pointer u-no-select"
            onClick={onTogglePreviewAsPlayer}
          >
            <div className={`settings-toggle-track${previewAsPlayer ? ' settings-toggle-track--on' : ''}`}>
              <div className="settings-toggle-thumb" />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Always Open">
        <div className="settings-sublabel" style={{ marginBottom: '6px' }}>
          These towns are reachable by every player and cannot be locked.
        </div>
        {ALWAYS_OPEN_LOCATION_IDS.map(id => (
          <div key={id} className="settings-row u-flex u-items-c u-just-sb u-gap-7">
            <div className="settings-label">{id === 'ravenwatch' ? 'Ravenwatch' : id === 'millhaven' ? 'Millhaven' : id}</div>
          </div>
        ))}
      </Section>

      <Section bordered title="Toggleable Towns">
        <div className="settings-sublabel" style={{ marginBottom: '6px' }}>
          Locked towns are unreachable for regular players — on the world map and via
          in-town exits — until enabled here. Your admin account always has full access,
          unless "Preview as player" above is on.
        </div>
        {loading && <div className="settings-sublabel">Loading…</div>}
        {!loading && TOGGLEABLE_LOCATIONS.map(({ id, label }) => {
          const on = enabled.has(id)
          return (
            <div key={id} className="settings-row u-flex u-items-c u-just-sb u-gap-7">
              <div className="settings-label">{label}</div>
              <div
                className="settings-toggle u-flex u-items-c u-gap-3 u-pointer u-no-select"
                onClick={() => toggle(id)}
              >
                <div className={`settings-toggle-track${on ? ' settings-toggle-track--on' : ''}`}>
                  <div className="settings-toggle-thumb" />
                </div>
              </div>
            </div>
          )
        })}
        {status && (
          <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
            <div className="settings-sublabel" style={{ color: '#ff5555' }}>{status}</div>
          </div>
        )}
      </Section>
    </OverlayScreen>
  )
}
