import { useState, useEffect } from 'react'
import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubWorld } from './HubWorld'
import { setQuestStatus, getQuestProgress } from '../../game/hub/quests'
import { ALL_QUEST_DEFS, RAVENWATCH, RAVENWATCH_QUESTS } from '../../data/hub/hubWorldFactory'
import { HubLocationBundle, HubQuestBundle } from '../../data/hub/loader'

const meta = {
  title: 'Hub/HubWorld Quests',
  component: HubWorld,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HubWorld>

export default meta
type Story = StoryObj<typeof meta>

// ── Quest lookup ──────────────────────────────────────────────────────────────

const questById = Object.fromEntries(ALL_QUEST_DEFS.map(q => [q.id, q]))

// ── Setup helpers ─────────────────────────────────────────────────────────────

function setupQuestForStory(questId: string): void {
  localStorage.removeItem('jarv_hub_quests')
  localStorage.removeItem('jarv_hub_pickups')
  const visited = new Set<string>()
  function completePrereqs(id: string): void {
    const quest = questById[id]
    if (!quest?.prerequisite) return
    for (const part of quest.prerequisite.split('|')) {
      const trimmed = part.trim()
      if (!trimmed.startsWith('quest:')) continue
      const prereqId = trimmed.slice(6)
      if (!visited.has(prereqId)) {
        visited.add(prereqId)
        completePrereqs(prereqId)
        setQuestStatus(prereqId, 'completed')
      }
    }
  }
  completePrereqs(questId)
  setQuestStatus(questId, 'active')
}

// ── Debug overlay ─────────────────────────────────────────────────────────────

function QuestDebugOverlay({ questId }: { questId: string }) {
  const quest = questById[questId]
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 500)
    return () => clearInterval(t)
  }, [])
  if (!quest) return null
  return (
    <div style={{
      position: 'fixed', top: 60, right: 16, zIndex: 9999,
      background: 'rgba(0,0,0,0.82)', color: '#fff',
      fontFamily: 'monospace', fontSize: 12,
      padding: '8px 12px', borderRadius: 6,
      border: '1px solid #555', minWidth: 180,
      pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#aaddff' }}>
        {quest.title}
      </div>
      {quest.steps.map(step => {
        const progress = getQuestProgress(questId, step.key)
        const done = progress >= step.required
        return (
          <div key={step.key} style={{ color: done ? '#88ff88' : '#ffcc44' }}>
            {done ? '✓' : '○'} {step.key}: {progress}/{step.required}
          </div>
        )
      })}
    </div>
  )
}

// ── Story factory ─────────────────────────────────────────────────────────────

function makeQuestStory(questId: string, locationData: HubLocationBundle, locationQuests: HubQuestBundle): Story {
  return {
    name: questById[questId]?.title,
    loaders: [async () => { setupQuestForStory(questId); return {} }],
    render: (args) => (
      <>
        <HubWorld {...args} />
        <QuestDebugOverlay questId={questId} />
      </>
    ),
    args: {
      onBack: fn(), onFeedback: fn(), user: null,
      // required props for HubWorld component
      locationData: locationData,
      locationQuests: locationQuests,
      questDefs: ALL_QUEST_DEFS,
      allQuestDefs: ALL_QUEST_DEFS,
    },
  }
}

// ── Stories (one per quest) ───────────────────────────────────────────────────

export const LostPendant               = makeQuestStory('lost-pendant', RAVENWATCH, RAVENWATCH_QUESTS)
export const MerchantsHerb             = makeQuestStory('merchants-herb', RAVENWATCH, RAVENWATCH_QUESTS)
export const ScholarsAnthology         = makeQuestStory('scholars-anthology', RAVENWATCH, RAVENWATCH_QUESTS)
export const InnkeepersPackage         = makeQuestStory('innkeepers-package', RAVENWATCH, RAVENWATCH_QUESTS)
export const GreyfishsBait             = makeQuestStory('greyfishs-bait', RAVENWATCH, RAVENWATCH_QUESTS)
export const BramblesFirstDelivery     = makeQuestStory('brambles-first-delivery', RAVENWATCH, RAVENWATCH_QUESTS)
export const GildwynsMissingCard       = makeQuestStory('gildwyns-missing-card', RAVENWATCH, RAVENWATCH_QUESTS)
export const MirasRunawayCrystal       = makeQuestStory('miras-runaway-crystal', RAVENWATCH, RAVENWATCH_QUESTS)
export const AldousKeepsake            = makeQuestStory('aldous-keepsake', RAVENWATCH, RAVENWATCH_QUESTS)
export const AlricManuscript           = makeQuestStory('alric-manuscript', RAVENWATCH, RAVENWATCH_QUESTS)
export const BramsInkSupply            = makeQuestStory('brams-ink-supply', RAVENWATCH, RAVENWATCH_QUESTS)
export const LysssOverdueBooks         = makeQuestStory('lysss-overdue-books', RAVENWATCH, RAVENWATCH_QUESTS)
export const FerrynLedger              = makeQuestStory('ferryn-ledger', RAVENWATCH, RAVENWATCH_QUESTS)
export const SylasMarketSurvey         = makeQuestStory('sylas-market-survey', RAVENWATCH, RAVENWATCH_QUESTS)
export const VarnTrainingWeights       = makeQuestStory('varn-training-weights', RAVENWATCH, RAVENWATCH_QUESTS)
export const ThorinSecurityReport      = makeQuestStory('thorin-security-report', RAVENWATCH, RAVENWATCH_QUESTS)
export const ZevGamePrizeRestock       = makeQuestStory('zev-game-prize-restock', RAVENWATCH, RAVENWATCH_QUESTS)
export const OrinMissingTrophy         = makeQuestStory('orin-missing-trophy', RAVENWATCH, RAVENWATCH_QUESTS)
export const RosieRecipe               = makeQuestStory('rosie-recipe', RAVENWATCH, RAVENWATCH_QUESTS)
export const VexTradeLedger            = makeQuestStory('vex-trade-ledger', RAVENWATCH, RAVENWATCH_QUESTS)
export const ElderFractureMemory       = makeQuestStory('elder-fracture-memory', RAVENWATCH, RAVENWATCH_QUESTS)
export const GreyfishsStrangeCatch     = makeQuestStory('greyfishs-strange-catch', RAVENWATCH, RAVENWATCH_QUESTS)
export const NaiaMissingRecords        = makeQuestStory('naia-missing-records', RAVENWATCH, RAVENWATCH_QUESTS)
export const ThorinMissingGuard        = makeQuestStory('thorin-missing-guard', RAVENWATCH, RAVENWATCH_QUESTS)
export const BrambleStolenGoods        = makeQuestStory('bramble-stolen-goods', RAVENWATCH, RAVENWATCH_QUESTS)
export const MiraUnstableAugment       = makeQuestStory('mira-unstable-augment', RAVENWATCH, RAVENWATCH_QUESTS)
export const FerrynMissingShipment     = makeQuestStory('ferryn-missing-shipment', RAVENWATCH, RAVENWATCH_QUESTS)
export const GildwynCounterfeitCards   = makeQuestStory('gildwyn-counterfeit-cards', RAVENWATCH, RAVENWATCH_QUESTS)
export const SylaPriceFixing           = makeQuestStory('syla-price-fixing', RAVENWATCH, RAVENWATCH_QUESTS)
export const VarnDeserterTrail         = makeQuestStory('varn-deserter-trail', RAVENWATCH, RAVENWATCH_QUESTS)
export const RosieStrangeGuest         = makeQuestStory('rosie-strange-guest', RAVENWATCH, RAVENWATCH_QUESTS)
export const BramAlteredMap            = makeQuestStory('bram-altered-map', RAVENWATCH, RAVENWATCH_QUESTS)
export const LyssForbiddenTexts        = makeQuestStory('lyss-forbidden-texts', RAVENWATCH, RAVENWATCH_QUESTS)
export const AlricStolenNotes          = makeQuestStory('alric-stolen-notes', RAVENWATCH, RAVENWATCH_QUESTS)
export const AldousIntruderEvidence    = makeQuestStory('aldous-intruder-evidence', RAVENWATCH, RAVENWATCH_QUESTS)
export const VexSuspiciousBuyer        = makeQuestStory('vex-suspicious-buyer', RAVENWATCH, RAVENWATCH_QUESTS)
export const ZevRiggedGames            = makeQuestStory('zev-rigged-games', RAVENWATCH, RAVENWATCH_QUESTS)
export const OrinFakeTrophy            = makeQuestStory('orin-fake-trophy', RAVENWATCH, RAVENWATCH_QUESTS)
export const DealerMarkedDeck          = makeQuestStory('dealer-marked-deck', RAVENWATCH, RAVENWATCH_QUESTS)
export const AldousFamilyHeirloom      = makeQuestStory('aldous-family-heirloom', RAVENWATCH, RAVENWATCH_QUESTS)
export const ThorinEchoWarning         = makeQuestStory('thorin-echo-warning', RAVENWATCH, RAVENWATCH_QUESTS)
export const ElderOldCodex             = makeQuestStory('elder-old-codex', RAVENWATCH, RAVENWATCH_QUESTS)
export const NaiaEchoRecords           = makeQuestStory('naia-echo-records', RAVENWATCH, RAVENWATCH_QUESTS)
export const FerrynGuildInformant      = makeQuestStory('ferryn-guild-informant', RAVENWATCH, RAVENWATCH_QUESTS)
export const BrambleSmugglersCache     = makeQuestStory('bramble-smugglers-cache', RAVENWATCH, RAVENWATCH_QUESTS)
export const RosieSpyInTheInn          = makeQuestStory('rosie-spy-in-the-inn', RAVENWATCH, RAVENWATCH_QUESTS)
export const VarnDoubleAgent           = makeQuestStory('varn-double-agent', RAVENWATCH, RAVENWATCH_QUESTS)
export const GildwynStolenCardPlans    = makeQuestStory('gildwyn-stolen-card-plans', RAVENWATCH, RAVENWATCH_QUESTS)
export const MiraCorruptedAugments     = makeQuestStory('mira-corrupted-augments', RAVENWATCH, RAVENWATCH_QUESTS)
export const BramEchoTerritoryMap      = makeQuestStory('bram-echo-territory-map', RAVENWATCH, RAVENWATCH_QUESTS)
export const LyssCipherKey             = makeQuestStory('lyss-cipher-key', RAVENWATCH, RAVENWATCH_QUESTS)
export const AlricEchoResearch         = makeQuestStory('alric-echo-research', RAVENWATCH, RAVENWATCH_QUESTS)
export const FishermanGlowingNet       = makeQuestStory('fisherman-glowing-net', RAVENWATCH, RAVENWATCH_QUESTS)
export const ZevShadowGambler          = makeQuestStory('zev-shadow-gambler', RAVENWATCH, RAVENWATCH_QUESTS)
export const OrinContaminatedTrophies  = makeQuestStory('orin-contaminated-trophies', RAVENWATCH, RAVENWATCH_QUESTS)
export const DealerEchoBookie          = makeQuestStory('dealer-echo-bookie', RAVENWATCH, RAVENWATCH_QUESTS)
export const SylaEchoMarketAgent       = makeQuestStory('syla-echo-market-agent', RAVENWATCH, RAVENWATCH_QUESTS)
export const AldousHiddenPassage       = makeQuestStory('aldous-hidden-passage', RAVENWATCH, RAVENWATCH_QUESTS)
export const VexEchoSupplier           = makeQuestStory('vex-echo-supplier', RAVENWATCH, RAVENWATCH_QUESTS)
export const ElderConfession           = makeQuestStory('elder-confession', RAVENWATCH, RAVENWATCH_QUESTS)
export const ThorinBarracksLockdown    = makeQuestStory('thorin-barracks-lockdown', RAVENWATCH, RAVENWATCH_QUESTS)
export const VarnTraitorConfronted     = makeQuestStory('varn-traitor-confronted', RAVENWATCH, RAVENWATCH_QUESTS)
export const NaiaHeartstoneRecords     = makeQuestStory('naia-heartstone-records', RAVENWATCH, RAVENWATCH_QUESTS)
export const BramSafeRoutes            = makeQuestStory('bram-safe-routes', RAVENWATCH, RAVENWATCH_QUESTS)
export const FerrynGuildLockdown       = makeQuestStory('ferryn-guild-lockdown', RAVENWATCH, RAVENWATCH_QUESTS)
export const MiraPurgingAugments       = makeQuestStory('mira-purging-augments', RAVENWATCH, RAVENWATCH_QUESTS)
export const GildwynEchoDeckMaster     = makeQuestStory('gildwyn-echo-deck-master', RAVENWATCH, RAVENWATCH_QUESTS)
export const LyssUnlockTheCipher       = makeQuestStory('lyss-unlock-the-cipher', RAVENWATCH, RAVENWATCH_QUESTS)
export const RosieShelterForFamilies   = makeQuestStory('rosie-shelter-for-families', RAVENWATCH, RAVENWATCH_QUESTS)
export const AlricFractureStudy        = makeQuestStory('alric-fracture-study', RAVENWATCH, RAVENWATCH_QUESTS)
export const FishermanFractureDepths   = makeQuestStory('fisherman-fracture-depths', RAVENWATCH, RAVENWATCH_QUESTS)
export const SylaMarketPurge           = makeQuestStory('syla-market-purge', RAVENWATCH, RAVENWATCH_QUESTS)
export const ZevGamesHallClear         = makeQuestStory('zev-games-hall-clear', RAVENWATCH, RAVENWATCH_QUESTS)
export const OrinChampionsShield       = makeQuestStory('orin-champions-shield', RAVENWATCH, RAVENWATCH_QUESTS)
export const DealerFractureIntel       = makeQuestStory('dealer-fracture-intel', RAVENWATCH, RAVENWATCH_QUESTS)
export const AldousPassageExplored     = makeQuestStory('aldous-passage-explored', RAVENWATCH, RAVENWATCH_QUESTS)
export const ElderAbsolution           = makeQuestStory('elder-absolution', RAVENWATCH, RAVENWATCH_QUESTS)
export const VexSupplyChainRebuilt     = makeQuestStory('vex-supply-chain-rebuilt', RAVENWATCH, RAVENWATCH_QUESTS)
export const BrambleFortifiedSupplies  = makeQuestStory('bramble-fortified-supplies', RAVENWATCH, RAVENWATCH_QUESTS)
export const ThorinVaultPreparation    = makeQuestStory('thorin-vault-preparation', RAVENWATCH, RAVENWATCH_QUESTS)
export const NaiaHeartstoneLocation    = makeQuestStory('naia-heartstone-location', RAVENWATCH, RAVENWATCH_QUESTS)
export const ElderRallyingTheHub       = makeQuestStory('elder-rallying-the-hub', RAVENWATCH, RAVENWATCH_QUESTS)
export const ThorinHubDefensePlan      = makeQuestStory('thorin-hub-defense-plan', RAVENWATCH, RAVENWATCH_QUESTS)
export const VarnTrainingDefenders     = makeQuestStory('varn-training-defenders', RAVENWATCH, RAVENWATCH_QUESTS)
export const MiraAntiFractureCharms    = makeQuestStory('mira-anti-fracture-charms', RAVENWATCH, RAVENWATCH_QUESTS)
export const BramEscapeRoutes          = makeQuestStory('bram-escape-routes', RAVENWATCH, RAVENWATCH_QUESTS)
export const FerrynResourceCache       = makeQuestStory('ferryn-resource-cache', RAVENWATCH, RAVENWATCH_QUESTS)
export const RosieSafeHarbour          = makeQuestStory('rosie-safe-harbour', RAVENWATCH, RAVENWATCH_QUESTS)
export const GildwynTheFractureCard    = makeQuestStory('gildwyn-the-fracture-card', RAVENWATCH, RAVENWATCH_QUESTS)
export const LyssTheFinalCipher        = makeQuestStory('lyss-the-final-cipher', RAVENWATCH, RAVENWATCH_QUESTS)
export const AlricHeartstoneAnalysis   = makeQuestStory('alric-heartstone-analysis', RAVENWATCH, RAVENWATCH_QUESTS)
export const FishermanDepthsSecret     = makeQuestStory('fisherman-depths-secret', RAVENWATCH, RAVENWATCH_QUESTS)
export const DealerEchoFinalBet        = makeQuestStory('dealer-echo-final-bet', RAVENWATCH, RAVENWATCH_QUESTS)
export const SylaMarketFortified       = makeQuestStory('syla-market-fortified', RAVENWATCH, RAVENWATCH_QUESTS)
export const ZevGamesHallStands        = makeQuestStory('zev-games-hall-stands', RAVENWATCH, RAVENWATCH_QUESTS)
export const OrinChampionsStand        = makeQuestStory('orin-champions-stand', RAVENWATCH, RAVENWATCH_QUESTS)
export const AldousTheHearthstone      = makeQuestStory('aldous-the-hearthstone', RAVENWATCH, RAVENWATCH_QUESTS)
export const VexFinalTrade             = makeQuestStory('vex-final-trade', RAVENWATCH, RAVENWATCH_QUESTS)
export const ElderTheConvergence       = makeQuestStory('elder-the-convergence', RAVENWATCH, RAVENWATCH_QUESTS)
export const ThorinTheLastWatch        = makeQuestStory('thorin-the-last-watch', RAVENWATCH, RAVENWATCH_QUESTS)
