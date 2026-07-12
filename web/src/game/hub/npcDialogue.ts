import { getDailyChallengeState } from '../dailyChallenge'
import { getDailyChallengeTarget, isDailyChallengeClaimed } from '../miniGameDailyChallenge'
import type { MiniGameId } from '../miniGames'

/** Returns proximity dialogue entries for the daily challenge herald NPC. */
export function getDailyChallengeNPCDialogue(): { atDistance: number; text: string }[] {
  const dc = getDailyChallengeState()
  let text: string
  if (dc.won === true) {
    text = "Today's challenge: complete!"
  } else if (dc.attempts > 0) {
    text = `Daily challenge: attempt ${dc.attempts}`
  } else {
    text = 'Daily challenge awaits!'
  }
  return [{ atDistance: 5, text }]
}

/** Returns proximity dialogue entries for an arcade mini-game's NPC, announcing
 *  that game's daily ticket-score challenge. */
export function getMiniGameChallengeNPCDialogue(gameId: MiniGameId): { atDistance: number; text: string }[] {
  const text = isDailyChallengeClaimed(gameId)
    ? "You already beat today's challenge — nice work!"
    : `🎯 Today's challenge: beat ${getDailyChallengeTarget(gameId)} tickets for a bonus!`
  return [{ atDistance: 5, text }]
}
