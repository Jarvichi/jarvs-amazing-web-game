// ─── Feedback / Bug Submission System ─────────────────────────────────────────
// Player-submitted feedback stored in Firestore `feedback/` collection.
//
// Firestore rules required (add to firestore.rules):
//   match /feedback/{feedbackId} {
//     allow read, delete: if request.auth.uid == "pAB2tLH049PCOI73cQpFlisKpDw1";
//     allow create: if true;
//   }

import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { logError } from '../logger'

export type FeedbackType = 'bug' | 'suggestion' | 'other'

export interface FeedbackItem {
  id: string
  type: FeedbackType
  subject: string
  body: string
  submittedAt: string
  userId?: string
}

export async function submitFeedback(
  item: Omit<FeedbackItem, 'id' | 'submittedAt'>,
  userId?: string,
): Promise<void> {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const doc_ = {
    type: item.type,
    subject: item.subject,
    body: item.body,
    submittedAt: new Date().toISOString(),
    ...(userId ? { userId } : {}),
  }
  await setDoc(doc(db, 'feedback', id), doc_)
}

export async function getAllFeedback(): Promise<FeedbackItem[]> {
  try {
    const snap = await getDocs(collection(db, 'feedback'))
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as FeedbackItem))
    return items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  } catch (e) {
    logError('getAllFeedback failed', { error: String(e) })
    return []
  }
}

export async function deleteFeedback(id: string): Promise<void> {
  await deleteDoc(doc(db, 'feedback', id))
}
