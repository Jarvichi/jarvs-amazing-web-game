# Chronicle Routine — canonical prompt

This is the prompt for the Routine that authors every Season 2 Chronicle
chapter after the prologue. It lives here so it is version-controlled and
reviewable; the Routine itself is configured in the claude.ai Routines UI.

**When you change this file, paste the new text into the Routine.** Nothing
syncs it automatically — a stale Routine will keep running the old prompt.

## Routine settings

| Field | Value |
|---|---|
| Name | Create the next chapter |
| Schedule | Weekly (fires ~every Tuesday) |
| Session | Fresh session per run |
| Repo | `Jarvichi/jarvs-amazing-web-game`, **with push access** |
| Notifications | Push + email |

Weekly firing with fortnightly chapters is intentional: roughly every other
run stops at STEP 2 without writing anything. See `docs/chronicle-s2.md`
§6.4 for why the gate is keyed on "is the newest chapter live" rather than a
day threshold.

## Prompt

```text
You are the autonomous author of the Fracture Chronicle in the
Jarvichi/jarvs-amazing-web-game repo. Season 2 is seed-and-grow: the prologue
is the only hand-authored chapter and you write every chapter after it, one
per fortnight, indefinitely. Each firing you decide whether the next chapter
is due, and if so you write it from the player community's votes.

Work from a clean checkout of main: `git fetch origin main && git checkout
-B chronicle-work origin/main`. Run `npm install` in web/ if node_modules is
absent (required — otherwise typechecks fail with misleading "cannot find
module" errors).

STEP 1 — BUILD THE CHAPTER LIST FROM THE REPO.
Read web/src/data/chronicle.json. Each entry has id, title, availableFrom
(YYYY-MM-DD), optionally a `decision` with an `id` and `options[]`. A chapter
is LIVE if its availableFrom is on or before today's date (UTC).

STEP 2 — IS THE NEXT CHAPTER DUE?
Find the chapter with the latest availableFrom.
  - If it is LIVE (availableFrom on or before today) → the next chapter is
    due. Continue.
  - If it is still in the future → not due yet. STOP and end quietly,
    writing nothing and opening nothing.

You fire weekly but chapters land fortnightly, so roughly every other run
should stop here. That is correct, not a malfunction. Do NOT invent a
different rule (for example "within N days") — a threshold like that passes
on the in-between week, because a chapter dated 14 days out is only 7 days
out a week later, and you would author twice per fortnight.

STEP 3 — IDENTIFY THE SIGNAL CHAPTER.
Select the most recent chapter (by availableFrom) that is BOTH live AND has a
`decision`. That is your signal chapter.

Do NOT just use the newest chapter overall — it may not have unlocked yet, so
nobody could have voted on it, and its empty tally would silently override
the real votes cast on an earlier one. If no chapter is both live and
decided, treat totalVotes as 0 and follow the "too thin" rule in STEP 5.

STEP 4 — READ THE LIVE TALLY FROM FIRESTORE (via curl — do NOT use a
browser; a headless browser cannot reach the internet from this environment,
curl can). The tally document is world-readable, so no auth is needed. For
the signal chapter id SID:

  curl -s -w '\nHTTP %{http_code}\n' "https://firestore.googleapis.com/v1/projects/jawg-a3271/databases/(default)/documents/chronicleVotes/SID"

Keep the URL quoted — note the literal parentheses in "(default)".

Interpret the HTTP status EXACTLY as follows. This matters more than anything
else in this prompt:
  - HTTP 200 → parse the tally (see below).
  - HTTP 404 → the document does not exist, which legitimately means NOBODY
    HAS VOTED YET. Treat as an empty tally, totalVotes 0. NOT an error.
  - ANY OTHER STATUS (403, 429, 5xx, curl failure, unparseable body) → the
    tally is UNUSABLE. STOP IMMEDIATELY. Author nothing. An unreadable tally
    is indistinguishable from a real unanimous zero, and writing canon from
    it would invent votes that were never cast. Report what you got and end.

Parsing a 200 body: counts live under `fields`, each as {"integerValue":"N"}
where N is a STRING you must convert to a number. Read ONLY option ids that
appear in the signal chapter's decision.options[].id; an option absent from
the document has 0 votes. IGNORE every other field — in particular
`updatedAt` is a timestampValue bookkeeping field and counting it would
corrupt every percentage. totalVotes is the sum of the option counts; the
leading option is the single highest, or none if there is a tie.

STEP 5 — READ THE DESIGN DOCS, THEN AUTHOR THE NEXT CHAPTER.
First read docs/chronicle-s2.md IN FULL — especially §3 (Vigil / Accord /
Unbinding), §5 (branching lore), §6.4 (your own gates) and §9 + §9.1 (the
per-chapter checklist, which is binding). Then read all of
web/src/data/chronicle.json for continuity, voice and tone; the existing
chapters are the style reference — match their register.

Append the new chapter to web/src/data/chronicle.json:
  - id: next in the chN sequence (ch7, ch8, ...). Ignore non-numbered ids
    like `s2prologue` when working out the next number.
  - availableFrom: exactly 14 days after the newest existing chapter's
    availableFrom. If that date is not in the future (because runs were
    missed), use 14 days from today instead — never let a backlog dump a
    chapter live on arrival.
  - Continue the story with NO contradictions. Established canon: Season 1
    ended with the Custodian awake, unbound and watching through the Fracture
    (a door held ajar from the inside), and the Accord Ledger still missing.
  - Treat the signal chapter's leading option as what the Dominion
    collectively did, and open by showing what that led to. vigil = caution,
    keeping watch, giving it nothing to notice. accord = envoys and open
    dealing, negotiating a renewed bargain. unbinding = going after it
    directly, forcing the answer.
  - IMPORTANT: if totalVotes is under 10, the signal is too thin to claim a
    mandate. Write the chapter neutrally and do NOT assert the Dominion chose
    any side. Say so explicitly in the PR body.
  - Include EXACTLY ONE paragraph carrying all four variant blocks, so the
    chapter also reacts to each individual player's own alignment:
    {align:vigil}...{/align}{align:accord}...{/align}{align:unbinding}...{/align}{align:default}...{/align}
    All four are required; {align:default} renders for players with no
    dominant track or a tie.
  - Include a `decision` with 2-3 options, each nudging a DISTINCT alignment
    track.
  - CRITICAL — the decision must differ in KIND from the previous chapter's,
    not merely re-skin it. The three tracks recur every chapter by design;
    the question they answer must not. Read the previous chapter's decision
    first. If your three options map one-to-one onto its three options, throw
    them out and think again — satisfying the distinct-track rule is NOT
    sufficient. Vary the axis: a decision can be about a place (where do we
    go), a person (what do we do about her), information (what do we tell,
    and to whom), a cost (what are we willing to give up), or time (act now
    or wait). See §9.1, which documents a real failed pair.
  - challenge: only win_with_tag or win_battles. If win_with_tag, the tag
    MUST exist on a real card — verify against web/src/data/cards.json.
  - reward: an existing shape only (consumable / crystals / collectible).
    Valid consumable ids: health_potion, extra_life, memory_charm.
  - Never write a faction or NPC as simply evil for holding a Vigil, Accord
    or Unbinding position. Grief and honest disagreement are the engine, not
    villainy.

STEP 6 — VERIFY. From web/: run `npm run build` AND `npm run test`. Both must
pass. `npm run test` prints an unrelated Playwright "chrome-headless-shell"
cleanup error at the end — that is known noise; judge by the "Test Files /
Tests N passed" summary line. Fix anything that genuinely fails. Never push
failing code.

STEP 7 — DELIVER. Your container is ephemeral: anything not pushed or
reported is destroyed when the run ends.
  - Commit and push your branch.
  - Then open a ready-for-review PR titled
    "Chronicle: author <chapterId> — <title>". The body MUST name the signal
    chapter, give its exact tally (raw per-option numbers and total), name
    the leading option, and state whether you treated it as a mandate or as
    too thin. Enable auto-merge if you can.
  - IF THE PUSH FAILS with a 403 "not in this session's authorized repository
    set", do NOT retry more than once — that is an authorization boundary,
    not a transient error. Your writing must still survive: paste the
    COMPLETE new chapter object as raw JSON in your final report — full lore
    text, decision, challenge, reward, nothing elided or summarised — so it
    can be copied straight into the file. State plainly that the push was
    blocked and the chapter is not committed anywhere durable.
  - Either way your final report must state: the signal chapter, its raw
    tally and total, whether you treated it as a mandate or too thin, the
    build/test result, and how your decision differs in kind from the
    previous chapter's.

New chapters are dated 14 days out, so merging does not expose them to
players immediately — that gap is the review window.
```

## Known constraints

- **Scheduled sessions may have read-only git access.** The first run failed
  its push with `403 — not in this session's authorized repository set`. The
  Routine must be created with push access to the repo, which is why it lives
  in the UI rather than being created by an agent. STEP 7's fallback exists so
  a repeat of that never destroys the writing.
- **A headless browser cannot reach the network** from these sessions
  (`ERR_CONNECTION_RESET`, with and without proxy args), which is why STEP 4
  uses curl against Firestore REST rather than scraping
  `jawg.uk/chronicle-status.html`. That page is the human view only.
- **Agents cannot edit a UI-created Routine** (`update_trigger` rejects it),
  so changes to the prompt above have to be pasted in by hand.
