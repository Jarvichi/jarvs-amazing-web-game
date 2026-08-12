import { useApp } from '../AppContext'
import { HubWorld, HubWorldMap, CasinoScreen, TheatreScreen, MiniGamesMenu, Fishing } from '../lazyScreens'
import { OverlayScreen } from '../../components/ui/OverlayScreen'
import { saveCrystals } from '../../game/collection'
import { loadPlayerName } from '../../game/questline'
import { isNodeCleared } from '../../game/world/worldState'
import { auth } from '../../firebase'
import type { Screen, SubScreen } from '../screens'

/**
 * Hub world, world map, and the hub's leisure screens.
 *
 * `hubworld` and `location` are one HubWorld render — the town is chosen by
 * currentLocationKey, not by the screen — and both are gated on hubData, which
 * is lazily fetched (~1.5MB) only once the player heads for the hub.
 */
export function HubRoutes() {
  const {
    screen, setScreen, returnScreen, setReturnScreen, crystals, setCrystals,
    user, commander, isAdmin, previewAsPlayer, restrictedTownNodeIds,
    hubData, currentLocationKey, worldMapKey,
    miniGamesEntry, setMiniGamesEntry, hubMiniGameEntry, setHubMiniGameEntry,
    setShopBuildingId, setShopTappedNpc, setShowTitleLoginModal, setFeedbackOpen,
    setActiveNarratorLog,
    handleCampaign, handleCampaign2, handleEndless, handleBuyCrystalPack,
    goToWorldLocation, handleWorldBattle,
  } = useApp()

  return (
    <>
      {(screen === 'hubworld' || screen === 'location') && hubData && (
        <HubWorld
          onBack={() => setScreen('settings')}
          onNavigate={(s, buildingId, npc) => {
            setReturnScreen('hubworld')
            setShopBuildingId(buildingId)
            setShopTappedNpc(npc)
            const HUB_MINIGAME_IDS: SubScreen[] = ['marble', 'tileflip', 'crystalcatch', 'spinner', 'marblerace', 'regatta', 'higherOrLower', 'fruitMachine', 'videoPoker', 'fishing', 'towerDefence', 'citybuilder', 'prizes']
            if (HUB_MINIGAME_IDS.includes(s as SubScreen)) {
              setHubMiniGameEntry(s as SubScreen)
              setScreen('hub-minigame')
            } else {
              setScreen(s as Screen)
            }
          }}
          onCampaign={() => { setReturnScreen('hubworld'); handleCampaign() }}
          onCampaign2={() => { setReturnScreen('hubworld'); handleCampaign2() }}
          onEndless={() => { setReturnScreen('hubworld'); handleEndless() }}
          onWorldMap={() => setScreen('worldmap')}
          onNavigateTown={goToWorldLocation}
          onNarratorLog={(characterId) => { setReturnScreen('hubworld'); setActiveNarratorLog(characterId); setScreen('narratorJournal') }}
          onPlayerTap={() => { setReturnScreen('hubworld'); setScreen('player') }}
          crystals={crystals}
          user={user}
          commander={commander ?? undefined}

          locationData={hubData.locationRegistry[currentLocationKey].locationData}
          locationQuests={hubData.locationRegistry[currentLocationKey].locationQuests}
          questDefs={hubData.locationRegistry[currentLocationKey].questDefs}
          allQuestDefs={hubData.allQuestDefs}
          locationRegistry={hubData.locationRegistry}
          allQuests={hubData.allQuests}
          friendshipDialogue={hubData.friendshipDialogue}
          relationshipDialogue={hubData.relationshipDialogue}

          isSignedIn={user != null && !user.isAnonymous}
          onSignIn={() => setShowTitleLoginModal(true)}
          onSignOut={() => { import('firebase/auth').then(({ signOut }) => signOut(auth)) }}
          onFeedback={() => setFeedbackOpen(true)}
          onCrystalsChange={(n) => setCrystals(n)}
          onBuyCrystalPack={(qty) => handleBuyCrystalPack(qty, 'hubworld')}
        />
      )}

      {screen === 'casino' && (
        <CasinoScreen
          crystals={crystals}
          onCrystalsChange={(n) => { saveCrystals(n); setCrystals(n) }}
          onBack={() => setScreen('hubworld')}
        />
      )}

      {screen === 'worldmap' && hubData && (
        <HubWorldMap
          key={worldMapKey}
          onSelectNode={(node) => {
            if (node.id === 'ravenwatch' || (node.locationKey && hubData.locationRegistry[node.locationKey])) {
              goToWorldLocation(node.id === 'ravenwatch' ? node.id : node.locationKey!)
            } else if (node.type === 'battle') {
              if (!isNodeCleared(node.id)) {
                handleWorldBattle(node)
              }
            }
          }}
          onBack={() => setScreen('hubworld')}
          user={user}
          onSignIn={() => setShowTitleLoginModal(true)}
          onSignOut={() => { import('firebase/auth').then(({ signOut }) => signOut(auth)) }}
          onPlayerTap={() => { setReturnScreen('hubworld'); setScreen('player') }}
          onFeedback={() => setFeedbackOpen(true)}
          restrictedNodeIds={restrictedTownNodeIds}
          previewingAsPlayer={isAdmin && previewAsPlayer}
          allQuestDefs={hubData.allQuestDefs}
        />
      )}

      {screen === 'minigames' && (
        <MiniGamesMenu
          crystals={crystals}
          onCrystalsChange={(n) => { saveCrystals(n); setCrystals(n) }}
          user={user}
          characterName={loadPlayerName()}
          onBack={() => { setMiniGamesEntry('menu'); setScreen(returnScreen) }}
          initialSubScreen={miniGamesEntry}
        />
      )}

      {screen === 'hub-minigame' && (
        <MiniGamesMenu
          crystals={crystals}
          onCrystalsChange={(n) => { saveCrystals(n); setCrystals(n) }}
          user={user}
          characterName={loadPlayerName()}
          onBack={() => setScreen('hubworld')}
          onGameDone={() => setScreen('hubworld')}
          initialSubScreen={hubMiniGameEntry}
        />
      )}

      {/* Hub-world fishing: item-gated (rod + bait, checked in HubWorld's
          handleNodeInteract) and rewards the caught fish as a hub-item
          instead of arcade tickets — see docs/hubworld.md. */}
      {screen === 'hub-fishing' && (
        <OverlayScreen title="🎣 FISHING" onBack={() => setScreen('hubworld')}>
          <Fishing rewardMode="catch" onDone={() => setScreen('hubworld')} />
        </OverlayScreen>
      )}

      {/* The underground lake's fishing spot — same rod/bait gate as
          hub-fishing (checked in HubWorld's handleNodeInteract), but a
          cave-exclusive catch table (Fishing.tsx's variant prop). */}
      {screen === 'hub-fishing-cave' && (
        <OverlayScreen title="🎣 FISHING" onBack={() => setScreen('hubworld')}>
          <Fishing rewardMode="catch" variant="cave" onDone={() => setScreen('hubworld')} />
        </OverlayScreen>
      )}

      {screen === 'theatre' && (
        <OverlayScreen title="🎭 CROWN THEATRE" onBack={() => setScreen('hubworld')}>
          <TheatreScreen onBack={() => setScreen('hubworld')} />
        </OverlayScreen>
      )}
    </>
  )
}
