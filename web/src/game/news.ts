// ─── News / What's New System ─────────────────────────────────────────────────
// Admin-authored news posts stored in Firestore `news/` collection.
// Falls back to news.json if Firestore is unavailable.
//
// Firestore rules required (add to firestore.rules):
//   match /news/{newsId} {
//     allow read: if true;
//     allow write: if request.auth.uid == "pAB2tLH049PCOI73cQpFlisKpDw1";
//   }
//
// Document schema (matches NewsItem):
//   title:  string
//   body:   string
//   date:   string  (ISO date, e.g. "2026-03-29")
//   tag:    string  (optional, e.g. "NEW FEATURE", "BUG FIX", "UPDATE", "EVENT")

import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { logError } from '../logger'
import newsData from '../data/news.json'

// ── Types ────────────────────────────────────────────────────────────────────

export interface NewsItem {
  id: string
  title: string
  body: string
  date: string
  tag?: string
}

export const NEWS_TAGS = ['NEW FEATURE', 'UPDATE', 'BUG FIX', 'EVENT'] as const

// ── Storage ──────────────────────────────────────────────────────────────────

const READ_NEWS_KEY = 'jarv_read_news'

export function loadReadNewsIds(): string[] {
  try {
    const raw = localStorage.getItem(READ_NEWS_KEY)
    if (raw) return JSON.parse(raw) as string[]
  } catch { /* ignore */ }
  return []
}

export function markNewsRead(ids: string[]): void {
  try {
    const existing = loadReadNewsIds()
    const merged = Array.from(new Set([...existing, ...ids]))
    localStorage.setItem(READ_NEWS_KEY, JSON.stringify(merged))
  } catch (e) {
    logError('markNewsRead failed', { error: String(e) })
  }
}

// ── Firestore fetch ───────────────────────────────────────────────────────────

async function fetchNewsFromFirestore(): Promise<NewsItem[]> {
  const snap = await getDocs(collection(db, 'news'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem))
}

// ── Registry ─────────────────────────────────────────────────────────────────

/**
 * Fetch all news: Firestore first, local news.json as fallback.
 * Merges both sources; Firestore items take precedence over local ones.
 */
export async function getAllNews(): Promise<NewsItem[]> {
  let remote: NewsItem[] = []
  try {
    remote = await fetchNewsFromFirestore()
  } catch (e) {
    logError('fetchNewsFromFirestore failed, using local fallback', { error: String(e) })
  }

  const remoteIds = new Set(remote.map(n => n.id))
  const local = (newsData as NewsItem[]).filter(n => !remoteIds.has(n.id))
  const all = [...remote, ...local]
  return all.sort((a, b) => b.date.localeCompare(a.date))
}

/** Returns the number of news items not yet read by this player. */
export async function getUnreadCount(): Promise<number> {
  const all = await getAllNews()
  const read = new Set(loadReadNewsIds())
  return all.filter(n => !read.has(n.id)).length
}

// ── Admin CRUD ────────────────────────────────────────────────────────────────

/** Write a news document to Firestore. Uses the item's `id` as the document ID. */
export async function saveNewsToFirestore(item: NewsItem): Promise<void> {
  const { id, ...fields } = item
  await setDoc(doc(db, 'news', id), fields)
}

/** Delete a news document from Firestore. */
export async function deleteNewsFromFirestore(id: string): Promise<void> {
  await deleteDoc(doc(db, 'news', id))
}
