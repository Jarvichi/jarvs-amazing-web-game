import { useApp } from '../AppContext'
import {
  QuickBattleScreen, CardDraftScreen, DailyChallengeScreen, WeeklyChallengeScreen,
  CommanderScreen, TrainingScreen,
} from '../lazyScreens'
import { IntroScreen } from '../../components/title/IntroScreen'
import { TitleScreen } from '../../components/title/TitleScreen'
import { SettingsScreen } from '../../components/screens/SettingsScreen'
import { FeedbackModal } from '../../components/modals/FeedbackModal'
import { LoginModal } from '../../components/modals/LoginModal'
import {
  loadCollection, saveCollection, saveCrystals, generatePack, addCardsToCollection,
} from '../../game/collection'
import { getCardCatalog } from '../../game/cards'
import { loadCommander } from '../../game/commander'
import { isHubWorldUnlocked, loadHubDefault, saveHubDefault } from '../../game/codex'
import { HANDICAP_KEY } from '../../game/campaignHelpers'
import { auth } from '../../firebase'

/**
 * The screens a session starts from: intro, title, settings, and the entry
 * points for quick battle, draft, the daily/weekly challenges, the commander
 * screen and training.
 */
export function EntryRoutes() {
  const {
    screen, setScreen, returnScreen, crystals, setCrystals, setHandicap,
    user, authLoading, commander, setCommander,
    newsUnreadCount, feedbackOpen, setFeedbackOpen,
    showTitleLoginModal, setShowTitleLoginModal, setMiniGamesEntry,
    handleEndless, handleCampaign, handleDailyChallenge, handleWeeklyChallenge,
    handleEndlessLeaderboard, handlePlay, handleDraftComplete,
    handleStartDailyChallenge, handleStartWeeklyChallenge, handleStartTraining,
    handleResetGame, checkForUpdates,
  } = useApp()

  return (
    <>
      {screen === 'intro' && (
        <IntroScreen onDone={() => setScreen(isHubWorldUnlocked() && loadHubDefault() !== 'title' ? 'hubworld' : 'title')} />
      )}

      {screen === 'title' && (
        <>
          <TitleScreen
            crystals={crystals}
            onPlay={() => setScreen('quickbattle')}
            onEndless={handleEndless}
            onCampaign={handleCampaign}
            onCollection={() => setScreen('collection-tabs')}
            onShop={() => setScreen('shop')}
            onDeckBuilder={() => setScreen('deckbuilder')}
            onSettings={() => setScreen('settings')}
            onPlayer={() => setScreen('player')}
            on8bitUnlocked={() => { /* achievement granted in TitleScreen after unlock */ }}
            onDailyChallenge={handleDailyChallenge}
            onWeeklyChallenge={handleWeeklyChallenge}
            onEndlessLeaderboard={handleEndlessLeaderboard}
            onCommander={commander ? () => setScreen('commander') : undefined}
            commanderName={commander?.cardName ?? null}
            onTraining={() => setScreen('training')}
            onNews={() => setScreen('news')}
            hasUnreadNews={newsUnreadCount > 0}
            onMiniGames={() => setScreen('minigames')}
            onCityBuilder={() => { setMiniGamesEntry('citybuilder'); setScreen('minigames') }}
            onCodex={() => setScreen('codex')}
            onChronicle={() => setScreen('chronicle')}
            user={user}
            onSignOut={() => { import('firebase/auth').then(({ signOut }) => signOut(auth)) }}
            onSignIn={() => setShowTitleLoginModal(true)}
            onFeedback={() => setFeedbackOpen(true)}
            hubUnlocked={isHubWorldUnlocked() && loadHubDefault() === 'title'}
            onHub={() => { saveHubDefault('hub'); setScreen('hubworld') }}
          />
          {feedbackOpen && (
            <FeedbackModal user={user} onClose={() => setFeedbackOpen(false)} />
          )}
          {showTitleLoginModal && (
            <LoginModal
              user={user}
              authLoading={authLoading}
              onClose={() => setShowTitleLoginModal(false)}
              onLoginSuccess={() => { setShowTitleLoginModal(false) }}
            />
          )}
        </>
      )}

      {screen === 'settings' && (
        <SettingsScreen
          onBack={() => setScreen('title')}
          onResetGame={handleResetGame}
          user={user}
          authLoading={authLoading}
          onDevCrystalsChanged={n => setCrystals(n)}
          onDevHandicapChanged={n => {
            setHandicap(n)
            try { localStorage.setItem(HANDICAP_KEY, String(n)) } catch { /* ignore */ }
          }}
          onGiftAdmin={() => setScreen('giftAdmin')}
          onNewsAdmin={() => setScreen('newsAdmin')}
          onCampaignAdmin={() => setScreen('campaignAdmin')}
          onFeedbackAdmin={() => setScreen('feedbackAdmin')}
          onTownAccessAdmin={() => setScreen('townAccessAdmin')}
          onHubWorld={() => setScreen('hubworld')}
          onTitleScreen={() => setScreen('title')}
          onSceneryPreview={() => setScreen('sceneryPreview')}
          onCheckForUpdates={checkForUpdates}
        />
      )}

      {screen === 'quickbattle' && (
        <QuickBattleScreen onStartBattle={handlePlay} onBack={() => setScreen(returnScreen)} />
      )}

      {screen === 'carddraft' && (
        <CardDraftScreen onComplete={handleDraftComplete} onBack={() => setScreen(returnScreen)} />
      )}

      {screen === 'dailychallenge' && (
        <DailyChallengeScreen onStart={handleStartDailyChallenge} onBack={() => setScreen(returnScreen)} />
      )}

      {screen === 'weeklychallenge' && (
        <WeeklyChallengeScreen onStart={handleStartWeeklyChallenge} onBack={() => setScreen(returnScreen)} />
      )}

      {screen === 'commander' && commander && (
        <CommanderScreen
          commander={commander}
          onBack={() => { setCommander(loadCommander()); setScreen(returnScreen) }}
          onRewardXp={(cardName, amount) => {
            const col = loadCollection()
            const updated = col.map(e =>
              e.cardName === cardName ? { ...e, masteryXp: (e.masteryXp ?? 0) + amount } : e
            )
            saveCollection(updated)
          }}
          onRewardCrystals={(amount) => {
            const next = crystals + amount
            saveCrystals(next)
            setCrystals(next)
          }}
          onRewardCard={() => {
            const catalog = getCardCatalog()
            const picks = catalog.filter(c => c.unit && c.unit.moveSpeed > 0)
            const card = picks[Math.floor(Math.random() * picks.length)]
            if (card) addCardsToCollection([{ cardName: card.name, count: 1 }])
          }}
          onRewardPack={() => {
            const newPack = generatePack()
            addCardsToCollection(newPack.map(name => ({ cardName: name, count: 1 })))
          }}
          onCommanderChanged={(state) => {
            setCommander(state)
            if (!state) setScreen('title')
          }}
        />
      )}

      {screen === 'training' && (
        <TrainingScreen
          onBack={() => setScreen('title')}
          onStart={handleStartTraining}
        />
      )}
    </>
  )
}
