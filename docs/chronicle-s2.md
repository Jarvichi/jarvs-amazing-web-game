# The Fracture Chronicle — Season 2 Story Bible

> Authoritative design doc for Season 2 of the Fracture Chronicle (the
> biweekly meta-narrative layer — not the Act/campaign system). Read this
> before authoring any `ch{N}` entry in `chronicle.json` from ch7 onward, or
> before touching `chronicle.ts` / `ChronicleScreen.tsx` for Season 2 work.
> Mirrors the role `docs/campaign2.md` plays for Campaign 2 — this is the
> story + mechanics reference so chapters authored in separate sessions stay
> consistent.

---

## 1. Where Season 1 left off

Season 1 (`ch1`–`ch6`, closed 2026-08-20) was a read-only mystery drip: read
lore, complete a battle challenge, get a reward. No choices, no branching.
It ended having assembled the full shape of the mystery:

- Something vast — **the Custodian** — was bound beneath the Spire of Accord
  900 years ago by a five-way bargain (four provinces + a fifth, unbannered
  signatory).
- The bargain expired — sabotaged or starved, still unclear — and the
  Fracture was the collateral: the Spire's wards sang along with the chord
  instead of holding it.
- The Custodian has not left. The Fracture is a door held ajar from the
  inside. It is awake, unbound, patient, and watching.
- The missing **Accord Ledger** (last seen with Chief Archivist Veyle, bound
  for the Spire 22 days before the Fracture) holds "the terms of the next
  bargain" and hasn't been found.

Season 2 opens on that question: **what happens now that the door is open,
and who decides?** That "who decides" is the season's mechanical hook — for
the first time, the player answers it.

## 2. Why Season 2 is decision-driven

Season 1 worked as a mystery because the player was a reader, piecing
together a fixed past. Season 2 is not about a past event anymore — it's
about a live, ongoing negotiation with something that is *currently awake*.
A reader can't resolve a negotiation; only a participant can. So every
chapter puts a real choice in front of the player, and those choices
accumulate into a personal reading of how the Custodian era begins.

Two important framing decisions, given the game's actual architecture
(local-save, single-player, no authoritative live backend):

- **Player decisions are personal, not global.** Each player's choices only
  ever shape *their own* copy of the story (their alignment, their variant
  text, their epilogue). This game has no server-authoritative shared world
  state, so "your choices matter" means "your playthrough branches," the
  same way a choice-driven visual novel works — not a shared MMO world
  state.
- **A lightweight community layer is a deliberate stretch add-on, not the
  core mechanic.** See §6. It uses the same shared-Firestore pattern already
  proven by the Fruit Machine jackpot (`fruitMachineJackpot.ts`) to show
  "how the rest of the Dominion is choosing," and lets the *next
  hand-authored chapter* canonically react to the majority — but the
  authoring is still done by hand between drops, same as today. It is not
  runtime branching content generation.

## 3. Alignment tracks

Three season-scoped tracks, each a plain accumulating number starting at 0.
Every decision option nudges one or more tracks by a small weight (typically
±1 to ±2). The chapter list and finale read whichever track has the highest
absolute value as the player's "dominant" stance; a near-tie stays neutral
and gets the season's default (Vigil-leaning) text.

| Track | Represents | Thematic throughline |
|---|---|---|
| **Vigil** | Caution. Keep the door watched, not opened. Protect what's left. | Aligns with the Hollow Choir's wariness; distrust of the Custodian's intentions. |
| **Accord** | Diplomacy. Seek a *renewed*, fairer bargain through the old provincial order. | Aligns with the Archive/Veyle's instinct — negotiate, don't fight or flee. |
| **Unbinding** | Confrontation. Force the door, take the Custodian's knowledge or power directly. | Aligns with the Iron Citadel's instinct to arm and act; highest risk, highest reveal. |

These are not "good/evil" — each is a defensible read of the Season 1
mystery, and chapter text should never editorialise which is "right." Boss
framing, NPC reactions, and epilogues should treat all three as coherent
in-world factions/instincts a person could actually hold.

## 4. Decision schema

Extends `ChronicleChapterDef` (`web/src/game/chronicle.ts`,
`web/src/data/chronicle.json`) with an optional `decision` field. Chapters
without a `decision` behave exactly as Season 1 chapters do today (lore →
challenge → reward) — this keeps `ch1`–`ch6` untouched and lets a Season 2
chapter opt out of a decision if the beat doesn't call for one.

```ts
export interface ChronicleDecisionOption {
  id: string
  label: string          // short choice text, e.g. "Warn the Choir"
  consequence: string    // flavour shown immediately after picking
  alignment: Partial<Record<'vigil' | 'accord' | 'unbinding', number>>
}

export interface ChronicleDecision {
  id: string
  prompt: string          // the question posed to the player
  options: ChronicleDecisionOption[]   // 2–3 options
}

export interface ChronicleChapterDef {
  // ...existing fields unchanged...
  decision?: ChronicleDecision
}
```

Persistence (`ChronicleSave` in `chronicle.ts`) gains:

```ts
interface ChronicleSave {
  // ...existing fields unchanged...
  decisions: Record<string, string>   // chapterId -> chosen optionId
}
```

New functions:

- `recordChronicleDecision(chapterId: string, optionId: string): void` —
  writes the choice once (first pick is final; Chronicle choices are meant
  to feel permanent, same spirit as `markChapterRead`).
- `getChronicleAlignment(): Record<'vigil' | 'accord' | 'unbinding', number>`
  — sums weights across all recorded decisions.
- `getDominantAlignment(): 'vigil' | 'accord' | 'unbinding' | null` —
  highest track, or `null` on a tie/all-zero (renders as the neutral/default
  variant).

A decision, once made, is **not** replayable or changeable — consistent with
how chapter completion already works (`read` chapters stay read forever).

## 5. Branching text without new infrastructure

Reuse the Act system's existing variant-tag convention
(`variantPools` / `{pool:name:offset}`, see `docs/acts.md` §4.3–4.4) rather
than inventing a new templating mechanism. Concretely:

- A Season 2 chapter's `lore` can reference `{align:vigil}` /
  `{align:accord}` / `{align:unbinding}` blocks — resolved by picking the
  paragraph tagged for the player's current dominant track (computed from
  decisions recorded in *prior* chapters only, so a chapter never reacts to
  its own not-yet-made decision).
- Keep the branch surface small: **one paragraph per chapter** should vary
  by dominant track (typically the opening or closing paragraph
  acknowledging the player's path so far), not the whole chapter. This keeps
  authoring cost bounded — 3 short variants per chapter, not 3 full chapters.
- The chapter's own `decision.prompt` and `options[].consequence` are never
  templated — they're always the same regardless of prior alignment, so the
  choice itself stays legible.
- The challenge (`ChronicleChallenge`) may vary by the option picked *this*
  chapter (e.g. picking the Unbinding-weighted option ties the follow-up
  `win_with_tag` challenge to an aggressive-tagged card) — this needs no
  schema change, just per-chapter authoring judgement using the existing
  `win_with_tag` / `win_battles` types.

## 6. Community pulse

Mirrors the Fruit Machine jackpot's shared-Firestore pattern
(`web/src/game/chronicleVotes.ts`):

- `chronicleVotes/{chapterId}` document, shape `{ [optionId]: number }`,
  incremented via `increment()` on each player's first (final) pick for that
  chapter — fire-and-forget, same as `incrementGrandJackpot`.
- `ChronicleScreen` shows a read-only "X% of the Dominion chose this" bar
  once the player has made their own pick for that chapter (never before —
  don't let the tally influence the choice itself).
- Firestore security rules mirror the jackpot's: public read, authenticated
  write.
- This layer is additive; nothing in §4–5 depends on it.

### 6.1 Two reads, deliberately

`fetchChronicleTally` (forgiving) treats an unreachable Firestore and an
absent document alike — both render as "no data". That is correct for UI: the
player's own choice is already saved locally, so a failed tally read is
cosmetic.

`fetchChronicleTallyStrict` propagates the failure instead. **Use the strict
read anywhere the result decides story canon.** An empty tally from a failed
request is indistinguishable from a real unanimous zero, and an author —
human or automated — acting on it would be inventing votes that were never
cast.

### 6.2 The `/chronicle-status` endpoint

`web/chronicle-status.html` + `src/chronicleStatus.ts` is a second Vite entry
point that renders the live tallies as JSON in `<pre id="chronicle-status">`,
with a `data-status` attribute of `ok` or `error`. It exists so the tally can
be read from *outside* the app without copying Firebase credentials anywhere
— they stay in the shipped client, where they already are.

It is client-side rendered, so it must be loaded in a browser; `curl` returns
only the placeholder. It uses the strict read, so `status: "error"` means the
numbers are unusable — not that nobody voted.

### 6.3 Automated authoring between drops

A weekly Routine ("Chronicle: autonomous chapter author") reads that endpoint
and, when the next chapter is due, authors it with the previous chapter's
`leadingOption` as canon and pushes a branch. Its gates, which any
replacement must keep:

- **`status: "error"` → stop.** Never author against an unusable tally.
- **Next chapter not due (latest `availableFrom` more than 10 days out) →
  stop quietly.**
- **Under 10 total votes → write the chapter neutrally.** A handful of votes
  is not a mandate; the chapter still ships on cadence, but must not claim
  the Dominion chose a side.

New chapters are date-gated by `availableFrom` (14 days out), so merging one
does not expose it to players immediately — that gap is the review window.

## 7. UI changes (`ChronicleScreen.tsx`)

- After the lore paragraphs, if the chapter has a `decision` and the player
  hasn't answered it yet: render `decision.prompt` and the options as
  buttons (same visual language as campaign event choices), each showing
  `label` only until picked.
- After picking: show the chosen option's `consequence` text, disable
  further picks for that chapter, and (once §6 ships) the community bar.
- The chapter challenge section only appears/activates once the decision
  (if any) has been made — reading + deciding both gate progress, matching
  Season 1's "reading is part of completing" rule in
  `recordChronicleWin` today.
- Small season-progress affordance: a compact alignment meter (three thin
  bars for Vigil / Accord / Unbinding) somewhere in the chapter list header,
  so returning players can see their leaning at a glance. Exact placement is
  an implementation detail, not a design requirement.

## 8. Season finale

The last Season 2 chapter resolves based on `getDominantAlignment()`:

- Three distinct epilogue text variants (not just a paragraph swap — the
  finale is the one chapter that's fully written three ways).
- Three distinct reward flavors (e.g. a track-specific collectible/title),
  using the existing `ChronicleReward` types — no new reward type required.
- Each epilogue seeds a different Season 3 hook. Don't resolve the
  Custodian mystery completely; each ending should open a specific, distinct
  follow-up question rather than a generic "to be continued."

## 9. Per-chapter authoring checklist (Season 2, ch7 onward)

- [ ] `availableFrom` set, sorted correctly (chapters auto-sort by date in
      `CHRONICLE_CHAPTERS`).
- [ ] `lore` treats Season 1's ending as settled fact: the Custodian is
      awake, unbound, and watching; the Ledger is still missing. No
      contradicting Season 1.
- [ ] If the chapter has a `decision`: 2–3 options, each with a distinct
      `alignment` weighting (avoid two options nudging the same track the
      same way — that's not a real choice).
- [ ] At most one paragraph uses `{align:*}` variants; the rest of the lore
      is shared across all players.
- [ ] `challenge` reuses `win_with_tag` / `win_battles` — pick a tag that
      thematically matches the chapter's decision when possible.
- [ ] `reward` uses an existing `ChronicleReward` type.
- [ ] No NPC or faction is written as simply "evil" for holding a Vigil,
      Accord, or Unbinding position — see §3.
- [ ] Finale only: three full epilogue variants + three reward flavors (see
      §8), each seeding a distinct Season 3 hook.
