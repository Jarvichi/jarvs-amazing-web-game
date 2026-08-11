import { useApp } from '../AppContext'
import {
  PostBattleReward, ActComplete, CutsceneScreen, BossEpilogueScreen,
  BossDialogueScreen, EventScreen, MysteryScreen, MemoryFragmentScreen,
  CharacterEncounterScreen, NarratorJournalScreen, CampScreen, CharacterScreen,
  ReplayBriefingScreen, RelicSelectScreen, CardRestSelect, StarterPackSelect,
  CampaignVictoryScreen, ToBeContinuedScreen, StatUpgradeScreen, CampaignFailedScreen,
} from '../lazyScreens'
import { ItemFoundScreen } from '../../components/modals/ItemFoundScreen'
import { NodeMap } from '../../components/campaign/NodeMap'
import { MerchantScreen } from '../../components/campaign/MerchantScreen'
import {
  clearRun, clearFatigued, getCachedAct, getCampaignForAct, loadPlayerName,
  clearLastRunFailed, ARCHETYPE_STARTER_PACK,
} from '../../game/questline'
import { saveCrystals } from '../../game/collection'
import { loadEarnedRelics } from '../../game/relics'
import { getConsumables, addConsumable } from '../../game/itemStore'
import { addToInventory } from '../../game/dailyLogin'
import { applyStatUpgrade } from '../../game/playerStats'
import { stopBattleMusic, stopGameOverMusic } from '../../game/sound'
import type { Archetype } from '../../game/types'
import rollbar from '../../rollbar'

/**
 * Everything reached from inside a campaign run: the node map, the node-type
 * screens (event, merchant, mystery, camp, memory, encounters), the between-node
 * flow (reward, cutscene, boss dialogue/epilogue), and the end-of-act and
 * end-of-campaign screens.
 */
export function CampaignRoutes() {
  const {
    screen, setScreen, returnScreen, run, setRun, actData, crystals, setCrystals,
    user, fatiguedCards, setFatiguedCards,
    handleSelectNode, handleUseConsumable, handleMainMenu,
    rewardChoices, rewardCrystals, summaryStats, handleRewardPick, handleRewardSkip,
    handleActComplete, hasNextAct,
    cutscenePanels, cutsceneDoneRef, epiloguePanels, setEpiloguePanels, epilogueDoneRef,
    bossDialogueNode, handleBossDialogueDone,
    activeEvent, handleEventChoice,
    merchantItems, handleMerchantBuy, handleMerchantDone,
    mysteryReward, handleMysteryCollect,
    activeMemoryFragment, setActiveMemoryFragment, handleMemoryCollect,
    activeCharacterEncounter, handleCharacterDone, activeNarratorLog,
    campNode, campResult, handleCampChoice, handleCampContinue,
    foundItem, setFoundItem,
    replayBriefingRef, brokenRelicRef, relicSelectDoneRef,
    cardRestCandidates, cardRestPlayCounts, handleCardRestConfirm,
    handleStarterPackPick, bonusPackCards, setBonusPackCards,
  } = useApp()

  return (
    <>
      {screen === 'nodemap' && run && actData && (
        <NodeMap
          act={actData}
          run={run}
          onSelectNode={handleSelectNode}
          onUseConsumable={handleUseConsumable}
          onBack={handleMainMenu}
          user={user}
        />
      )}

      {screen === 'reward' && (
        <PostBattleReward
          choices={rewardChoices}
          crystals={rewardCrystals}
          nodeType={run && actData ? actData.nodes[run.completedNodeIds[run.completedNodeIds.length - 1]]?.type ?? 'battle' : 'battle'}
          onPick={handleRewardPick}
          onSkip={handleRewardSkip}
          battleSummary={summaryStats ?? undefined}
        />
      )}

      {screen === 'actcomplete' && actData && (
        <ActComplete
          actTitle={actData.title}
          actSubtitle={actData.subtitle}
          relicName={actData.rewardRelic}
          relicDesc={actData.rewardRelicDesc}
          onContinue={handleActComplete}
          hasNextAct={hasNextAct}
        />
      )}

      {screen === 'cutscene' && cutscenePanels.length > 0 && (
        <CutsceneScreen panels={cutscenePanels} onDone={() => {
          rollbar.info('CutsceneScreen.onDone fired', { panelCount: cutscenePanels.length, runActId: run?.actId })
          cutsceneDoneRef.current()
        }} />
      )}

      {screen === 'bossEpilogue' && epiloguePanels.length > 0 && (
        <BossEpilogueScreen panels={epiloguePanels} onDone={() => {
          setEpiloguePanels([])
          const done = epilogueDoneRef.current
          epilogueDoneRef.current = null
          if (done) done()
          else setScreen('actcomplete')
        }} />
      )}

      {screen === 'bossdialogue' && bossDialogueNode?.bossDialogue && (
        <BossDialogueScreen
          bossName={bossDialogueNode.label}
          lines={bossDialogueNode.bossDialogue.map(l => l.replace(/\bJarv\b/g, loadPlayerName()))}
          onDone={handleBossDialogueDone}
        />
      )}

      {screen === 'event' && activeEvent && run && (
        <EventScreen
          event={activeEvent}
          onChoice={handleEventChoice}
          playerHp={run.playerHp}
          maxHp={run.maxHp}
        />
      )}

      {screen === 'merchant' && merchantItems.length > 0 && (
        <MerchantScreen
          items={merchantItems}
          crystals={crystals}
          onBuy={handleMerchantBuy}
          onDone={handleMerchantDone}
        />
      )}

      {screen === 'mystery' && mysteryReward && (
        <MysteryScreen
          reward={mysteryReward}
          onCollect={handleMysteryCollect}
        />
      )}

      {(screen === 'memory' || activeMemoryFragment?.shardBonus) && activeMemoryFragment && (
        <MemoryFragmentScreen
          fragment={activeMemoryFragment.fragment}
          alreadyFound={activeMemoryFragment.alreadyFound}
          shardBonus={activeMemoryFragment.shardBonus}
          onCollect={activeMemoryFragment.shardBonus
            ? () => { setActiveMemoryFragment(null); setScreen('nodemap') }
            : handleMemoryCollect}
        />
      )}

      {screen === 'characterEncounter' && activeCharacterEncounter && (
        <CharacterEncounterScreen
          characterId={activeCharacterEncounter.characterId}
          onDone={handleCharacterDone}
        />
      )}

      {screen === 'narratorJournal' && activeNarratorLog && (
        <NarratorJournalScreen
          characterId={activeNarratorLog}
          onBack={() => setScreen(returnScreen)}
        />
      )}

      {screen === 'camp' && campNode && run && (
        <CampScreen
          playerHp={run.playerHp}
          maxHp={run.maxHp}
          livesRemaining={run.livesRemaining}
          maxLives={run.maxLives}
          fatiguedCards={fatiguedCards}
          healAmount={campNode.restHeal ?? 5}
          onChoose={handleCampChoice}
          result={campResult}
          onContinue={handleCampContinue}
        />
      )}

      {screen === 'itemfound' && foundItem && (
        <ItemFoundScreen
          item={{ ...foundItem, acquiredDate: '' }}
          onCollect={() => {
            addToInventory(foundItem)
            setFoundItem(null)
            setScreen('nodemap')
          }}
        />
      )}

      {screen === 'character' && (
        <CharacterScreen onDone={() => setScreen('title')} />
      )}

      {screen === 'replayBriefing' && replayBriefingRef.current && (() => {
        const { actId, completionCount, lastRunFailed, actHasUncollectedFragment, proceed } = replayBriefingRef.current!
        // launchCampaign() already awaited loadAct(actId) before setting this ref,
        // so the act is guaranteed to be in cache by the time this renders.
        const act = getCachedAct(actId)
        if (!act) return null
        const ownsCharm = getConsumables().find(c => c.id === 'memory_charm')?.count ?? 0
        return (
          <ReplayBriefingScreen
            act={act}
            completionCount={completionCount}
            lastRunFailed={lastRunFailed}
            actHasUncollectedFragment={actHasUncollectedFragment}
            crystals={crystals}
            ownsCharm={ownsCharm > 0}
            onBuyCharm={() => {
              if (crystals < 1000) return
              const next = crystals - 1000
              saveCrystals(next)
              setCrystals(next)
              addConsumable('memory_charm', 1)
            }}
            onBegin={chosenCount => { replayBriefingRef.current = null; clearLastRunFailed(); proceed(chosenCount) }}
            onBack={() => { replayBriefingRef.current = null; setScreen('title') }}
          />
        )
      })()}

      {screen === 'relicselect' && (
        <RelicSelectScreen
          earnedRelics={loadEarnedRelics()}
          currentRelic={run?.activeRelic ?? null}
          brokenRelic={brokenRelicRef.current}
          onSelect={relic => {
            rollbar.info('RelicSelectScreen: relic confirmed', { relic, runActId: run?.actId })
            brokenRelicRef.current = null
            relicSelectDoneRef.current(relic)
          }}
        />
      )}

      {screen === 'cardrest' && (
        <CardRestSelect
          candidates={cardRestCandidates}
          playCounts={cardRestPlayCounts}
          alreadyResting={fatiguedCards}
          onConfirm={handleCardRestConfirm}
        />
      )}

      {screen === 'starterpack' && (
        <StarterPackSelect
          onPick={handleStarterPackPick}
          fatiguedCards={fatiguedCards}
          bonusCards={bonusPackCards}
          recommendedPackId={run?.archetype ? ARCHETYPE_STARTER_PACK[run.archetype as Archetype] : undefined}
        />
      )}

      {screen === 'campaignvictory' && (
        <CampaignVictoryScreen
          onBeginAnew={() => setScreen('statupgrade')}
          campaignId={run ? getCampaignForAct(run.actId).id : 'c1'}
        />
      )}

      {screen === 'tobecontinued' && (
        <ToBeContinuedScreen
          campaignName={run ? getCampaignForAct(run.actId).name : 'The Forgotten Kingdom'}
          onContinue={() => {
            clearRun(); setRun(null); clearFatigued(); setFatiguedCards([])
            setScreen(returnScreen)
          }}
        />
      )}

      {screen === 'statupgrade' && (
        <StatUpgradeScreen onSelect={(stat) => {
          applyStatUpgrade(stat)
          const bonus = crystals + 500; saveCrystals(bonus); setCrystals(bonus)
          clearRun(); setRun(null); clearFatigued(); setFatiguedCards([]); setBonusPackCards([])
          setScreen('starterpack')
        }} />
      )}

      {screen === 'campaignfailed' && (
        <CampaignFailedScreen onReturnToMenu={() => { stopBattleMusic(); stopGameOverMusic(); setScreen('title') }} />
      )}
    </>
  )
}
