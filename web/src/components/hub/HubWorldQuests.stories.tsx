import { useState, useEffect } from 'react'
import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubWorld } from './HubWorld'
import { HUB_QUEST_DEFS } from '../../data/hubQuestDefs'
import { setQuestStatus, getQuestProgress } from '../../game/hubQuests'

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

const questById = Object.fromEntries(HUB_QUEST_DEFS.map(q => [q.id, q]))

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

function makeQuestStory(questId: string): Story {
  return {
    name: questById[questId]?.title,
    loaders: [async () => { setupQuestForStory(questId); return {} }],
    render: (args) => (
      <>
        <HubWorld {...args} />
        <QuestDebugOverlay questId={questId} />
      </>
    ),
    args: { onBack: fn(), onFeedback: fn(), user: null },
  }
}

// ── Stories (one per quest) ───────────────────────────────────────────────────

export const LostPendant               = makeQuestStory('lost-pendant')
export const MerchantsHerb             = makeQuestStory('merchants-herb')
export const ScholarsAnthology         = makeQuestStory('scholars-anthology')
export const InnkeepersPackage         = makeQuestStory('innkeepers-package')
export const GreyfishsBait             = makeQuestStory('greyfishs-bait')
export const BramblesFirstDelivery     = makeQuestStory('brambles-first-delivery')
export const GildwynsMissingCard       = makeQuestStory('gildwyns-missing-card')
export const MirasRunawayCrystal       = makeQuestStory('miras-runaway-crystal')
export const AldousKeepsake            = makeQuestStory('aldous-keepsake')
export const AlricManuscript           = makeQuestStory('alric-manuscript')
export const BramsInkSupply            = makeQuestStory('brams-ink-supply')
export const LysssOverdueBooks         = makeQuestStory('lysss-overdue-books')
export const FerrynLedger              = makeQuestStory('ferryn-ledger')
export const SylasMarketSurvey         = makeQuestStory('sylas-market-survey')
export const VarnTrainingWeights       = makeQuestStory('varn-training-weights')
export const ThorinSecurityReport      = makeQuestStory('thorin-security-report')
export const ZevGamePrizeRestock       = makeQuestStory('zev-game-prize-restock')
export const OrinMissingTrophy         = makeQuestStory('orin-missing-trophy')
export const RosieRecipe               = makeQuestStory('rosie-recipe')
export const VexTradeLedger            = makeQuestStory('vex-trade-ledger')
export const ElderFractureMemory       = makeQuestStory('elder-fracture-memory')
export const GreyfishsStrangeCatch     = makeQuestStory('greyfishs-strange-catch')
export const NaiaMissingRecords        = makeQuestStory('naia-missing-records')
export const ThorinMissingGuard        = makeQuestStory('thorin-missing-guard')
export const BrambleStolenGoods        = makeQuestStory('bramble-stolen-goods')
export const MiraUnstableAugment       = makeQuestStory('mira-unstable-augment')
export const FerrynMissingShipment     = makeQuestStory('ferryn-missing-shipment')
export const GildwynCounterfeitCards   = makeQuestStory('gildwyn-counterfeit-cards')
export const SylaPriceFixing           = makeQuestStory('syla-price-fixing')
export const VarnDeserterTrail         = makeQuestStory('varn-deserter-trail')
export const RosieStrangeGuest         = makeQuestStory('rosie-strange-guest')
export const BramAlteredMap            = makeQuestStory('bram-altered-map')
export const LyssForbiddenTexts        = makeQuestStory('lyss-forbidden-texts')
export const AlricStolenNotes          = makeQuestStory('alric-stolen-notes')
export const AldousIntruderEvidence    = makeQuestStory('aldous-intruder-evidence')
export const VexSuspiciousBuyer        = makeQuestStory('vex-suspicious-buyer')
export const ZevRiggedGames            = makeQuestStory('zev-rigged-games')
export const OrinFakeTrophy            = makeQuestStory('orin-fake-trophy')
export const DealerMarkedDeck          = makeQuestStory('dealer-marked-deck')
export const AldousFamilyHeirloom      = makeQuestStory('aldous-family-heirloom')
export const ThorinEchoWarning         = makeQuestStory('thorin-echo-warning')
export const ElderOldCodex             = makeQuestStory('elder-old-codex')
export const NaiaEchoRecords           = makeQuestStory('naia-echo-records')
export const FerrynGuildInformant      = makeQuestStory('ferryn-guild-informant')
export const BrambleSmugglersCache     = makeQuestStory('bramble-smugglers-cache')
export const RosieSpyInTheInn          = makeQuestStory('rosie-spy-in-the-inn')
export const VarnDoubleAgent           = makeQuestStory('varn-double-agent')
export const GildwynStolenCardPlans    = makeQuestStory('gildwyn-stolen-card-plans')
export const MiraCorruptedAugments     = makeQuestStory('mira-corrupted-augments')
export const BramEchoTerritoryMap      = makeQuestStory('bram-echo-territory-map')
export const LyssCipherKey             = makeQuestStory('lyss-cipher-key')
export const AlricEchoResearch         = makeQuestStory('alric-echo-research')
export const FishermanGlowingNet       = makeQuestStory('fisherman-glowing-net')
export const ZevShadowGambler          = makeQuestStory('zev-shadow-gambler')
export const OrinContaminatedTrophies  = makeQuestStory('orin-contaminated-trophies')
export const DealerEchoBookie          = makeQuestStory('dealer-echo-bookie')
export const SylaEchoMarketAgent       = makeQuestStory('syla-echo-market-agent')
export const AldousHiddenPassage       = makeQuestStory('aldous-hidden-passage')
export const VexEchoSupplier           = makeQuestStory('vex-echo-supplier')
export const ElderConfession           = makeQuestStory('elder-confession')
export const ThorinBarracksLockdown    = makeQuestStory('thorin-barracks-lockdown')
export const VarnTraitorConfronted     = makeQuestStory('varn-traitor-confronted')
export const NaiaHeartstoneRecords     = makeQuestStory('naia-heartstone-records')
export const BramSafeRoutes            = makeQuestStory('bram-safe-routes')
export const FerrynGuildLockdown       = makeQuestStory('ferryn-guild-lockdown')
export const MiraPurgingAugments       = makeQuestStory('mira-purging-augments')
export const GildwynEchoDeckMaster     = makeQuestStory('gildwyn-echo-deck-master')
export const LyssUnlockTheCipher       = makeQuestStory('lyss-unlock-the-cipher')
export const RosieShelterForFamilies   = makeQuestStory('rosie-shelter-for-families')
export const AlricFractureStudy        = makeQuestStory('alric-fracture-study')
export const FishermanFractureDepths   = makeQuestStory('fisherman-fracture-depths')
export const SylaMarketPurge           = makeQuestStory('syla-market-purge')
export const ZevGamesHallClear         = makeQuestStory('zev-games-hall-clear')
export const OrinChampionsShield       = makeQuestStory('orin-champions-shield')
export const DealerFractureIntel       = makeQuestStory('dealer-fracture-intel')
export const AldousPassageExplored     = makeQuestStory('aldous-passage-explored')
export const ElderAbsolution           = makeQuestStory('elder-absolution')
export const VexSupplyChainRebuilt     = makeQuestStory('vex-supply-chain-rebuilt')
export const BrambleFortifiedSupplies  = makeQuestStory('bramble-fortified-supplies')
export const ThorinVaultPreparation    = makeQuestStory('thorin-vault-preparation')
export const NaiaHeartstoneLocation    = makeQuestStory('naia-heartstone-location')
export const ElderRallyingTheHub       = makeQuestStory('elder-rallying-the-hub')
export const ThorinHubDefensePlan      = makeQuestStory('thorin-hub-defense-plan')
export const VarnTrainingDefenders     = makeQuestStory('varn-training-defenders')
export const MiraAntiFractureCharms    = makeQuestStory('mira-anti-fracture-charms')
export const BramEscapeRoutes          = makeQuestStory('bram-escape-routes')
export const FerrynResourceCache       = makeQuestStory('ferryn-resource-cache')
export const RosieSafeHarbour          = makeQuestStory('rosie-safe-harbour')
export const GildwynTheFractureCard    = makeQuestStory('gildwyn-the-fracture-card')
export const LyssTheFinalCipher        = makeQuestStory('lyss-the-final-cipher')
export const AlricHeartstoneAnalysis   = makeQuestStory('alric-heartstone-analysis')
export const FishermanDepthsSecret     = makeQuestStory('fisherman-depths-secret')
export const DealerEchoFinalBet        = makeQuestStory('dealer-echo-final-bet')
export const SylaMarketFortified       = makeQuestStory('syla-market-fortified')
export const ZevGamesHallStands        = makeQuestStory('zev-games-hall-stands')
export const OrinChampionsStand        = makeQuestStory('orin-champions-stand')
export const AldousTheHearthstone      = makeQuestStory('aldous-the-hearthstone')
export const VexFinalTrade             = makeQuestStory('vex-final-trade')
export const ElderTheConvergence       = makeQuestStory('elder-the-convergence')
export const ThorinTheLastWatch        = makeQuestStory('thorin-the-last-watch')
