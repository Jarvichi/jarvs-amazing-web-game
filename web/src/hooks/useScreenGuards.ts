import { useEffect, type Dispatch, type SetStateAction } from 'react'
import rollbar from '../rollbar'
import { clearRun, type CutscenePanel, type EventData, type QuestNode, type RunState } from '../game/questline'
import type { RewardDef } from '../game/dailyLogin'
import type { UselessItem } from '../game/dailyLogin'
import type { MerchantItem } from '../components/campaign/MerchantScreen'
import type { Screen } from '../app/screens'

interface UseScreenGuardsArgs {
  screen:           Screen
  setScreen:        Dispatch<SetStateAction<Screen>>
  run:              RunState | null
  setRun:           Dispatch<SetStateAction<RunState | null>>
  actDataFailed:    boolean
  cutscenePanels:   CutscenePanel[]
  epiloguePanels:   CutscenePanel[]
  bossDialogueNode: QuestNode | null
  activeEvent:      EventData | null
  merchantItems:    MerchantItem[]
  mysteryReward:    RewardDef | null
  foundItem:        Omit<UselessItem, 'acquiredDate'> | null
}

/**
 * Single guard for all data-dependent screens. Fires after render as a backstop
 * against programming errors — if required data is missing, log to Rollbar and
 * redirect before the user sees a broken screen. Add new screens here.
 */
export function useScreenGuards({
  screen, setScreen, run, setRun, actDataFailed,
  cutscenePanels, epiloguePanels, bossDialogueNode, activeEvent,
  merchantItems, mysteryReward, foundItem,
}: UseScreenGuardsArgs): void {
  useEffect(() => {
    const fallback = run ? 'nodemap' : 'title'
    if (screen === 'cutscene' && cutscenePanels.length === 0) {
      rollbar.error('cutscene screen reached with no panels', {
        runActId: run?.actId,
        pendingNodeId: run?.pendingNodeId,
        pendingActComplete: run?.pendingActComplete,
      })
      setScreen(fallback)
    } else if (screen === 'bossEpilogue' && epiloguePanels.length === 0) {
      rollbar.error('bossEpilogue screen reached with no panels', { runActId: run?.actId })
      setScreen(run?.pendingActComplete ? 'actcomplete' : fallback)
    } else if (screen === 'actcomplete' && (!run || actDataFailed)) {
      rollbar.error('actcomplete screen reached without valid run/actData', { runActId: run?.actId })
      clearRun()
      setRun(null)
      setScreen('title')
    } else if (screen === 'bossdialogue' && !bossDialogueNode?.bossDialogue) {
      rollbar.error('bossdialogue screen reached without bossDialogueNode/dialogue', { runActId: run?.actId })
      setScreen(fallback)
    } else if (screen === 'event' && (!activeEvent || !run)) {
      rollbar.error('event screen reached without activeEvent or run', { runActId: run?.actId, hasEvent: !!activeEvent })
      setScreen(fallback)
    } else if (screen === 'merchant' && merchantItems.length === 0) {
      rollbar.error('merchant screen reached with empty merchantItems', { runActId: run?.actId })
      setScreen(fallback)
    } else if (screen === 'mystery' && !mysteryReward) {
      rollbar.error('mystery screen reached without mysteryReward', { runActId: run?.actId })
      setScreen(fallback)
    } else if (screen === 'itemfound' && !foundItem) {
      rollbar.error('itemfound screen reached without foundItem', { runActId: run?.actId })
      setScreen(fallback)
    } else if (screen === 'nodemap' && (!run || actDataFailed)) {
      rollbar.error('nodemap screen reached without valid run/actData', { runActId: run?.actId })
      clearRun()
      setRun(null)
      setScreen('title')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, cutscenePanels, epiloguePanels, run, bossDialogueNode, activeEvent, merchantItems, mysteryReward, foundItem, actDataFailed])
}
