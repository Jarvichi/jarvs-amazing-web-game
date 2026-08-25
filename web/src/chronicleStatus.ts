// ─── /chronicle-status endpoint ──────────────────────────────────────────────
//
// A standalone, machine-readable view of the Fracture Chronicle's live state:
// which chapters are out, what the community voted on each decision, and which
// option is leading.
//
// Why this exists as its own page rather than a screen in the game: the
// between-drops authoring workflow (docs/chronicle-s2.md §6) needs to read the
// tally from outside the app — including from an automated session that has no
// Firebase credentials of its own. Serving it from the deployed bundle means
// the credentials stay where they already are (in the shipped client) instead
// of being copied somewhere else.
//
// Output is JSON in a <pre id="chronicle-status">, so it reads fine in a
// browser and parses in one line from a scraper. `status` is "ok" only when
// every tally was fetched; a Firestore failure reports "error" rather than
// silently rendering zeroes that a caller might mistake for real votes.

import { CHRONICLE_CHAPTERS, isChapterAvailable } from './game/chronicle'
import { fetchChronicleTallyStrict, totalVotes, leadingOption } from './game/chronicleVotes'

interface ChapterStatus {
  id: string
  title: string
  availableFrom: string
  available: boolean
  decisionId: string | null
  options: string[]
  tally: Record<string, number>
  totalVotes: number
  leadingOption: string | null
}

async function buildStatus() {
  const chapters: ChapterStatus[] = []
  let ok = true

  for (const def of CHRONICLE_CHAPTERS) {
    // Only chapters carrying a decision have a tally worth reporting.
    const decision = def.decision ?? null
    let tally: Record<string, number> = {}
    if (decision) {
      try {
        tally = await fetchChronicleTallyStrict(def.id)
      } catch {
        // Leave the tally empty but mark the whole report unusable — see the
        // note on fetchChronicleTallyStrict.
        ok = false
      }
    }
    chapters.push({
      id:            def.id,
      title:         def.title,
      availableFrom: def.availableFrom,
      available:     isChapterAvailable(def),
      decisionId:    decision?.id ?? null,
      options:       decision?.options.map(o => o.id) ?? [],
      tally,
      totalVotes:    totalVotes(tally),
      leadingOption: leadingOption(tally),
    })
  }

  return {
    status: ok ? 'ok' : 'error',
    generatedAt: new Date().toISOString(),
    chapterCount: chapters.length,
    chapters,
  }
}

async function render() {
  const el = document.getElementById('chronicle-status')
  if (!el) return
  try {
    const status = await buildStatus()
    el.textContent = JSON.stringify(status, null, 2)
    el.setAttribute('data-status', status.status)
  } catch (e) {
    el.textContent = JSON.stringify({ status: 'error', error: String(e) }, null, 2)
    el.setAttribute('data-status', 'error')
  }
}

void render()
