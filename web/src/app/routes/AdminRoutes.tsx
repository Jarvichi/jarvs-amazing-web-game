import { useApp } from '../AppContext'
import {
  GiftAdminScreen, NewsScreen, NewsAdminScreen, CampaignAdminScreen,
  FeedbackAdminScreen, TownAccessAdminScreen, SceneryAdminScreen,
} from '../lazyScreens'
import { savePreviewAsPlayer } from '../../game/townAccess'

/**
 * Admin and news screens. Reached from Settings (and, for news, from the title
 * screen — which is why `news` returns to `returnScreen` rather than settings).
 */
export function AdminRoutes() {
  const {
    screen, setScreen, returnScreen, setNewsUnreadCount,
    previewAsPlayer, setPreviewAsPlayer,
  } = useApp()

  return (
    <>
      {screen === 'giftAdmin' && (
        <GiftAdminScreen onBack={() => setScreen('settings')} />
      )}

      {screen === 'news' && (
        <NewsScreen onBack={() => { setNewsUnreadCount(0); setScreen(returnScreen) }} />
      )}

      {screen === 'newsAdmin' && (
        <NewsAdminScreen onBack={() => setScreen('settings')} />
      )}

      {screen === 'campaignAdmin' && (
        <CampaignAdminScreen onBack={() => setScreen('settings')} />
      )}

      {screen === 'feedbackAdmin' && (
        <FeedbackAdminScreen onBack={() => setScreen('settings')} />
      )}

      {screen === 'townAccessAdmin' && (
        <TownAccessAdminScreen
          onBack={() => setScreen('settings')}
          previewAsPlayer={previewAsPlayer}
          onTogglePreviewAsPlayer={() => {
            const next = !previewAsPlayer
            savePreviewAsPlayer(next)
            setPreviewAsPlayer(next)
          }}
        />
      )}

      {screen === 'sceneryPreview' && (
        <SceneryAdminScreen onBack={() => setScreen('settings')} />
      )}
    </>
  )
}
