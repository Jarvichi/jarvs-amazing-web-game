# Mini-game Design — **Cask Sounding** 🛢️

> **Status:** built — all five commits landed. §8 tracks what shipped and where
> it differs from this document. Written to the process in [`docs/minigame-brief.md`](minigame-brief.md),
> against the standard set by
> [`docs/minigame-wellspring.md`](minigame-wellspring.md).

A **deduction puzzle played in a town's cellar.** Some of the casks on the racks
have gone to vinegar. You cannot see which. You strike a cask with a mallet and
listen: a sound cask rings, and the ring tells you how many of the casks
touching it are bad. Chalk the bad ones, and the cellarer draws them off.

No clock, no dice, no way to lose. The score is how few casks you had to strike
before you knew the rest.

---

## §1 — Why this game

### The gap in the current roster

Fourteen mini-games ship today. Sorted by what each actually asks of the player:

| Demand | Games |
|---|---|
| Reflex / timing | Crystal Catch, Fishing, Harbour Regatta |
| Pure luck | Lucky Spinner, Marble Run, Marble Race, Fruit Machine, Higher or Lower |
| Luck + shallow decision | Video Poker |
| Real-time strategy | Tower Defence |
| Long-form management | City Builder, Farming Sim |
| Short-term memory | Tile Flip |
| Deterministic logic puzzle | **Wellspring** |

Every one of those is a **perfect-information** game. In all fourteen, the thing
that decides the outcome is either already on screen (Wellspring, Tower Defence,
City Builder), or has not been decided yet and never will be by reasoning
(the five luck games). Tile Flip is the only game with hidden state, and hidden
state there is a memory load, not something you can *infer* — you either
remember where the pair was or you don't.

Nothing in the roster asks the player to **work out what they cannot see.**
That is the hole: a game where information is the resource, and playing well
means choosing which question to ask.

It is also the natural companion to Wellspring rather than a repeat of it.
Wellspring is *arrange what is in front of you*; Cask Sounding is *find out what
isn't*. They share a scoring language (moves against par, no fail state) on
purpose — that is the hub's puzzle idiom now — but the thinking is a different
kind. Wellspring rewards looking. This rewards asking.

### Why sounding specifically

Five candidates were weighed:

| Candidate | Verdict |
|---|---|
| **Cask sounding** (strike a cask, learn how many bad ones touch it; chalk the rest) | ✅ **Chosen.** Generation is trivially correct — any hidden layout is a valid board. Infinite content. One-tap input. No fail state is possible, because information can always be bought. Difficulty scales on the clue vocabulary, which is the dial that changes the *reasoning*, not just the length. |
| Sonar ranging (a strike reports the *distance* to the nearest bad cask) | ❌ Ring constraints intersect beautifully on paper, but a distance reading rarely eliminates enough to make a second reading deducible — playtesting on paper degenerated into sweeping the board. Fresher, and worse. |
| Mastermind on the cask contents | ❌ Correct by construction and genuinely deductive, but it has a known optimal strategy. A player who has read about it plays it perfectly forever; one who hasn't flails. That is the Lights Out failure the Wellspring doc rejected, and it applies here unchanged. |
| Balance-scale weighing (find the short-filled cask in *n* weighings) | ❌ Same problem, worse. The whole game is one insight — ternary search — and once you have it there is nothing left. A daily puzzle cannot be a puzzle you solve once. |
| Logic-grid / ledger puzzle (deduce which cask holds what from written clues) | ❌ Uniqueness is cheap to verify at this size, so it passes constraint 2. It fails on the phone: it is a wall of text to read, it is the hardest thing in the game to localise or narrate to a screen reader, and it is a ten-minute commitment in a hub built for two-minute ones. |

The deciding property is that **this game cannot be unfair.** Minesweeper's
famous flaw is the forced guess: a position where no amount of reasoning tells
you which cell is safe, and clicking wrong ends the run. That flaw exists only
because clicking a mine is fatal. Here it isn't — a bad cask thuds, you have
learned something, and you carry on. So every board is finishable by anyone, and
the generator needs no solver-in-the-loop to certify it. Skill shows up in the
*score*, not in whether you finish.

### Why it belongs in this world

The hub already has a cider house, a cooper's shed, a bottling barn and a
brewery's worth of barrels standing in the street doing nothing (§5). "Half the
cellar has turned and nobody knows which half" is a problem a town would
genuinely have, and "Jarv turns up and sorts out something the town has been
putting off" is the shape of every hub interaction there is.

---

## §2 — Core rules

### The cellar

A rack of casks laid out on a grid. Each cask is either **sound** or **soured**.
Which is which is fixed when the board is generated and hidden from the player.

Three things are given for free before you start:

- **Rack counts** — for a *row* of the rack, how many of its casks are soured,
  chalked on the rack end. On the top tier the ledger is incomplete and most
  rows carry no figure at all (§4) — that is where its difficulty comes from.
- **The soured total.** The first thing the cellarer tells you. With every row
  counted this is implied anyway; with rows missing it is not, so it is stated.
- **One pre-struck sound cask**, the cellarer's own mark, so there is always
  somewhere to reason from on the first look. It costs the player nothing.

Column counts are deliberately **not** given, at any tier. §3 explains why: with
both axes the board solves itself.

### The two verbs

A segmented control switches which one a tap does. It is the only mode in the
game and it is always visible.

| Verb | Tap does | Costs |
|---|---|---|
| 🔨 **Sound** | Strikes the cask. A sound cask rings and shows **how many of its 8 neighbours are soured**. A soured cask thuds and is revealed as soured. | **1 sounding** |
| ✕ **Chalk** | Marks a cask soured. If it was in fact sound, the chalk rubs off, the cask is revealed sound, and you have learned that the expensive way. | **0** if right, **+3 soundings** if wrong |

Chalking is free when you are right, which is the whole economy: **the game
wants you to deduce rather than strike, and never charges you for knowing
something.** Striking every cask is always available and always allowed — it
just scores badly (§ scoring). Chalk-spamming to reveal the board costs 3× what
striking costs, so it is strictly worse than the brute-force it would replace.

### Win condition

> **Every soured cask is chalked** (or was struck, which identifies it too).

Sound casks need no action at all. That is the whole of it: you are not clearing
a rack, you are naming the bad ones, and the game ends the moment you have named
them all.

This is a correction to an earlier draft, and it matters more than it looks.
The first version had the board auto-resolve every cask the moment it became
logically forced, to kill Minesweeper's endgame busywork. But the solver that
decides "forced" is exhaustive, so **anything the player could deduce, it has
already deduced** — every bad cask would be chalked for them the instant it
became knowable, and the chalk verb would be dead on arrival. What remained
would be a game about choosing which cask to strike, with the deduction played
by the machine. That is not the game in §1.

Making the goal *only* the soured casks solves the busywork problem outright
instead: there is no rack to clear, so there is nothing to auto-clear. The
player does the deducing, chalk is the primary verb, and striking is what you
buy when you cannot work it out.

There is no submit button, no failure state, and no way to be locked out of
finishing.

### Scoring

| Term | Meaning |
|---|---|
| **Par** | What the reference solver spends on this board (§3). Shown from the start. |
| **Soundings** | What you actually spent, including +3 per bad chalk. |
| **Listen** | Optional hint: names one cask's state outright. Costs **+3 soundings**, never crystals. |

```
efficiency = clamp(par / soundings, 0.4, 1.0)
crystals   = round(tierCrystalBase × efficiency)
           + (soundings < par ? UNDER_PAR_CRYSTALS : 0)
```

Identical in shape to Wellspring's, on purpose — two puzzles in the same hub
should not score in two different languages. The 0.4 floor means a player who
brute-forces the whole rack still gets paid, but less than someone who solved an
easier cellar cleanly.

### What is deliberately absent

- **No clock.** Same reason as Wellspring: it converts a thinking game into a
  panicking one, and the roster has four timed games already.
- **No fatal cask.** The single change that makes this fair by construction.
- **No sounding cap.** Going over par costs crystals; it never ends the run.
- **No arcade cabinet.** It is reached through a town's cellar and nowhere else.
  `MiniGameId`, `economy.json`'s `miniGameCosts` and `miniGameDailyChallenge.ts`
  will not know it exists.

---

## §3 — Generation, par, and correctness

### Generating a board

1. Choose the tier's grid and gap pattern.
2. Scatter `K` soured casks uniformly at random over the non-gap cells.
3. Compute the row counts. Reveal one random **sound** cask as the opening.
4. Compute par (below). Reject and re-roll if par is below the tier's floor —
   an already-solved rack is not a puzzle.

That is the whole generator. There is nothing to certify, because **every layout
is a valid board**: the player can always strike, so the position is always
finishable. This is a materially smaller correctness surface than Wellspring's
three spanning-tree algorithms, and it is the main reason to prefer this
mechanic over the alternatives in §1.

### Computing par

Par is what a **reference solver** spends, defined as:

1. Enumerate every hidden layout consistent with the row counts and the readings
   so far. A cask is *forced* when it has the same state in all of them.
2. If every **soured** cask is forced-soured, stop — the player can chalk the
   rest for free from here, so no further strike is needed. Note this is a
   weaker stopping condition than "the whole board is determined": undetermined
   *sound* casks are fine, because nothing has to be done to them. Par is lower
   than it would be under the earlier draft's win condition, and §4's measured
   figures are re-measured against this rule in commit 1.
3. Otherwise strike the cask whose **reading distribution has the highest
   entropy** over that solution set — the question whose answer you can predict
   least — and go to 1.

Par is exact for that strategy and reproducible from the seed. It is not a proven
optimum over all adaptive strategies (computing that is a game-tree minimax over
hidden states, and is not worth it), which means **under par is reachable** by a
player who picks a better question than the reference did. That is the same
bargain Wellspring struck, and it is what makes the under-par bonus live content
rather than decoration.

### What the measurements changed

The design originally gave **both** row and column counts, on the theory that
more free information meant a friendlier puzzle. Measured over 200 boards with a
prototype of the generator and reference solver above:

| Free clues | Grid | Soured | Median par | Range |
|---|---|---|---|---|
| Rows **and** columns | 5×5 | 6 | **2** | 0–5 |
| Rows **and** columns | 6×6 | 11 | **5** | 1–8 |
| Rows only | 5×5 | 6 | **6** | 3–8 |
| Rows only | 6×6 | 11 | **9** | 5–12 |
| Rows only | 6×6 | 14 | **10** | 5–14 |
| Rows only | 7×7 | 17 | **14** | 10–18 |

With both axes the board is essentially solved before the player touches it —
a median of two strikes on a 25-cask rack, and boards that arrive already
finished. Column counts came out. This is exactly the kind of thing the brief
means by *measure, don't estimate*: the "friendlier" version was not easier, it
was **over**.

### Correctness risks worth naming up front

| Risk | Mitigation |
|---|---|
| **Solution enumeration blows up.** The forced-cask check enumerates layouts consistent with the row counts. Early in a board that set is enormous, and it is recomputed after every tap. Measured in the Python prototype: 13 ms/board at 5×5, 940 ms at 6×6, 4.9 s at 7×7 — roughly an order of magnitude per step up. | Enumerate row-by-row over `C(width, rowCount)` placements with the readings pruning each row as it is laid — the prototype's approach, which is what keeps 5×5 cheap. In TypeScript over bitmasks this should be several times faster again, and it runs once per tap, not per frame. A hard solution cap with a documented fallback (propagate-only, which under-resolves rather than mis-resolves) keeps the worst case bounded. **This is the one number that decides the tier ceiling** — §4's top tier is 6×6, not 7×7, for this reason, and the real budget gets measured in commit 1 before any UI exists. |
| **The exhaustive solver out-deduces the player.** Enumeration spots deductions no human would see. | **Resolved by removing auto-resolve entirely** (§2). The solver now runs in exactly two places, neither of them player-facing: computing par at generation time, and deciding when the reference solver may stop striking. Nothing it deduces is ever shown or acted on during play. |
| **Par is computed from a strategy, not an optimum.** If the reference solver is weak, par inflates and under-par becomes free. If it is too strong, under-par becomes unreachable. | Measure the distribution per tier over ≥400 boards and report it, as above. Test that replaying the reference solver's own choices through the real game engine spends exactly par. |
| **Wrong-chalk pricing leaks information cheaply.** At +3 a bad chalk is a paid probe; if the price were 1 it would be a free one. | Priced at 3× a strike, matching Wellspring's Dowse. Unit-test that the cheapest path to full information is always striking, never chalking. |
| **The "resolved" check written as a comparison against the stored layout.** | Test that the resolve pass still behaves after the stored layout is scrubbed to garbage — proof it reads only the readings in front of it. Wellspring has the same test and it earned its place there. |

---

## §4 — Difficulty

Chosen diegetically: **whose cellar you have been let into.** Each is a
different board, not a modifier on the same one.

| | **Tap Room** | **Cellar** | **Vintner's Vault** |
|---|---|---|---|
| Rack | 5 × 5 | 6 × 6 | 6 × 6 |
| Soured casks | 6 | 11 | 14 |
| Empty rack slots | — | — | 5 |
| Rows the ledger counts | all 5 | all 6 | **2 of 6** |
| Soured total given | yes | yes | yes |
| **Measured par** | med 5 (3–8) | med 9 (5–13) | med 12 (8–15) |
| Generation cost | 3 ms | 184 ms | 423 ms |
| Crystal base | 30 | 60 | 110 |
| Cask Vinegar | 1 | 2 | 3 |
| Solve time | ~1 min | ~2–3 min | ~4 min |

Par figures are measured from the **shipped generator** over 120–200 boards per
tier, not estimated. The crystal bases are derived from them. Re-measure on any
change to a tier's shape.

**The Vault had to be rebuilt after measuring.** As first designed — density up
from 11 soured casks to 14, plus 5 gaps — it came out at *exactly* the Cellar's
difficulty: median par 9, range 5–13, indistinguishable. Gaps remove casks, and
that cancelled the density rise almost precisely. Since the top tier pays nearly
double, a tier that is only nominally harder is a real problem, so the Vault now
takes rows off the ledger instead — the §4 knob ranked first. Sweeping that dial
on the same geometry:

| Rows hidden | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| Median par | 9 | 9 | 10 | 11 | 12 |
| Minimum par | 5 | 5 | 4 | 6 | 8 |
| Generation cost | 110 ms | 140 ms | 206 ms | 308 ms | 423 ms |

Four hidden rows is the shipped setting: it separates the Vault from the Cellar
properly (median 12 against 9) and its *minimum* of 8 means no Vault board can
arrive a pushover, which matters more at the top tier than the median does.

### The knobs, ranked by how much they actually add

1. **Free-clue vocabulary** *(the real dial)*. This is the finding of §3 and it
   dwarfs everything else: adding column counts to a 6×6 took median par from 9
   to 5 and sometimes to zero. What the player is *given* determines what kind
   of reasoning is available, and it moves difficulty further and faster than
   any amount of board.
2. **Soured density** *(weaker than expected — measured)*. The theory was that
   density near half is hardest, because every reading splits the space closest
   to evenly. Measured on a 6×6, going from 11 soured casks (31%) to 14 (39%)
   moved median par from 9 only to 10. Sparse racks resolve in cascades, dense
   racks resolve by the row counts, and the middle is not much worse than
   either. Density is a real dial but a shallow one, so it is used to separate
   adjacent tiers rather than to carry the difficulty curve. Worth re-measuring
   nearer 50% before leaning on it further.
3. **Gaps in the rack** *(seasoning, and the anti-memorisation lever)*. Missing
   slots break the uniform 8-neighbourhood, so the handful of patterns an
   experienced player recognises stop applying and they have to read the rack
   again. Mild on its own; valuable because it keeps the top tier from becoming
   pattern-matching.
4. **Grid size** *(the volume knob, and the expensive one)*. Par grows roughly
   linearly with area — measured, 5×5 → 6×6 → 7×7 gives median par 6 → 9 → 14.
   It makes a board *longer*, not harder. It is also the thing that makes the
   solver slow, and that cost grows about an order of magnitude per step
   (13 ms → 940 ms → 4.9 s per board), so size has by far the worst ratio of
   interest to cost of any knob here. Hence a 6×6 ceiling: the top tier grows
   density and gaps instead of size.

### Rejected as difficulty levers

- **A clock.** Converts the genre. Covered in §2.
- **A hard sounding cap that fails the run.** Punishes exploration, which is how
  people learn a puzzle. The crystal floor already does this job gently.
- **Hiding the row counts.** Without them there is no anchor at all and the only
  strategy is to strike everything — it removes deduction rather than deepening
  it.
- **A fatal cask.** Named again because it is the obvious "make it harder" move
  and it is the one thing that would make the game unfair. It stays out.

---

## §5 — Hub-world integration

### The affordance: the barrels

Surveyed across all 13 town `config.json` files, counting every `exteriorDecor`
tile and cross-checking which are already claimed by an interactable:

| Decor tile | Unclaimed tiles | Towns present | Already claimed by |
|---|---|---|---|
| **`barrel`** | **79** | **12 / 13** | — nothing |
| `sack` | 25 | 11 | — |
| `smallRock` | 65 | 8 | — |
| `crate` | 53 | 8 | — |
| `logPile` | 15 | 8 | forage (2 tiles, Thornwood) |
| `stoneWell` | 0 | 13 | **Wellspring** |
| tree bundles | ~300 | 7 | forage |

`barrel` is the best-covered unclaimed tile in the game — better coverage than
`stoneWell` had (10/13) when Wellspring claimed it. Only **Dreadspire Citadel**
has none, and giving it one uses the existing `barrel` chip, so **no new art is
required anywhere.**

Per town, one barrel becomes the cellar hatch:

| Town | Barrels | Proposed tier | Note |
|---|---|---|---|
| Appleford | 7 | Tap Room | by the cider house |
| Capital City | 9 | Vintner's Vault | |
| Dreadspire Citadel | 0 → **add 1** | Vintner's Vault | |
| Gearford | 18 | Cellar | |
| Gravemoor | 1 | Vintner's Vault | |
| Harrowfield | 4 | Tap Room | |
| Hollowmere | 4 | Tap Room | |
| Ironhold Keep | 7 | Cellar | |
| Millhaven | 7 | Cellar | |
| Ravenwatch | 4 | Cellar | |
| Royal Palace | 3 | Vintner's Vault | |
| Saltmere Port | 14 | Cellar | |
| Thornwood Camp | 1 | Tap Room | |

Tier per town gives places character and gives the world map a reason to exist:
the deepest cellars and the best payouts are somewhere else.

### How the tap is wired

No new engine mechanism. An ordinary interactable over the existing barrel decor,
exactly as Wellspring's well sits on its `stoneWell`:

```jsonc
{
  "id": "millhaven-casks",
  "tx": 28, "ty": 4,
  "hitRect": { "w": 1, "h": 1 },
  "reactions": [
    { "type": "dialogue", "text": "Half the cellar's turned, by the smell of it. Nobody's had the ear to find out which half." },
    { "type": "screen", "screen": "hub-casks-cellar" }
  ]
}
```

The tier rides in the screen id — `hub-casks`, `hub-casks-cellar`,
`hub-casks-vault` — which is how fishing carries its locale variants and how
Wellspring carries its depths.

### The cellarer

Scenery is easy to walk past, and this barrel is the only door into the game.
So each town's cask barrel gets a `<town>-cellarer` NPC beside it, with
proximity dialogue that changes with state — matched by id suffix
(`endsWith('-cellarer')`) exactly like `-well-keeper`, so giving a new town a
cellar needs no code change:

| Player state | At 8 tiles | At 4 tiles |
|---|---|---|
| No mallet | *"Smell that? Something's turned down there."* | *"I'd know a sour cask by the ring of it, if I had the ear. A cooper's mallet would do it — Appleford's cooper sells them."* |
| Has the mallet, cellar unsorted | *"Smell that? Something's turned down there."* | *"You've a mallet on you. Go and tell me which of them are bad."* |
| Already sorted today | *"Cellar's honest again, thanks to you."* | *"Drawn off the bad ones this morning. Come back tomorrow, it'll have turned again — it always does."* |

Each is flavoured to its town, so tapping one is worth doing on its own.

### Gating

Both gates are copied from mechanisms already in the codebase:

1. **The Cooper's Mallet** — a one-time tool purchase, mirroring the fishing rod
   and the winding crank. Sold via `buyHubItem` in **Appleford's cooper's shed**
   (`coopers-shed` is already an interior there, next to the cider house and the
   bottling barn — the one place in the hub where a cask mallet obviously comes
   from). Checked in `HubWorld.tsx`'s `handleNodeInteract` with the same
   `screen.startsWith('hub-casks')` shape the rod and crank checks already use.
2. **Once per town per real day** — `game/hub/casks.ts`, a direct copy of
   `wellsprings.ts` / `digs.ts` (`interactableStoreKey(town, 'casks')` →
   `YYYY-MM-DD`). Thirteen cellars on a daily cooldown is a reason to travel;
   a per-attempt consumable would just be friction on a five-minute puzzle.

### Rewards

| Reward | Amount | Lands in |
|---|---|---|
| **Cask Vinegar** (new `material` hub-item) | 1 / 2 / 3 by tier | **Chef cooking** — a real ingredient in `chefRecipes.json`, not a dead-end collectible |
| Crystals | tier base × efficiency | the global crystal economy |
| **Town reputation** | +1 | `addTownReputation` → building upgrades and unlocked services |
| Under par | +25 crystals | |

Cask Vinegar is drawn off the casks you correctly identified, which is why the
cellarer wants them found — the reward *is* the fiction. Reputation is the
load-bearing one for the same reason it was in Wellspring: standing has few
repeatable sources, and a second daily faucet across thirteen towns strengthens
a loop the hub only just acquired.

Achievements: first cellar sorted, an under-par sort, all thirteen towns,
three Vintner's Vaults.

---

## §6 — UI design

Portrait-first, inside the existing 740px column. The rack is square and sized
`min(100vw − 32px, 420px)`, so a 6×6 cask stays a comfortable ~64px tap target.

```
┌─────────────────────────────────────────────┐
│ 🛢️ CASK SOUNDING     Soundings 7 · Par 9    │  MinigameShell
├─────────────────────────────────────────────┤
│              Millhaven — The Cellar          │  caption: whose cellar
├─────────────────────────────────────────────┤
│        ╔═════════════════════════╗          │
│    2 ▸ ║  ▓   ·   ·   ✕   ·   ▓  ║          │  RackBoard
│    0 ▸ ║  ·   1   ·   ·   2   ·  ║          │  row counts down the left
│    3 ▸ ║  ✕   ·   ▓   ·   ·   ·  ║          │  ▓ struck-soured  ✕ chalked
│    1 ▸ ║  ·   ·   ·   3   ·   ·  ║          │  n rung, n bad neighbours
│    3 ▸ ║  ·   2   ·   ·   ·   ·  ║          │  · unresolved
│    2 ▸ ║  ·   ·   ·   ·   1   ·  ║          │
│        ╚═════════════════════════╝          │
├─────────────────────────────────────────────┤
│  Soured 11 · chalked 4 · 18 casks unread    │  RackStatusBar
├─────────────────────────────────────────────┤
│   [ 🔨 SOUND ][ ✕ CHALK ]   [ 👂 LISTEN −3 ]│  segmented + action-btn
└─────────────────────────────────────────────┘
```

### Cask states

| State | Treatment |
|---|---|
| Unresolved | Oak cask face, banded, on a recessed rack socket. Tappable. |
| Rung (sound) | Cask fades back into the rack; its number sits proud in `--accent-blue`. |
| Struck soured | Cask goes dark and stained, a slow drip at the rim. |
| Chalked | Sound oak with a chalk ✕ scrawled across it, slightly off-square. Not tappable again — a chalk that stayed on is correct by definition, since a wrong one rubs itself off immediately, so there is nothing to undo. |
| Bad chalk | Chalk wipes off, cask rings sound, and the socket flashes ember. |

**The two named states share their glyph.** A struck-bad cask and a chalked one
are the same fact — soured, and named by the player — so both wear the ✕, and
only the material differs: chalk on sound oak for one deduced, an ember brand on
a stained body for one that cost a sounding. They were first drawn as unrelated
glyphs (a chalk cross against a green drip) and a screenshot killed it: the rack
read as two separate categories, the drip read as a lollipop rather than a drip,
and a struck cask was so dark it disappeared into its socket. Category first,
provenance second, is the rule that fixed it.
| Empty slot (Vault) | Open rack, no cask, not tappable, `aria-hidden`. |

### Motion

- **Strike:** 150 ms shake of the cask only, not the socket, and a ring of dust
  off the casks it names — so the reading and its subjects are visually linked.
- **Press feedback:** `filter: brightness(1.35)`. Per `AGENTS.md`, cells in a
  fixed grid must **not** use `translateY` — one cell moving while its neighbours
  hold still reads as a layout glitch. `:active` alongside `:hover` is mandatory;
  `pressFeedback.test.ts` fails the build otherwise.
- **Solve:** the rack lights row by row, the bad casks roll out, one pulse, then
  `MinigameResultPanel`.
- All of it behind `prefers-reduced-motion`: the reduced path drops the stagger
  to an instant resolve and the strike to a colour change.
- No `@keyframes` on an SVG geometry property (`r`, `cx`) — silently does nothing
  in WebKit, which the suite runs. `transform`/`opacity` with an explicit
  `transform-box` only.

### Accessibility

Each cask is a real `<button>` describing itself — *"Row 3, cask 2: unresolved.
Sound mode: activate to strike."* — with `aria-live` announcements when a strike
forces a cascade (*"four casks resolved"*) and when the last cask resolves. The
row counts are `<th scope="row">`, so the rack reads as the table it is. This is
free with a DOM board and would need a hand-built shadow grid over a canvas,
which drives the renderer decision below.

---

## §7 — Renderer: DOM, and why

**DOM + inline SVG, not PixiJS** — the same documented deviation Wellspring made,
for the same reasons, which apply here more strongly if anything:

- `AGENTS.md`'s framework table sends tile grids to PixiJS, but its stated
  rationale is grids with **moving entities and sprite animation**. This is at
  most 36 static casks that occasionally change state.
- Keyboard focus, screen-reader labels and `:focus-visible` come free on DOM and
  would need a parallel invisible button grid over a canvas.
- The cascade is a CSS stagger. There is no particle budget to justify Pixi.
- DOM cells are directly testable and inspectable per component in Storybook,
  which is what the component-extraction rule asks for.

---

## §8 — Commit plan

Each commit independently green (`npm run build` + `npm run test`), pushed as it
lands. PR opened when the first code lands.

**1 — Pure logic, no UI, no React.**
`components/minigames/CaskSounding.logic.ts` — board model, generator, reading
function, the enumerating solver and its forced-cask pass, the reference solver
and exact par, chalk/strike/listen transitions, scoring.
`data/caskTiers.json` — the §4 table as config, per the constants-vs-JSON rule.
`CaskSounding.logic.test.ts` — generation terminates and every board finishes;
par matches an honest replay of the reference solver; the resolve pass ignores
the stored layout; striking is always cheaper than chalk-probing; row counts are
consistent; gap cells never carry a cask.
**Landed.** The §3 performance risk resolved in the shipped TypeScript: 3 ms /
184 ms / 423 ms per board by tier, against the Python prototype's 940 ms at 6×6.
That is a once-per-board cost paid when the player opens the cellar, not per
tap, so the 6×6 ceiling holds comfortably. The par distributions measured here
corrected §4's table and forced the Vault rebuild described there.

**2 — Board components + styling.**
`caskSounding/CaskTile.tsx`, `RackBoard.tsx`, `RackStatusBar.tsx`, each with a
`.stories.tsx` covering every §6 state. `styles/minigames-6.css` +
`index.css` import. Reuse `action-btn`, `Button`, `Panel`, `MinigameShell`,
`MinigameResultPanel` before adding anything. Screenshot the stories and
DOM-measure the rack geometry per `docs/ui-design.md`.

**3 — The screen.** `CaskSounding.tsx` + story: orchestration, `onDone(result)`,
a `tier` prop set by the town. No tier picker — there is one way in.
`game/achievements.ts` entries.

**4 — Hub wiring.** ✅ Landed. `app/screens.ts`, `app/lazyScreens.ts`,
`app/routes/HubRoutes.tsx` (three routes + the reward grant),
`components/hub/HubWorld.tsx` (`SCREEN_ENTER_LABEL`, the mallet + daily gate
beside the existing rod/crank gates, cellarer proximity dialogue by id suffix),
`game/hub/casks.ts` + test, `data/hubItems.json` (`coopers-mallet`,
`cask-vinegar`). `CaskSoundingResult` gained `misread`, which the clean-sort
achievement needs and only the screen knew.

**5 — Town data + docs.** ✅ Landed. A cask interactable and a cellarer in all
thirteen towns at the §5 tier, a `barrel` for Dreadspire (19,33 — the one town
with none), the mallet on Appleford's cooper's shelf at 85 crystals, and
`caskPlacement.test.ts` guarding the entrance everywhere.

Placements were chosen by script rather than by eye: free `barrel` tiles
cross-checked against every interactable, NPC and animal tile, with the cellarer
put on the nearest free street tile within 2. Royal Palace was the one town with
no street tile in range, so its cellarer stands on a free courtyard tile
instead. The first pass also produced seven collisions the script could not see
— a cellarer and a well keeper sharing a sprite in four towns, and names echoing
each other in three (Gravemoor had *two* sextons, Thornwood *two* camp cooks).
Two of the placement test's assertions exist because of that pass.

`docs/hubworld.md` gained an authoring checklist for a puzzle entrance, written
to cover the well and the cellar together, since the two are now the pattern.
It documents what Wellspring's own commit 5 claimed to add and never did.

### Where the build departed from this document

- **Auto-resolve was cut** and the win condition narrowed (§2).
- **The Vault was rebuilt** around hidden row counts after measurement (§4).
- **The two named cask states were unified** on one glyph after a screenshot
  showed them reading as separate categories (§6).
- **A `0` reading is no longer the quietest mark on the rack.** It was styled as
  a dim all-clear and turned out to be the least legible thing on a played
  board, which is backwards for one of the strongest deductions in the game.
- **Par is not computed at first paint.** The rack is laid in an effect so the
  cellar-steps line paints first; a Vault board costs ~0.4s here and several
  times that on a low-end phone.

### Decisions taken

1. **Auto-resolve: cut entirely**, and the win condition narrowed to *chalk every
   soured cask* (§2). The exhaustive solver would have out-deduced the player on
   every board and left the chalk verb with nothing to do. It now runs only at
   generation time, for par.
2. **Tier names:** Tap Room / Cellar / Vintner's Vault, assigned per town in §5.
3. **Cask Vinegar** as the material reward, landing in chef cooking.
