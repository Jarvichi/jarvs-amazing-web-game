import React from 'react'
import type { RawMapConfig, RawNpc } from '../mapEditorTypes'
import type { QuestDefsJson } from '../../../data/hub/hubWorldFactory'

interface Props {
  configData: RawMapConfig
  questDefsData: QuestDefsJson
  onUpdateNpc: (index: number, partial: Partial<RawNpc>) => void
  onQuestDefsChange: (updater: (prev: QuestDefsJson) => QuestDefsJson) => void
}

export function QuestEditor(_props: Props) {
  return <div style={{ padding: 16, color: '#666' }}>Quest editor — coming soon</div>
}
