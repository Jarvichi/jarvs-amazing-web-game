import { useApp } from '../AppContext'
import { HubWorld, HubWorldMap, CasinoScreen, TheatreScreen, MiniGamesMenu, Fishing, Wellspring, CaskSounding, Stowage, FishAppraisalScreen } from '../lazyScreens'
import { OverlayScreen } from '../../components/ui/OverlayScreen'
import { loadCrystals, saveCrystals } from '../../game/collection'
import { addHubItem } from '../../game/itemStore'
import { addTownReputation } from '../../game/hub/reputation'
import { incrementAchievementProgress } from '../../game/achievements'
import { recordRestore } from '../../game/hub/wellsprings'
import { recordSort } from '../../game/hub/casks'
import { recordPack } from '../../game/hub/stowages'
import { loadPlayerName } from '../../game/questline'
import { isNodeCleared } from '../../game/world/worldState'
import { auth } from '../../firebase'
import { WELLSPRING_SCORING } from '../../components/minigames/Wellspring.logic'
import { CASK_SCORING } from '../../components/minigames/CaskSounding.logic'
import { STOWAGE_SCORING } from '../../components/minigames/Stowage.logic'
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
    goToWorldLocation, handleWorldBattle, handleStartWandererBattle,
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
          onWandererBattle={() => { setReturnScreen('hubworld'); handleStartWandererBattle() }}
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

      {screen === 'hub-fish-appraisal' && (
        <FishAppraisalScreen
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
          locationRegistry={hubData.locationRegistry}
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

      {/* Pond-locale fishing spots (#2148/#2153) — same rod/bait gate as
          hub-fishing (checked in HubWorld's handleNodeInteract via a
          startsWith('hub-fishing') check), but each a locale-exclusive
          catch table (Fishing.tsx's variant prop). 'cave' = the underground
          lake, 'lake' = a town's open still-water pond, 'ocean' = a
          harbour/coastal spot. */}
      {screen === 'hub-fishing-cave' && (
        <OverlayScreen title="🎣 FISHING" onBack={() => setScreen('hubworld')}>
          <Fishing rewardMode="catch" variant="cave" onDone={() => setScreen('hubworld')} />
        </OverlayScreen>
      )}
      {screen === 'hub-fishing-lake' && (
        <OverlayScreen title="🎣 FISHING" onBack={() => setScreen('hubworld')}>
          <Fishing rewardMode="catch" variant="lake" onDone={() => setScreen('hubworld')} />
        </OverlayScreen>
      )}
      {screen === 'hub-fishing-ocean' && (
        <OverlayScreen title="🎣 FISHING" onBack={() => setScreen('hubworld')}>
          <Fishing rewardMode="catch" variant="ocean" onDone={() => setScreen('hubworld')} />
        </OverlayScreen>
      )}

      {/* Hub-world wellspring: the town well. Gated on the winding crank and a
          once-a-day-per-town cooldown (both checked in HubWorld's
          handleNodeInteract), and paid in crystals, clean water and town
          standing rather than arcade tickets. Depth is authored per town via
          the screen id, exactly as fishing carries its locale variants. */}
      {(screen === 'hub-wellspring' || screen === 'hub-wellspring-deep' || screen === 'hub-wellspring-vault') && (
        <OverlayScreen title="💧 WELLSPRING" onBack={() => setScreen('hubworld')}>
          <Wellspring
            depth={screen === 'hub-wellspring-vault' ? 'vault' : screen === 'hub-wellspring-deep' ? 'deep' : 'shallow'}
            onDone={(result) => {
              const town = hubData?.locationRegistry[currentLocationKey]?.locationData.HUB_TOWN_NAME
              if (town) {
                recordRestore(town)
                addTownReputation(town, WELLSPRING_SCORING.reputation)
              }
              addHubItem('clean-water', result.cleanWater)
              const next = loadCrystals() + result.crystals
              saveCrystals(next)
              setCrystals(next)
              incrementAchievementProgress('hub:wellspring:restorations')
              if (result.underPar) incrementAchievementProgress('hub:wellspring:underParSolves')
              if (result.depthId === 'vault') incrementAchievementProgress('hub:wellspring:vaultSolves')
              setScreen('hubworld')
            }}
          />
        </OverlayScreen>
      )}

      {/* Hub-world cellar: a town's casks. Gated on the cooper's mallet and a
          once-a-day-per-town cooldown (both checked in HubWorld's
          handleNodeInteract), and paid in crystals, cask vinegar and town
          standing rather than arcade tickets. The tier is authored per town via
          the screen id, exactly as fishing carries its locale variants. */}
      {(screen === 'hub-casks' || screen === 'hub-casks-cellar' || screen === 'hub-casks-vault') && (
        <OverlayScreen title="🛢️ CASK SOUNDING" onBack={() => setScreen('hubworld')}>
          <CaskSounding
            tier={screen === 'hub-casks-vault' ? 'vault' : screen === 'hub-casks-cellar' ? 'cellar' : 'taproom'}
            onDone={(result) => {
              const town = hubData?.locationRegistry[currentLocationKey]?.locationData.HUB_TOWN_NAME
              if (town) {
                recordSort(town)
                addTownReputation(town, CASK_SCORING.reputation)
              }
              addHubItem('cask-vinegar', result.vinegar)
              const next = loadCrystals() + result.crystals
              saveCrystals(next)
              setCrystals(next)
              incrementAchievementProgress('hub:casks:sorted')
              if (result.underPar) incrementAchievementProgress('hub:casks:underParSorts')
              if (result.misread === 0) incrementAchievementProgress('hub:casks:cleanSorts')
              if (result.tierId === 'vault') incrementAchievementProgress('hub:casks:vaultSorts')
              setScreen('hubworld')
            }}
          />
        </OverlayScreen>
      )}

      {/* Hub-world crate: a town's outgoing load. Gated on the stevedore's hook
          and a once-a-day-per-town cooldown (both checked in HubWorld's
          handleNodeInteract), and paid in crystals, barrelled salt and town
          standing rather than arcade tickets. The tier is authored per town via
          the screen id, exactly as fishing carries its locale variants. */}
      {(screen === 'hub-stowage' || screen === 'hub-stowage-wagon' || screen === 'hub-stowage-hold') && (
        <OverlayScreen title="📦 STOWAGE" onBack={() => setScreen('hubworld')}>
          <Stowage
            tier={screen === 'hub-stowage-hold' ? 'hold' : screen === 'hub-stowage-wagon' ? 'wagon' : 'handcart'}
            onDone={(result) => {
              const town = hubData?.locationRegistry[currentLocationKey]?.locationData.HUB_TOWN_NAME
              if (town) {
                recordPack(town)
                addTownReputation(town, STOWAGE_SCORING.reputation)
              }
              addHubItem('barrelled-salt', result.salt)
              const next = loadCrystals() + result.crystals
              saveCrystals(next)
              setCrystals(next)
              incrementAchievementProgress('hub:stowage:packed')
              if (result.cleanStow) incrementAchievementProgress('hub:stowage:cleanStows')
              if (result.manifested === 0) incrementAchievementProgress('hub:stowage:unaidedPacks')
              if (result.tierId === 'hold') incrementAchievementProgress('hub:stowage:holdPacks')
              setScreen('hubworld')
            }}
          />
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
