import React, { useMemo, useState } from 'react'
import { RunState } from '../../game/questline'
import { deriveBuildIdentity } from '../../game/buildIdentity'

/**
 * Read-only Build Identity display for the campaign node map.
 * Collapsed by default — a single themed line; expands to show the
 * archetype, equipped relic, and any synergy note.
 */
export function BuildIdentityPanel({ run }: { run: RunState }) {
  const [expanded, setExpanded] = useState(false)
  const identity = useMemo(() => deriveBuildIdentity(run), [run])

  if (!identity.archetypeName && !identity.relicName) return null

  return (
    <div className={`build-identity${expanded ? ' build-identity--expanded' : ''}`}>
      <button className="build-identity-toggle" onClick={() => setExpanded(v => !v)}>
        <span className="build-identity-theme">⚒ {identity.themeLabel}</span>
        <span className="build-identity-chevron">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="build-identity-body">
          {identity.archetypeName && (
            <div className="build-identity-row">
              {identity.archetypeIcon} {identity.archetypeName}
            </div>
          )}
          <div className="build-identity-row">
            {identity.relicName
              ? <>{identity.relicIcon} {identity.relicName}{identity.relicIsExotic && <span className="relic-exotic-tag" style={{ position: 'static', marginLeft: 6 }}>EXOTIC</span>}</>
              : <span className="build-identity-muted">No relic equipped</span>}
          </div>
          {identity.synergyNote && (
            <div className="build-identity-note">{identity.synergyNote}</div>
          )}
        </div>
      )}
    </div>
  )
}
