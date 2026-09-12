import React, { useState } from 'react'
import { getRelicDef } from '../../game/relics'
import { NodeScreen } from './node/NodeScreen'
import { ChoiceCard } from './node/ChoiceCard'
import { Button } from '../ui/Button'

interface Props {
  earnedRelics: string[]        // names of all usable relics the player has collected
  currentRelic: string | null   // currently equipped relic (if resuming)
  brokenRelic?: { name: string; icon: string } | null  // relic that just broke this act
  onSelect: (relicName: string | null) => void
}

export function RelicSelectScreen({ earnedRelics, currentRelic, brokenRelic, onSelect }: Props) {
  const [picked, setPicked] = useState<string | null>(
    earnedRelics.includes(currentRelic ?? '') ? currentRelic : (earnedRelics[0] ?? null)
  )

  const defs = earnedRelics.map(name => ({ name, def: getRelicDef(name) })).filter(r => r.def)

  return (
    <NodeScreen
      title="CHOOSE YOUR RELIC"
      actions={
        <Button size="lg" className="relic-select-confirm" onClick={() => onSelect(picked)}>
          {picked ? `EQUIP ${getRelicDef(picked)?.name ?? picked}` : 'ENTER WITHOUT RELIC'} →
        </Button>
      }
    >
      {brokenRelic && (
        <div className="relic-broken-notice">
          <span className="relic-broken-icon">{brokenRelic.icon}</span>
          <div className="relic-broken-text">
            <strong>{brokenRelic.name}</strong> shattered at the end of this act.
            <br />It has been added to your inventory as a broken relic.
          </div>
        </div>
      )}

      <div className="relic-select-header u-text-c">
        <div className="relic-select-subtitle">
          One relic may be equipped per run. Its effect applies at the start of every battle.
        </div>
      </div>

      <div className="relic-select-grid u-col u-gap-5">
        {defs.map(({ name, def }, i) => (
          <ChoiceCard
            key={name}
            icon={def!.icon}
            name={def!.name}
            desc={def!.desc}
            chosen={picked === name}
            exotic={def!.exotic}
            style={{ animationDelay: `${i * 60}ms` }}
            onClick={() => setPicked(name)}
          />
        ))}

        <ChoiceCard
          icon="✕"
          name="No Relic"
          desc="Enter without a relic. Face the shard on your own merits."
          chosen={picked === null}
          className="relic-select-card--none"
          style={{ animationDelay: `${defs.length * 60}ms` }}
          onClick={() => setPicked(null)}
        />
      </div>
    </NodeScreen>
  )
}
