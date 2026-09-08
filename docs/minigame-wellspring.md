# Mini-game Design — **Wellspring** 💧

> **Status:** built. §8 tracks what landed. Wellspring is reached **only
> through the hub world** — a town's well, not an arcade cabinet.

A deterministic **conduit-routing puzzle** played at a town's stone well.
Rotate the broken aqueduct sections beneath the well until water runs from the
spring to every basin with nothing spilling. No timer, no reflexes, no luck —
you look, you think, you solve, and the score is how few taps it took you.

---

## §1 — Why this game

### The gap in the current roster

Thirteen mini-games ship today. Sorted by what they actually ask of the player:

| Demand | Games |
|---|---|
| Reflex / timing | Crystal Catch, Fishing, Harbour Regatta |
| Pure luck | Lucky Spinner, Marble Run, Marble Race, Fruit Machine, Higher or Lower |
| Luck + shallow decision | Video Poker |
| Real-time strategy | Tower Defence |
| Long-form management | City Builder, Farming Sim |
| Short-term memory | Tile Flip |

Nothing in that list is a **deterministic logic puzzle**. Every game either
runs on a clock or resolves on a dice roll. Tile Flip is the closest thing to
a "brain" game and it is a memory drill, not a puzzle — there is nothing to
reason about, only something to remember.

That leaves an obvious hole: a game you can play **slowly**, that rewards
looking before touching, that has one correct answer and no clock pushing you
toward it. It is also the only kind of mini-game that reads well on a phone
during a two-minute gap, which is most of when this game is played.

### Why a conduit-routing puzzle specifically

Four candidates were considered:

| Candidate | Verdict |
|---|---|
| **Conduit routing** (rotate pipe tiles to connect a network) | ✅ **Chosen.** Generation is provably correct, difficulty scales on four independent axes, one-tap input, and the "water floods the network" payoff is a genuinely satisfying win animation. |
| Sokoban (push crates onto marks) | ❌ Generating *good* Sokoban levels is a research problem, not a sprint. Hand-authoring means a finite content pile that runs dry. Undo/reset friction is high on touch. |
| Nonogram / picross | ❌ Needs a *uniquely-solvable* generator (hard) and a grid dense enough to be interesting is too small to tap accurately on a phone. Also a 10-minute commitment, not a two-minute one. |
| Lights Out (toggle grid) | ❌ Trivially generatable, but solving it is linear algebra over GF(2) — players either know the trick or flail. Bad difficulty curve, no "aha". |

Conduit routing wins on the thing that matters most for a live game: **it never
runs out of content and it can never generate an unsolvable board**, because
the board is generated *from* its solution.

### Why it belongs in this world

The lore is the Fracture Event — a Dominion that shattered and left its
infrastructure broken across the shards. An aqueduct network that no longer
carries water is exactly what that world looks like at ground level, and
"Jarv turns up in a town and fixes something that was broken" is already the
shape of every hub questline.

---

## §2 — Core rules

### The board

A square grid of cells. Every cell holds one **conduit piece**, modelled as a
4-bit mask over its open sides (N=1, E=2, S=4, W=8):

| Piece | Mask shape | Distinct orientations | Tap cycles through |
|---|---|---|---|
| **Cap** ╹ | 1 side | 4 | 4 |
| **Elbow** ┗ | 2 adjacent | 4 | 4 |
| **Straight** ┃ | 2 opposite | 2 | 2 |
| **Tee** ┣ | 3 sides | 4 | 4 |
| **Cross** ╋ | 4 sides | 1 | — (never rotatable) |

One cell is the **Source** — the spring itself. It is fixed and cannot be
rotated. Some cap cells are dressed as **Basins**: stone bowls that visibly
fill when water reaches them. Basins are the fiction and the payoff; they are
not a separate win condition (see below).

### Input

**Tap a cell → it rotates 90° clockwise.** That is the entire control scheme.
No drag, no long-press, no second gesture, no counter-clockwise button — four
taps returns any piece to where it started, and a one-verb game is a game that
needs no tutorial. Crosses are visually distinct and inert; tapping one does
nothing and costs nothing.

### Win condition

> **Every conduit carries water, and nothing spills.**

Formally, flood-fill outward from the Source across **mutual** connections
(cell A's east bit set *and* cell B's west bit set). The board is solved when:

1. the fill reaches **every** cell, and
2. no reached cell has an open side facing a neighbour that does not open back
   — or facing off the edge of the board. Each of those is a **leak**.

Because the generator lays the network out as a spanning tree over every cell
(§3), a solution always exists that satisfies both. Basins fill as a
consequence of (1), which is why they need no rule of their own.

**The solved check is a flood-fill, never a comparison against the stored
solution.** If a board happens to admit a second valid arrangement, the player
gets credit for it. This matters — it is what makes finishing under par
possible at all.

### Live feedback is the tutorial

Water is simulated continuously as you play, not on submit:

- Pipes carrying water are **lit and flowing**; dry pipes are grey stone.
- Every leaking end **visibly sprays**.
- Basins **fill up** as they connect.

So the board always tells you exactly how close you are without a word of UI
text, and a new player learns the rules by touching things. There is no
"check my answer" button because there is nothing to check.

### Scoring

| Term | Meaning |
|---|---|
| **Par** | The minimum taps needed to undo the scramble (computed exactly — see §3). Shown from the start. |
| **Moves** | Taps the player actually spent. |
| **Dowse** | Optional hint: snaps one cell into place. Costs **+3 moves**, never crystals. |

```
efficiency = clamp(par / moves, 0.4, 1.0)
crystals   = round(depthCrystalBase × efficiency)
           + (moves < par ? UNDER_PAR_CRYSTALS : 0)
```

Plus the depth's clean water and one point of town standing. A sloppy solve
still pays 40% — the floor exists so that brute-forcing a hard board is
*worse* than solving an easy one cleanly, but never worthless. There is no
failure state and no way to be locked out of finishing.

### What is deliberately absent

- **No countdown.** A clock turns a thinking game into a panicking game, and
  it is the single fastest way to make this indistinguishable from Crystal
  Catch. The roster has four timed games already.
- **No hard move cap.** Going over par costs crystals. It never ends the run.
- **No randomised outcomes.** Every board has a known-good answer. This is the
  only mini-game where the player's result is entirely their own doing, and
  that is the point of adding it.
- **No arcade cabinet.** Wellspring is not in the mini-games menu, has no
  crystal entry fee, no ticket payout, no leaderboard and no daily
  ticket-challenge. It exists where it makes sense in the fiction — at the
  bottom of a town's well — and nowhere else.

---

## §3 — Generation, par, and correctness

### Generating a board

1. **Lay a spanning tree** over the grid graph (all `w × h` cells; edges wrap
   around the borders in torus mode). The tree's shape *is* the piece mix, so
   each depth picks a different algorithm rather than filtering one:

   | `treeStyle` | Algorithm | Max degree | Pieces it yields |
   |---|---|---|---|
   | `path` | Backbite Hamiltonian path | 2 | caps, elbows, straights |
   | `sparse` | Randomised DFS, degree-capped at 3 | 3 | + tees |
   | `dense` | Randomised Prim, uncapped | 4 | + crosses |

   DFS produces long snaking corridors that read as plausible plumbing; Prim
   branches far more freely, which is what actually puts crosses and tees on
   the board. Backbite is chosen over a self-avoiding random walk because
   every backbite step yields *another* valid Hamiltonian path — so it always
   terminates with a usable result instead of dead-ending and retrying.
2. **Derive the pieces.** Each cell's mask is the union of its tree edges. A
   tree gives every cell at least one edge, so there are no orphans, and it
   has no cycles, so there are no ambiguous loops.
3. **Place the Source** at the tree root (constrained to a border cell when
   not in torus mode, so the spring reads as coming from outside; on a `path`
   board it has to be one of the two path endpoints).
4. **Dress the deepest leaves as Basins** — the tier's basin count, chosen
   from the leaves furthest from the root by tree distance.
5. **Weld and seize** the tier's counts, drawn only from cells that can
   actually turn — a welded cross would be a mark the player can never read.
6. **Scramble.** Rotate each rotatable cell by a uniform random amount in
   `[0, period)`, where `period` is 4 for caps/elbows/tees, 2 for straights
   and 1 for crosses. The Source and any welded cell are never scrambled.

Solvability is guaranteed by construction — the unscrambled board *is* a
solution — so no solver is needed at generation time. A scramble that happens
to leave every piece already correct is rejected and regenerated, so the
player is never handed a solved board.

### Computing par exactly

```
par = Σ over rotatable cells of  (solutionRot − scrambledRot) mod period
```

Using the piece's **rotational period** rather than a flat 4 is the whole
trick. A straight pipe is at most 1 tap from correct, never 3; a cross is
always 0. Get this wrong and par inflates by roughly 40%, "under par" becomes
unreachable, and the bonus is dead content. This gets its own unit test.

Par is the distance to *the generated* solution. Where a board admits an
alternative arrangement, the true optimum can be lower — which is exactly what
the under-par bonus is for. It should be rare, and it should feel like a find.

### Correctness risks worth naming up front

| Risk | Mitigation |
|---|---|
| **Degree-capped tree generation can dead-end.** At cap 2 the tree must be a Hamiltonian path, which randomised DFS will not always find. | Backbite from a boustrophedon start handles cap 2 without a retry loop at all. Capped DFS (cap 3) *can* strand a cell, so it retries 60 times and then falls back to uncapped DFS, which always spans — the board stays valid, it may just carry a piece the tier would not normally show. Generation is tested to terminate and solve for every tier across hundreds of seeds. |
| **Torus indexing is fiddly** — off-by-ones in wrap mode silently produce unsolvable-looking boards. | Wrap adjacency lives in one `neighbour(cell, dir)` function used by the generator, the flood-fill and the renderer alike. Separate test suite for wrap mode. |
| **Par mis-computed via symmetry** (see above). | Unit-test par against a brute-force minimum over every piece's orientation set. |
| **Solved-check written as an equality against the stored solution.** | Test that `computeFlow` still reports a solved board after every `solution` field is scrubbed to garbage — proof it reads only the arrangement in front of it. |

---

## §4 — Difficulty

Difficulty is chosen diegetically: **how far down the shaft you go**. Each
depth is a different board, not a modifier on the same one.

| | **Shallow** — *The Cistern* | **Deep** — *The Aqueduct* | **Abyssal** — *The Ley Vault* |
|---|---|---|---|
| Grid | 4 × 4 | 5 × 5 | 6 × 6 |
| Max branching | 2 (path only) | 3 (tees) | 4 (crosses) |
| Pieces | caps, elbows, straights | + tees | + crosses |
| Basins | 1 | 2 | 3 |
| Wrap-around edges | no | no | **yes** |
| Welded cells | 2 (pre-solved scaffold) | — | — |
| Seized cells | — | — | 2 (cost 2 taps each) |
| Typical par | 10–19 (median 15) | 22–36 (median 28) | 38–56 (median 47) |
| Crystal base | 30 | 60 | 110 |
| Clean water | 1 | 2 | 3 |
| Solve time | ~30–60 s | ~2 min | ~4–6 min |

Par figures are measured from the shipped generator over 400 boards per tier
(10th–90th percentile), not estimated. Re-measure them if the tree style or
grid size changes — the crystal bases are derived from them.

### The four knobs, ranked by how much they actually add

1. **Branching density** *(the real dial)*. Elbows and straights on a path
   solve locally — you follow the water and each cell has one sensible answer.
   Add tees and you must reason about which branch serves which basin;
   constraint propagation replaces pattern-matching. This is where the puzzle
   stops being busywork.
2. **Wrap-around edges** *(the cliff)*. The border is the strongest solving
   anchor there is: an edge cell obviously cannot open outward. Remove it and
   the whole board becomes ambiguous at once. This is a genuine step change,
   not an increment, so it is reserved for the top tier alone.
3. **Grid size** *(the volume knob)*. Par grows roughly linearly. It makes a
   board *longer*, not harder — useful for pacing and payout, useless on its
   own. Growing size without growing branching produces tedium.
4. **Basin count** *(seasoning)*. More terminals force more structure into the
   tree. Mild, but it makes the win animation better, which is not nothing.

### Seized cells cut both ways

A **seized** cell is rusted in place and costs **2 taps** per 90°, so on
Abyssal it is a penalty that punishes brute-forcing.

The same mechanic inverted is the new-player scaffold: on Shallow, two cells
are **welded correct** — pre-solved, visually locked, un-rotatable. They cut
the search space and teach by example ("that's what a finished join looks
like"). Same code path, opposite sign.

### Rejected as difficulty levers

- **A clock.** Covered in §2 — it converts the genre.
- **A hard move cap that fails the run.** Punishes exploration, which is how
  people learn a puzzle. The soft crystal penalty does the same job without
  ever taking the board away.
- **Hiding the board / fog of war.** Turns deduction into trial and error.

---

## §5 — Hub-world integration

### The affordance: the town well

Fishing works because water is *already there* — it is terrain the player has
walked past a dozen times, and tapping it does the obvious thing. Wellspring
needs the same quality of "of course that's what that does".

The **stone well** is the answer, and it is already sitting in the world doing
nothing:

| Town | `stoneWell` count | Proposed depth |
|---|---|---|
| Appleford | 1 | Shallow |
| Capital City | 1 | Abyssal |
| Dreadspire Citadel | 0 → **add 1** | Abyssal |
| Gearford | 3 | Deep |
| Gravemoor | 1 | Abyssal |
| Harrowfield | 1 | Shallow |
| Hollowmere | 1 | Shallow |
| Ironhold Keep | 0 → **add 1** | Abyssal |
| Millhaven | 2 | Deep |
| Ravenwatch | 1 | Deep |
| Royal Palace | 1 | Deep |
| Saltmere Port | 1 | Deep |
| Thornwood Camp | 0 → **add 1** | Shallow |

Ten of thirteen towns already have one — **the same coverage `pondTiles` gives
fishing** — and not one is currently claimed by an interactable. The three
gaps take an existing `stoneWell` decor tile, so **no new art is required**.

Assigning depth per town gives places character (a village cistern is not the
Capital's ley vault) and gives the world map a reason to exist: if you want
the deepest board and its best payout, you travel for it.

### How the tap is wired

No new engine mechanism is needed. Each well becomes an ordinary
**interactable** (`docs/hubworld.md` §7) — a `hitRect` laid over the existing
`stoneWell` decor, exactly the way forage spots overlay existing bushes:

```jsonc
{
  "id": "millhaven-well",
  "tx": 15, "ty": 12,
  "reactions": [
    { "type": "dialogue", "text": "The winding gear turns, but the bucket comes up dry. Something below is choked." },
    { "type": "screen", "screen": "hub-wellspring-deep" }
  ]
}
```

The depth rides in the screen id — `hub-wellspring`, `hub-wellspring-deep`,
`hub-wellspring-vault` — which is precisely how fishing already carries its
locale variants (`hub-fishing-cave` / `-lake` / `-ocean`).

### The well keeper

A stone well is easy scenery. A player can walk past one a hundred times
without ever thinking to tap it, and since the well is the *only* door into
this game, that would be the whole feature invisible.

So every town's well has an NPC loitering beside it —
`<town>-well-keeper` — with proximity dialogue that changes with the state of
the well:

| Player state | At 8 tiles | At 4 tiles |
|---|---|---|
| No crank | *"The well's dry again."* | *"Winding gear's seized solid. You'd want a crank off Gearford to shift it."* |
| Has the crank, well still dry | *"The well's dry again."* | *"Someone ought to climb down and see to the channels."* |
| Already restored today | *"Water's running clean today."* | *"Whoever saw to the channels down there has my thanks."* |

That covers the whole discovery path in the fiction: a player who has never
heard of the crank learns it exists **and where to buy it**, a player carrying
one gets pointed at the well, and a player who has already fixed it today is
not nagged.

Keepers are found by id (`endsWith('-well-keeper')`) rather than listed in
`HubWorld.tsx`, so giving a new town a well needs no code change. Each is
sprited from the existing `hub-npc-*` set and flavoured to its town — Gravemoor's
is the sexton, Hollowmere's is a child who does not find the joke funny — so
tapping one is worth doing on its own.

### Gating

Two gates, each copied from a mechanism already in the codebase:

1. **The Winding Crank** — a one-time tool purchase, mirroring the fishing rod.
   Sold via `buyHubItem` on the shelf of Gearford's tool shop, beside the
   spade. Checked in `HubWorld.tsx`'s `handleNodeInteract` with the same
   `screen.startsWith('hub-wellspring')` shape the rod/bait check already uses.
   Without it: *"The winding gear is seized. You'd need a crank to shift it."*
2. **Once per well per real day** — reusing the `digs.ts` / `forages.ts`
   pattern verbatim (`interactableStoreKey(town, id)` → `YYYY-MM-DD` in
   localStorage). This replaces fishing's per-cast bait consumable: the puzzle
   is long enough that a per-attempt currency would just be friction, and a
   daily cooldown across 13 wells is a better reason to travel than a bait
   counter is.

### Rewards

Per solve:

| Reward | Amount |
|---|---|
| **Clean Water** (new `material` hub-item) | 1 / 2 / 3 by depth |
| Crystals | depth base × efficiency |
| **Town reputation** | +1 |
| **Under par** | +25 crystals on top |

**Town reputation is the load-bearing one.** Reputation currently drives
building upgrades and unlocked services (`docs/hubworld.md` §10) but has few
repeatable sources. A daily well is a clean, diegetic reputation faucet —
you fix the town's water, the town thinks better of you — and it gives the
hub a daily loop it does not have today.

Clean Water is deliberately chosen to land in the **chef cooking** system
(§7h) as an ingredient, so the reward is not a dead-end collectible.

---

## §6 — UI design

Portrait-first, inside the existing 740px column. Board is square and sized
`min(100vw − 32px, 420px)` so a 6×6 cell stays a comfortable ~64px tap target.

```
┌─────────────────────────────────────────────┐
│ 💧 WELLSPRING            Moves 12 · Par 18  │  MinigameShell (title + stat)
├─────────────────────────────────────────────┤
│            Deep — The Aqueduct               │  caption: the well's own depth
├─────────────────────────────────────────────┤
│                                             │
│      ╔═══════════════════════════╗          │
│      ║  ╭─╮   ═══   ╰─╮   ╷      ║          │
│      ║  ▓ spring        ╰──◉     ║          │  ConduitBoard
│      ║  ╵    ╭───╯   ╷    ╰─╮    ║          │  ▓ source  ◉ basin
│      ║  ═══  ╵    ◉  ╰─────╯     ║          │
│      ╚═══════════════════════════╝          │
│                                             │
├─────────────────────────────────────────────┤
│  💧 Conduits 12/25       ⚠  2 leaking       │  FlowStatusBar
├─────────────────────────────────────────────┤
│     [ 🔎 DOWSE  −3 ]      [ ↺ RESET ]       │  action-btn row
└─────────────────────────────────────────────┘
```

### Cell states

| State | Treatment |
|---|---|
| Dry | Grey stone channel, 2px darker outline, on a recessed socket. |
| Carrying water | Channel fills `--accent-blue`, soft outer glow, a highlight travelling along the path (SVG `stroke-dashoffset` animation) so flow direction is visible. |
| Leaking end | Amber tip + a short repeating droplet spray at the open side. |
| Source | Spring glyph, permanent ripple, visibly un-tappable (no press feedback). |
| Basin | Stone bowl; fill level animates 0→100% when fed. |
| Welded correct (Shallow scaffold) | Brass banding, no press feedback, `aria-disabled`. |
| Seized (Abyssal) | Rust overlay + a small "×2" pip. |

### Motion

- **Rotation:** 150 ms eased spin of the piece only, not the socket.
- **Press feedback:** `filter: brightness(1.35)` — per `AGENTS.md`, cells in a
  fixed grid must *not* use `translateY`, because translating one cell while
  its neighbours hold still reads as a layout glitch. `:active` is required
  alongside `:hover`; `pressFeedback.test.ts` will fail the build otherwise.
- **Solve:** water races the whole network in ~600 ms, basins fill, one board
  pulse, then `MinigameResultPanel`.
- All of the above sit behind `prefers-reduced-motion` (see #2182): the
  reduced path swaps travelling highlights for a static lit state and cuts the
  rotation tween to an instant snap.

### Result panel

Reuses `MinigameResultPanel` unchanged — headline, breakdown, one CTA.

```
            ✨  WELLSPRING RESTORED
              Moves 16  ·  Par 18
              Efficiency 100%
              Under par!  +25 💎
        ─────────────────────────────────────
        +85 💎  ·  +2 💧 Clean Water  ·  +1 standing

              [ LEAVE THE WELL ]
```

### Accessibility

The status bar counts **conduits carrying**, not basins fed: on a one-basin
Shallow board that counter only flips at the very end, where the count of live
pipe climbs the whole way and reads as progress. The basins keep their own
payoff by visibly filling on the board.

Each cell is a real `<button>` carrying a description of its own piece —
*"Row 2, column 3: elbow, open north and east. Activate to rotate."* — plus
`aria-live` announcements when a basin fills or the last leak closes. This is
free with a DOM board and would need a hand-built shadow grid over a canvas,
which is the main reason for the renderer decision below.

---

## §7 — Renderer: a documented deviation

**The board is DOM + inline SVG, not a PixiJS canvas.**

`AGENTS.md`'s framework table says *"tile/cell grids → PixiJS"*, and
`towerdefence/GameGrid.tsx` is the precedent. Wellspring deviates from that
table deliberately:

- The rule's stated rationale is spatial grids with **moving entities and
  sprite animation**. Wellspring has neither — it is at most 36 static cells
  that occasionally rotate 90°.
- A DOM board gets keyboard focus, screen-reader labels and `:focus-visible`
  **for free**, all of which are open work in #2182. A canvas board needs an
  invisible parallel button grid to fake them.
- Each piece is one small SVG reused at four rotations. The flow animation is
  a `stroke-dashoffset` keyframe. There is no particle budget to justify Pixi.
- DOM cells are directly testable and Storybook-inspectable per component,
  which is what the component-extraction rule in `AGENTS.md` is asking for.

Pixi's real advantage would be a richer water shader. In practice the CSS
`stroke-dashoffset` flow and a solid amber stroke on a spilling arm read
better than the particle effects originally sketched here, and cost nothing.

---

## §8 — What was built

Five commits, each independently green (`npm run build` + `npm run test`).

### Commit 1 — Pure logic *(no UI, no React)*

| File | Contents |
|---|---|
| `components/minigames/Wellspring.logic.ts` | Piece/mask model, `neighbourIndex()` (the single wrap-aware adjacency function), the three spanning-tree generators, scrambler, exact par, flood-fill solved-check, leak enumeration, rotation, dowse, scoring. Named for the existing `Fishing.physics.ts` / `HarbourRegatta.physics.ts` convention — minigame logic lives beside its screen, not in `game/`. |
| `web/src/data/wellspringDepths.json` | The §4 table as config — grid, tree style, basin count, wrap, seized/welded counts, crystal base, clean water. Per `AGENTS.md`, extensible constants belong in JSON. |
| `components/minigames/Wellspring.logic.test.ts` | 50 tests: generation terminates and solves at every tier across hundreds of seeds; par equals the taps an honest playthrough actually spends; the piece mix matches each tree style; wrap adjacency is symmetric; welded/seized counts land only on turnable cells; `computeFlow` ignores the stored solution; scoring floors, bonuses and the crystal path. |

✅ **Landed.** This is the commit that had to be right. Everything after it is
presentation.

### Commit 2 — Board components + styling

| File | Contents |
|---|---|
| `components/minigames/wellspring/ConduitTile.tsx` + `.stories.tsx` | One cell. Props only, no state. Story covers every §6 state. |
| `components/minigames/wellspring/ConduitBoard.tsx` + `.stories.tsx` | The grid. Story covers each depth, plus a mid-solve board with leaks. |
| `components/minigames/wellspring/FlowStatusBar.tsx` + `.stories.tsx` | Conduits-carrying / leak count. |
| `web/src/styles/minigames-5.css` (+ `index.css` import) | The existing four are 1.2–1.5k lines each; a new game starts a new file. |

Reuse before adding: `action-btn`, `Button`, `Panel`, `MinigameShell`,
`MinigameResultPanel`. Every new clickable gets `:active`.

Three findings only a screenshot caught: leak dots read as muddy olive over a
blue pipe (a spilling arm now goes solid amber along its length instead), the
spring was the least prominent thing on a board full of shouting gold basins,
and `@keyframes` animating the SVG `r` geometry property silently does nothing
in WebKit, which this repo tests against.

### Commit 3 — The screen

| File | Change |
|---|---|
| `components/minigames/Wellspring.tsx` + `.stories.tsx` | Orchestrator. `onDone(result)` and a `depth` set by the town — no reward mode and no depth picker, because there is only one way in. |
| `game/achievements.ts` | First restore, an under-par solve, thirteen wells, three ley vaults. |

### Commit 4 — Hub wiring

| File | Change |
|---|---|
| `app/screens.ts` | `'hub-wellspring'`, `-deep`, `-vault`. |
| `app/lazyScreens.ts` | Lazy `Wellspring` export. |
| `app/routes/HubRoutes.tsx` | Three routes wrapped in `OverlayScreen`, mirroring the `hub-fishing*` block, and the reward grant on completion. |
| `components/hub/HubWorld.tsx` | `SCREEN_ENTER_LABEL` entries (*"Look down the well?"*); crank + daily-cooldown gate in `handleNodeInteract`, alongside the existing rod/bait gate; well-keeper proximity dialogue. |
| `game/hub/wellsprings.ts` + `.test.ts` | `canRestoreToday` / `recordRestore` (a direct copy of `digs.ts`) and `wellKeeperDialogue`. |
| `game/hub/reputation.ts` | `addTownReputation` — every point of standing was previously *bought* through `purchaseUpgrade`. |
| `data/hubItems.json` | `winding-crank` (tool) and `clean-water` (material). |

### Commit 5 — Town data + docs

| File | Change |
|---|---|
| `data/hub/*/config.json` × 13 | Well interactable per town at the depth from §5; a well keeper NPC beside each; a `stoneWell` decor tile added for Dreadspire, Ironhold and Thornwood; the crank on Gearford's tool-shop shelf. |
| `docs/hubworld.md` | New section for the well interactable + authoring checklist. |

Watch out on commit 5: the loader integrity tests parse every town config, and
a new interactable must not collide with an existing interactable, NPC spawn
or animal tile. Tap the well, confirm it does not *also* walk the avatar.

The three *new* wells (Dreadspire, Ironhold, Thornwood) were placed by picking
a free tile hugging the town's street network, not by looking at the map. They
are the one thing here worth eyeballing in game.

### Deliberately not built

- **No arcade entry.** Wellspring was briefly wired into the mini-games menu
  with a crystal cost, a ticket payout, a leaderboard tab and a daily
  ticket-challenge. All of that came back out: the game is reached through a
  town's well and nowhere else, so `MiniGameId`, `economy.json`'s
  `miniGameCosts` and `miniGameDailyChallenge.ts` know nothing about it.
- **No depth picker.** With the depth authored per town there is nothing to
  choose, so `DepthPicker` was deleted rather than left unused.
- **No seeded daily board.** A shared "board of the day" only pays off with a
  leaderboard to compare on, and there isn't one.
