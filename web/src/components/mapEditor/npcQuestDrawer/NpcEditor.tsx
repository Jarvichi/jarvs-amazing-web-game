import React from 'react'
import type { RawMapConfig, RawNpc } from '../mapEditorTypes'
import type { QuestDefsJson } from '../../../data/hub/hubWorldFactory'

interface Props {
  configData: RawMapConfig
  questDefsData: QuestDefsJson
  focusedIndex: number | null
  onUpdateNpc: (index: number, partial: Partial<RawNpc>) => void
}

export function NpcEditor(_props: Props) {
  return <div style={{ padding: 16, color: '#666' }}>NPC editor — coming soon</div>
}
