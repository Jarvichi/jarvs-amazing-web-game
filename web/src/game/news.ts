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
//   title:    string
//   body:     string
//   date:     string  (ISO date, e.g. "2026-03-29")
//   tag:      string  (optional, e.g. "NEW FEATURE", "BUG FIX", "UPDATE", "EVENT")
//   imageUrl: string  (optional, URL of an image to display in the post)

import { collection, getDocs, doc, setDoc, deleteDoc, Timestamp, query, orderBy, limit } from 'firebase/firestore'
import { RARITY_EMOJI, type SecretRarityType } from './secretRareNews'
import { getChronicleNewsItems } from './chronicle'
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
  imageUrl?: string
}

export const NEWS_TAGS = ['NEW FEATURE', 'UPDATE', 'BUG FIX', 'EVENT'] as const

// ── Storage ──────────────────────────────────────────────────────────────────

const READ_NEWS_KEY = 'jarv_read_news'
const DISMISSED_NEWS_KEY = 'jarv_dismissed_news'

export function loadReadNewsIds(): string[] {
  try {
    const raw = localStorage.getItem(READ_NEWS_KEY)
    if (raw) return JSON.parse(raw) as string[]
  } catch { /* ignore */ }
  return []
}

export function loadDismissedNewsIds(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_NEWS_KEY)
    if (raw) return JSON.parse(raw) as string[]
  } catch { /* ignore */ }
  return []
}

export function dismissNewsItem(id: string): void {
  try {
    const existing = loadDismissedNewsIds()
    if (!existing.includes(id)) {
      localStorage.setItem(DISMISSED_NEWS_KEY, JSON.stringify([...existing, id]))
    }
  } catch (e) {
    logError('dismissNewsItem failed', { error: String(e) })
  }
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

async function fetchJackpotWinsAsNews(): Promise<NewsItem[]> {
  const snap = await getDocs(collection(db, 'jackpotWins'))
  return snap.docs.map(d => {
    const data = d.data() as { playerName: string; amount: number; wonAt: Timestamp }
    const date = data.wonAt ? data.wonAt.toDate() : new Date()
    const dateStr = date.toISOString().split('T')[0]
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return {
      id: `jackpot-win-${d.id}`,
      title: '🎰 Grand Jackpot Won!',
      body: `${data.playerName} won the Grand Jackpot of ${data.amount} credits at ${timeStr} on ${dateStr}!`,
      date: dateStr,
      tag: 'EVENT',
    } satisfies NewsItem
  })
}

async function fetchSecretRareWinsAsNews(): Promise<NewsItem[]> {
  const q = query(collection(db, 'secretRareWins'), orderBy('wonAt', 'desc'), limit(20))
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data() as { playerName: string; cardName: string; rarityType: SecretRarityType; wonAt: Timestamp }
    const date = data.wonAt ? data.wonAt.toDate() : new Date()
    const dateStr = date.toISOString().split('T')[0]
    const emoji = RARITY_EMOJI[data.rarityType] ?? '✨'
    return {
      id: `secret-rare-${d.id}`,
      title: `${emoji} ${data.playerName} got a ${data.rarityType} card!`,
      body: `${data.playerName} discovered ${data.cardName}!`,
      date: dateStr,
      tag: 'EVENT',
    } satisfies NewsItem
  })
}

// ── Registry ─────────────────────────────────────────────────────────────────

/**
 * Fetch all news: Firestore first, local news.json as fallback.
 * Also merges jackpot win events, secret rare card wins, and Fracture
 * Chronicle chapter announcements. Firestore items take precedence over
 * local ones.
 */
export async function getAllNews(): Promise<NewsItem[]> {
  let remote: NewsItem[] = []
  let jackpotNews: NewsItem[] = []
  let secretRareNews: NewsItem[] = []
  try {
    remote = await fetchNewsFromFirestore()
  } catch (e) {
    logError('fetchNewsFromFirestore failed, using local fallback', { error: String(e) })
  }
  try {
    jackpotNews = await fetchJackpotWinsAsNews()
  } catch (e) {
    logError('fetchJackpotWinsAsNews failed', { error: String(e) })
  }
  try {
    secretRareNews = await fetchSecretRareWinsAsNews()
  } catch (e) {
    logError('fetchSecretRareWinsAsNews failed', { error: String(e) })
  }

  const remoteIds = new Set(remote.map(n => n.id))
  const local = (newsData as NewsItem[]).filter(n => !remoteIds.has(n.id))
  const chronicleNews = getChronicleNewsItems().filter(n => !remoteIds.has(n.id))
  const all = [...remote, ...jackpotNews, ...secretRareNews, ...chronicleNews, ...local]
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

/**
 * Upload an image to Cloudinary using an unsigned upload preset.
 * Returns the secure CDN URL.
 *
 * Required env vars (add to .env and GitHub Actions secrets):
 *   VITE_CLOUDINARY_CLOUD_NAME   — your Cloudinary cloud name
 *   VITE_CLOUDINARY_UPLOAD_PRESET — an unsigned upload preset name
 *
 * Create an unsigned preset at:
 *   Cloudinary Dashboard → Settings → Upload → Upload presets → Add preset
 *   (set Signing Mode to "Unsigned")
 */
export async function uploadNewsImage(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string
  const form = new FormData()
  form.append('file', file)
  form.append('upload_preset', uploadPreset)
  form.append('folder', 'news-images')
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
    const detail = body?.error?.message ?? res.statusText
    throw new Error(`Cloudinary upload failed: ${detail}`)
  }
  const data = await res.json() as { secure_url: string }
  return data.secure_url
}
