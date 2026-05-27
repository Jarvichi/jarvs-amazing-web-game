// Publishes a Firestore event when a player obtains a secret-rarity card
// (mythic, shiny, holofoil, glass). Events are merged into the news feed by
// fetchSecretRareWinsAsNews() in news.ts.
//
// Firestore rules required (add to firestore.rules):
//   match /secretRareWins/{docId} {
//     allow read: if true;
//     allow create: if true;
//   }

import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { logError } from '../logger'

const RARE_WINS_COLLECTION = 'secretRareWins'

export type SecretRarityType = 'mythic' | 'shiny' | 'holofoil' | 'glass'

const RARITY_EMOJI: Record<SecretRarityType, string> = {
  mythic:   '✨',
  shiny:    '⭐',
  holofoil: '🌈',
  glass:    '💎',
}

export async function publishSecretRareWin(
  playerName: string,
  cardName: string,
  rarityType: SecretRarityType,
): Promise<void> {
  try {
    await addDoc(collection(db, RARE_WINS_COLLECTION), {
      playerName,
      cardName,
      rarityType,
      wonAt: Timestamp.now(),
    })
  } catch (e) {
    logError('publishSecretRareWin', { error: String(e) })
  }
}

export { RARITY_EMOJI }
