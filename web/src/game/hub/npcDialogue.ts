import { getDailyChallengeState } from '../dailyChallenge'

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
