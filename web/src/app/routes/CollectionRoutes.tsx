import { useApp } from '../AppContext'
import {
  PlayerScreen, CollectionTabScreen, CollectionScreen, AugmentCollectionScreen,
  ShopScreen, DeckBuilder, PackOpening, InventoryScreen, AchievementsScreen,
  HallOfAchievements, HomeShelf, HeroCardsScreen, CodexScreen, PlayerStatsScreen,
  ChronicleScreen, EndlessLeaderboardScreen,
} from '../lazyScreens'
import { saveCrystals } from '../../game/collection'
import { promoteCommander, loadCommander } from '../../game/commander'
import { auth } from '../../firebase'

/**
 * Collection, shop and player-profile screens — everything reached from the
 * collection/shop side of the menus rather than from a run.
 */
export function CollectionRoutes() {
  const {
    screen, setScreen, returnScreen, crystals, setCrystals, run, fatiguedCards,
    user, commander, setCommander, packs, shopBuildingId, shopTappedNpc,
    handleCrystalsChanged, handleBuyCrystalPack, handlePackDone,
  } = useApp()

  return (
    <>
      {screen === 'player' && (
        <PlayerScreen
          crystals={crystals}
          onCrystalsChanged={handleCrystalsChanged}
          onBack={() => setScreen(returnScreen)}
          onSignOut={user && !user.isAnonymous ? () => { import('firebase/auth').then(({ signOut }) => signOut(auth)) } : undefined}
        />
      )}

      {screen === 'collection-tabs' && (
        <CollectionTabScreen
          crystals={crystals}
          onCrystalsChanged={handleCrystalsChanged}
          onBack={() => setScreen(returnScreen)}
          commanderName={commander?.cardName ?? null}
          onPromoteCommander={(cardName) => {
            const ok = promoteCommander(cardName)
            if (ok) {
              setCommander(loadCommander())
              setScreen('commander')
            }
          }}
        />
      )}

      {screen === 'collection' && (
        <CollectionScreen
          crystals={crystals}
          onCrystalsChanged={handleCrystalsChanged}
          onBack={() => setScreen('title')}
          commanderName={commander?.cardName ?? null}
          onViewAugments={() => setScreen('augments')}
          onPromoteCommander={(cardName) => {
            const ok = promoteCommander(cardName)
            if (ok) {
              setCommander(loadCommander())
              setScreen('commander')
            }
          }}
        />
      )}

      {screen === 'augments' && (
        <AugmentCollectionScreen onBack={() => setScreen('collection')} />
      )}

      {screen === 'shop' && (
        <ShopScreen
          crystals={crystals}
          onBuyCrystalPack={handleBuyCrystalPack}
          onCrystalsChange={(n: number) => { saveCrystals(n); setCrystals(n) }}
          onBack={() => setScreen('title')}
        />
      )}

      {screen === 'shop-cards' && (
        <ShopScreen
          category="cards"
          buildingId={shopBuildingId}
          tappedNpc={shopTappedNpc}
          crystals={crystals}
          onBuyCrystalPack={handleBuyCrystalPack}
          onCrystalsChange={(n: number) => { saveCrystals(n); setCrystals(n) }}
          onBack={() => setScreen('hubworld')}
        />
      )}

      {screen === 'shop-augments' && (
        <ShopScreen
          category="augments"
          buildingId={shopBuildingId}
          tappedNpc={shopTappedNpc}
          crystals={crystals}
          onBuyCrystalPack={handleBuyCrystalPack}
          onCrystalsChange={(n: number) => { saveCrystals(n); setCrystals(n) }}
          onBack={() => setScreen('hubworld')}
        />
      )}

      {screen === 'shop-supplies' && (
        <ShopScreen
          category="supplies"
          buildingId={shopBuildingId}
          tappedNpc={shopTappedNpc}
          crystals={crystals}
          onBuyCrystalPack={handleBuyCrystalPack}
          onCrystalsChange={(n: number) => { saveCrystals(n); setCrystals(n) }}
          onBack={() => setScreen('hubworld')}
        />
      )}

      {screen === 'deckbuilder' && (
        <DeckBuilder onBack={() => setScreen(returnScreen)} fatiguedCards={run ? fatiguedCards : []}/>
      )}

      {screen === 'pack' && (
        <PackOpening packs={packs} onDone={handlePackDone} />
      )}

      {screen === 'inventory' && (
        <InventoryScreen
          onBack={() => setScreen('title')}
          onCrystalsChanged={handleCrystalsChanged}
        />
      )}

      {screen === 'achievements' && (
        <AchievementsScreen
          onBack={() => setScreen('title')}
          onCrystalsChanged={handleCrystalsChanged}
        />
      )}

      {screen === 'hall-of-achievements' && (
        <HallOfAchievements
          onBack={() => setScreen('hubworld')}
          onCrystalsChanged={handleCrystalsChanged}
        />
      )}

      {(screen === 'home-shelf' || screen === 'home-shelf-decorate') && (
        <HomeShelf
          onBack={() => setScreen('hubworld')}
          houseKey={shopBuildingId}
          initialTab={screen === 'home-shelf-decorate' ? 'decorate' : 'shelf'}
        />
      )}

      {screen === 'heroCards' && (
        <HeroCardsScreen onBack={() => setScreen('title')} />
      )}

      {screen === 'codex' && (
        <CodexScreen onDone={() => setScreen(returnScreen)} />
      )}

      {screen === 'playerstats' && (
        <PlayerStatsScreen onBack={() => setScreen('title')} />
      )}

      {screen === 'chronicle' && (
        <ChronicleScreen onBack={() => setScreen(returnScreen)} />
      )}

      {screen === 'endlessleaderboard' && (
        <EndlessLeaderboardScreen onBack={() => setScreen('title')} />
      )}
    </>
  )
}
