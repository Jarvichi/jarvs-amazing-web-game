import React from 'react'
import type { DrawerTab } from './npcQuestDrawerTypes'
import type { RawMapConfig, RawNpc } from '../mapEditorTypes'
import type { QuestDefsJson } from '../../../data/hub/hubWorldFactory'
import { NpcEditor } from './NpcEditor'
import { QuestEditor } from './QuestEditor'

interface Props {
  tab: DrawerTab
  focusedNpcIndex: number | null
  configData: RawMapConfig
  questDefsData: QuestDefsJson
  onTabChange: (tab: DrawerTab) => void
  onAddNpc: (npc: RawNpc) => void
  onUpdateNpc: (index: number, partial: Partial<RawNpc>) => void
  onQuestDefsChange: (updater: (prev: QuestDefsJson) => QuestDefsJson) => void
}

const TAB_ACTIVE: React.CSSProperties = {
  padding: '6px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 'bold',
  background: 'transparent', border: 'none', borderBottom: '2px solid #8af', color: '#8af',
}
const TAB_INACTIVE: React.CSSProperties = {
  padding: '6px 16px', cursor: 'pointer', fontSize: 12,
  background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: '#666',
}

export function NpcQuestDrawer({
  tab, focusedNpcIndex, configData, questDefsData,
  onTabChange, onAddNpc, onUpdateNpc, onQuestDefsChange,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#12122a', borderTop: '1px solid #333' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #333', flexShrink: 0, padding: '0 8px', background: '#0f0f22' }}>
        <button style={tab === 'npcs' ? TAB_ACTIVE : TAB_INACTIVE} onClick={() => onTabChange('npcs')}>
          NPCs
        </button>
        <button style={tab === 'quests' ? TAB_ACTIVE : TAB_INACTIVE} onClick={() => onTabChange('quests')}>
          Quests
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {tab === 'npcs' && (
          <NpcEditor
            configData={configData}
            questDefsData={questDefsData}
            focusedIndex={focusedNpcIndex}
            onAddNpc={onAddNpc}
            onUpdateNpc={onUpdateNpc}
          />
        )}
        {tab === 'quests' && (
          <QuestEditor
            configData={configData}
            questDefsData={questDefsData}
            onUpdateNpc={onUpdateNpc}
            onQuestDefsChange={onQuestDefsChange}
          />
        )}
      </div>
    </div>
  )
}
