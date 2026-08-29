import { useState } from 'react'
import { type User } from 'firebase/auth'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Panel } from '../ui/Panel'
import { TabNav, type TabNavItem } from '../ui/TabNav'
import { type IconName } from '../ui/icons/IconSprite'
import { AudioTab } from './settings/AudioTab'
import { DisplayTab } from './settings/DisplayTab'
import { AccountTab } from './settings/AccountTab'
import { GameTab } from './settings/GameTab'
import { AboutTab } from './settings/AboutTab'
import { AdminTab, canSeeAdminTab } from './settings/AdminTab'

// Re-exported so App.tsx, TitleScreen, Battlefield and HubWorld keep importing
// these from the settings screen; the implementations moved to
// settings/settingsStorage.ts when this screen was split into tabs (#2165).
export {
  loadSkipIntro, saveSkipIntro,
  loadTextSize, loadTextColor,
  load8bitUnlocked, unlock8bitMode, load8bitEnabled, save8bitEnabled, apply8bitMode,
  clearLegacyLightMode,
  loadMonochromeEnabled, saveMonochromeEnabled, applyMonochromeMode,
  loadBattlePopups, saveBattlePopups,
  applyTextSettings,
} from './settings/settingsStorage'

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

type SettingsTab = 'audio' | 'display' | 'account' | 'game' | 'about' | 'admin'

const TAB_META: Record<SettingsTab, { label: string; icon: IconName }> = {
  audio:   { label: 'Audio',   icon: 'volume' },
  display: { label: 'Display', icon: 'display' },
  account: { label: 'Account', icon: 'player' },
  game:    { label: 'Game',    icon: 'database' },
  about:   { label: 'About',   icon: 'info' },
  admin:   { label: 'Admin',   icon: 'shield' },
}

/**
 * Settings, as six tabs rather than the fourteen stacked sections it grew
 * into (#2165). The tab components own their own persisted state; this shell
 * only routes between them and passes through the callbacks that come from
 * outside the screen.
 */
export function SettingsScreen(props: Props) {
  const { onBack, onResetGame, user, authLoading, onCheckForUpdates } = props
  const [tab, setTab] = useState<SettingsTab>('audio')

  const ids: SettingsTab[] = canSeeAdminTab(props)
    ? ['audio', 'display', 'account', 'game', 'about', 'admin']
    : ['audio', 'display', 'account', 'game', 'about']
  const items: TabNavItem<SettingsTab>[] = ids.map(id => ({ id, ...TAB_META[id] }))

  return (
    <OverlayScreen title="SETTINGS" onBack={onBack} className="settings-screen u-col u-grow">
      <div className="settings-tabs">
        <TabNav
          className="settings-tabs-inner"
          items={items}
          activeId={tab}
          onSelect={setTab}
          ariaLabel="Settings categories"
          panelId="settings-panel"
        />
      </div>

      <div
        className="settings-body u-col u-grow"
        id="settings-panel"
        role="tabpanel"
        aria-labelledby={`settings-panel-tab-${tab}`}
        tabIndex={0}
      >
        {tab === 'admin' ? (
          <AdminTab {...props} />
        ) : (
          <Panel elevation="raised" tone={tab === 'game' ? 'danger' : 'neutral'} runeCorners>
            <div className="settings-panel-title">{TAB_META[tab].label.toUpperCase()}</div>
            <div className="settings-rows">
              {tab === 'audio'   && <AudioTab />}
              {tab === 'display' && <DisplayTab />}
              {tab === 'account' && <AccountTab user={user} authLoading={authLoading} />}
              {tab === 'game'    && <GameTab onResetGame={onResetGame} />}
              {tab === 'about'   && <AboutTab onCheckForUpdates={onCheckForUpdates} />}
            </div>
          </Panel>
        )}
      </div>
    </OverlayScreen>
  )
}
