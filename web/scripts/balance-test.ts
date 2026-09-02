/**
 * Balance test — simulates every battle/elite/boss node across all acts with
 * three player strategies and reports win/lose outcomes + timing.
 *
 * Run: npx tsx scripts/balance-test.ts   (BALANCE_RUNS=N to set depth)
 *
 * The three strategies bracket the skill range, and the GAP between them is
 * the interesting output:
 *   - passive   — plays nothing. Should lose; if it doesn't, the node is free.
 *   - greedy    — plays a random affordable card. The floor: models a player
 *                 with no strategy at all, so it answers "is this possible",
 *                 never "is this hard".
 *   - competent — spends mana well, banks for key cards, reacts to the field
 *                 and sets stance. The ceiling: answers "is this trivial".
 *
 * PASS criteria per node — see MIN_WIN_RATE / MIN_WIN_MS / SPEED_CHECK_MIN_WINS
 * / TOO_EASY_WIN_RATE below for the live values; this list says what each is for:
 *   - Greedy wins ≥ MIN_WIN_RATE × RUNS — a floor check that the node is not
 *     completely unwinnable.
 *   - Passive loses ≥ 80% of runs — the node is not a free win.
 *   - Average greedy win time ≥ MIN_WIN_MS, once greedy wins at least
 *     SPEED_CHECK_MIN_WINS runs.
 *   - NOT (competent wins ≥ TOO_EASY_WIN_RATE × RUNS AND does so faster than
 *     MIN_WIN_MS) — the node is not trivial for someone who can play.
 *
 * This block previously claimed "greedy wins ≥ 4/5", which never matched the
 * constants (the floor is a 10% win rate) and got quoted as the real bar in
 * #2268 and PR #2281. Keep it describing intent; leave numbers to the constants.
 */

import { isMainThread, workerData, parentPort, Worker } from 'node:worker_threads'
import os from 'node:os'
import UpdateManager from 'stdout-update'

import { newGame, tick, NewGameOptions } from '../src/game/engine'
import { playCard } from '../src/game/engine/cards'
import { makeDeck } from '../src/game/cards'
import type { Card, GameState } from '../src/game/types'

// ── Config ──────────────────────────────────────────────────────────────────

const TICK_MS      = 100          // ms per simulation step
const MAX_GAME_MS  = 12 * 60_000  // give up after 12 min game-time
// Runs per node (different shuffles). 100 is the local/full-confidence
// figure — a full 32-node sweep measured ~95s at depth 10 and ~300s at 30 on
// two threads, so roughly 16 min at 100, too slow a feedback loop for CI
// where this only needs to catch a node that has become unwinnable or
// trivial. CI therefore sets BALANCE_RUNS lower; the report prints whichever
// depth was used, so a shallow run is never mistaken for a full one.
//
// Depth interacts with the thresholds below, which are all rates: too shallow
// and MIN_WIN_RATE rounds to a single win, making a node's verdict a coin
// flip (#2282). Don't lower CI's depth without re-checking minWinsFor().
const RUNS         = Number(process.env.BALANCE_RUNS) || 100

/** Minimum average win time — below this the fight is trivially easy. */
const MIN_WIN_MS: Record<string, number> = {
  battle: 60_000,   // 60 s
  elite:  80_000,   // 80 s
  boss:  100_000,   // 100 s
}

/**
 * Only flag "too fast" when the greedy AI wins in more than half the runs.
 * Low win-rate nodes are already hard enough — even if rare wins happen quickly,
 * a real player who struggles 50%+ of the time is not having a trivially easy fight.
 *
 * Derived from RUNS rather than hardcoded (#2282). It was the literal `16`,
 * which meant "> 50%" only back when RUNS was 32 — at RUNS=100 it silently
 * became 16%, and at the CI depth of 10 it was unreachable altogether, so the
 * one criterion that detects a trivially easy fight could never fire there.
 */
const SPEED_CHECK_MIN_WINS = Math.ceil(RUNS * 0.5)

/**
 * Minimum greedy win rate per node type, as a fraction of RUNS.
 * Greedy AI is weaker than a real player (plays a random affordable card, no
 * tactics). So a low bar here still means real players find the fight beatable.
 *
 * A fraction rather than a count (#2282). It was the literal `1`, whose comment
 * read "≥ 1/10 (10%)" — true only at the RUNS=10 it was authored for. At the
 * default RUNS=100 it had drifted to 1%, and at CI's depth a node's entire
 * verdict turned on a single stochastic win: consecutive depth-10 sweeps
 * reported 0/32 and then 1/32, the difference being one node scraping 1/10.
 */
const MIN_WIN_RATE: Record<string, number> = {
  battle: 0.10,   // catches "completely unwinnable" nodes
  elite:  0.10,   // elites are hard; real players need skill
  boss:   0.10,   // bosses need real strategy; random AI barely wins
}

/** Win count a node must clear, from its rate — never below 1. */
function minWinsFor(nodeType: string): number {
  return Math.max(1, Math.ceil((MIN_WIN_RATE[nodeType] ?? 0.10) * RUNS))
}

/**
 * A node is "too easy" when the COMPETENT strategy wins nearly always AND wins
 * fast. Greedy can't answer this — it plays randomly and models the bottom of
 * the skill range, so its win rate says whether a node is possible, not whether
 * it is trivial. This pair is the veteran-difficulty signal (#2282).
 */
const TOO_EASY_WIN_RATE = 0.9

/** Win count above which the competent player is considered to be cruising. */
function tooEasyWinsFor(): number {
  return Math.ceil(TOO_EASY_WIN_RATE * RUNS)
}

// ── Competent strategy ───────────────────────────────────────────────────────
//
// Models a player who knows what they are doing, as the counterpart to greedy's
// random flailing. Three behaviours, per the design steer on #2282:
//
//   1. Spends mana efficiently — plays the best card it can afford rather than
//      a random one. This alone is most of the gap between random and competent.
//   2. Banks for key cards — will sit on mana briefly to land a heavy card
//      instead of dribbling out cheap ones.
//   3. Reacts to the field — prefers cards that answer what the opponent has
//      deployed, and sets stance to match how the fight is going.
//
// Deliberately NOT modelled: placement. Deploy position is left at the engine
// default, so this measures decision-making rather than micro.

/** Hold mana for a card at most this far out of reach. */
const BANK_WITHIN_MANA = 2
/**
 * ...and only when what it's waiting for is clearly better than what it could
 * play now, by at least this much score. Without the margin the player banks
 * for any marginally-pricier card, which on this engine's small mana scale
 * (BASE_MAX_MANA is 5) means waiting almost every tick and playing nothing —
 * a "competent" strategy that scored identically to passive.
 */
const BANK_SCORE_EDGE = 2

/** Stance follows the state of the fight, as a player watching it would set it. */
function competentStance(s: GameState): NonNullable<GameState['playerStance']> {
  const mine   = s.playerBase.hp / s.playerBase.maxHp
  const theirs = s.opponentBase.hp / s.opponentBase.maxHp
  if (mine < 0.35 && mine < theirs)  return 'defend'  // behind — stop the bleeding
  if (theirs < 0.5 && theirs <= mine) return 'attack'  // ahead — press it
  return 'auto'
}

/**
 * Rank an affordable card. Cost is the baseline (spending mana well is the
 * point), with situational bonuses for cards that answer the current field.
 */
function competentScore(card: Card, s: GameState): number {
  let score = card.cost

  // Melee stalls on walls; bypassWall units ignore them (see engine/combat).
  const enemyWalled = s.field.some(u => u.owner === 'opponent' && u.isWall && u.hp > 0)
  if (enemyWalled && card.unit?.bypassWall) score += 3

  const losing = s.playerBase.hp / s.playerBase.maxHp < 0.4
  if (losing) {
    if (card.unit?.isWall) score += 2                    // buy time
  } else if (card.unit && !card.unit.isWall) {
    score += 1                                           // keep pressure on
  }

  return score
}

/** The card a competent player plays now, or null to bank and wait. */
function competentPick(s: GameState): Card | null {
  const affordable = s.playerHand.filter(c => c.cost <= s.mana)
  const best = affordable.length === 0 ? null : affordable.reduce((a, c) =>
    competentScore(c, s) > competentScore(a, s) ? c : a
  )

  // Bank only when something clearly better is nearly affordable, and never
  // at the mana cap — sitting on full mana wastes regen, which is a mistake a
  // competent player doesn't make.
  const soon = s.playerHand.filter(c => c.cost > s.mana && c.cost - s.mana <= BANK_WITHIN_MANA)
  if (soon.length > 0 && s.mana < s.maxMana) {
    const bestSoon = soon.reduce((a, c) => competentScore(c, s) > competentScore(a, s) ? c : a)
    const bar = best ? competentScore(best, s) + BANK_SCORE_EDGE : 0
    if (competentScore(bestSoon, s) > bar) return null
  }

  return best
}

// ── Simulation ───────────────────────────────────────────────────────────────

interface SimResult {
  /**
   * 'draw' is a real gameOver outcome in the engine and was missing here — the
   * assignment from state.phase.winner was a type error nothing ever ran, since
   * scripts/ sat outside tsconfig's `include` (see tsconfig.scripts.json).
   * Draws counted as neither a win nor a loss while the pass thresholds are
   * measured against RUNS, so every draw quietly deflated both tallies.
   */
  winner: 'player' | 'opponent' | 'draw' | 'timeout'
  gameTimeMs: number
}

type Strategy = 'greedy' | 'passive' | 'competent'

function simulateGame(opts: NewGameOptions, strategy: Strategy): SimResult {
  let state = newGame(opts)

  while (state.phase.type === 'playing' && state.gameTime < MAX_GAME_MS) {
    state = tick(state, TICK_MS)

    if (strategy === 'greedy' && state.phase.type === 'playing') {
      // Play a random affordable card — more varied than always cheapest/most-expensive,
      // which better explores the space of player decisions for boss winability checks.
      const affordable = state.playerHand.filter(c => c.cost <= state.mana)
      if (affordable.length > 0) {
        const pick = affordable[Math.floor(Math.random() * affordable.length)]
        state = playCard(state, pick.id)
      }
    }

    if (strategy === 'competent' && state.phase.type === 'playing') {
      state.playerStance = competentStance(state)
      const pick = competentPick(state)
      if (pick) state = playCard(state, pick.id)
    }
  }

  // A PLAYER WIN DOES NOT LAND IN 'gameOver'. engine.ts declareWinner() sends
  // the player's victory to 'celebration' and only the opponent's to
  // 'gameOver', so checking gameOver alone recorded every single player win as
  // a timeout — `wins` was structurally 0 for every strategy on every node.
  // That, not difficulty, is what produced the "0/32 nodes pass, not winnable
  // everywhere" baseline reported on #2268 and #2282 (#2282).
  if (state.phase.type === 'celebration') {
    return { winner: 'player', gameTimeMs: state.gameTime }
  }
  if (state.phase.type === 'gameOver') {
    return { winner: state.phase.winner, gameTimeMs: state.gameTime }
  }
  return { winner: 'timeout', gameTimeMs: state.gameTime }
}

// ── Report helpers ────────────────────────────────────────────────────────────

function fmt(ms: number): string {
  if (!ms) return '  —   '
  const s = ms / 1000
  return s >= 60 ? `${(s / 60).toFixed(1)}m` : `${s.toFixed(0)}s`
}

function checkMark(passes: boolean): string {
  return passes ? '✓' : '✗'
}

// ── Worker types ─────────────────────────────────────────────────────────────

interface WorkerInput {
  actName: string
  nodeId: string
  nodeType: string
  handicap: number
  bossAI?: string
  enemyDeckNames?: string[]
  opponentIntervalMs?: number
  opponentBaseHp?: number
  runs: number
  progressEvery: number
}

interface WorkerOutput {
  type: 'done'
  actName: string
  nodeId: string
  nodeType: string
  handicap: number
  wins: number
  losses: number
  totalWinMs: number
  totalLoseMs: number
  /** Competent-strategy results — the veteran-difficulty half of the picture. */
  strongWins: number
  totalStrongWinMs: number
}

interface WorkerProgress {
  type: 'progress'
  nodeId: string
  greedyDone: number
  passiveDone: number
  runs: number
}

// ── Worker mode ───────────────────────────────────────────────────────────────

if (!isMainThread) {
  const input: WorkerInput = workerData

  const opts: NewGameOptions = {
    playerCards: makeDeck(),
    opponentHandicap: input.handicap,
    bossAI: input.bossAI,
    enemyDeckNames: input.enemyDeckNames,
    opponentIntervalMs: input.opponentIntervalMs,
    opponentBaseHp: input.opponentBaseHp,
  }

  let wins = 0, totalWinMs = 0, losses = 0, totalLoseMs = 0
  let strongWins = 0, totalStrongWinMs = 0

  // Greedy runs
  for (let i = 0; i < input.runs; i++) {
    const r = simulateGame({ ...opts, playerCards: makeDeck() }, 'greedy')
    if (r.winner === 'player') { wins++; totalWinMs += r.gameTimeMs }
    if ((i + 1) % input.progressEvery === 0) {
      parentPort!.postMessage({
        type: 'progress', nodeId: input.nodeId,
        greedyDone: i + 1, passiveDone: 0, runs: input.runs,
      } satisfies WorkerProgress)
    }
  }

  // Passive runs
  for (let i = 0; i < input.runs; i++) {
    const r = simulateGame({ ...opts, playerCards: makeDeck() }, 'passive')
    if (r.winner === 'opponent') { losses++; totalLoseMs += r.gameTimeMs }
    if ((i + 1) % input.progressEvery === 0) {
      parentPort!.postMessage({
        type: 'progress', nodeId: input.nodeId,
        greedyDone: input.runs, passiveDone: i + 1, runs: input.runs,
      } satisfies WorkerProgress)
    }
  }

  // Competent runs — the strong end of the skill range.
  for (let i = 0; i < input.runs; i++) {
    const r = simulateGame({ ...opts, playerCards: makeDeck() }, 'competent')
    if (r.winner === 'player') { strongWins++; totalStrongWinMs += r.gameTimeMs }
  }

  parentPort!.postMessage({
    type: 'done',
    actName: input.actName, nodeId: input.nodeId, nodeType: input.nodeType,
    handicap: input.handicap, wins, losses, totalWinMs, totalLoseMs,
    strongWins, totalStrongWinMs,
  } satisfies WorkerOutput)
}

// ── Main mode ─────────────────────────────────────────────────────────────────

else {
  interface ActData {
    nodes: Record<string, {
      type: string
      handicap?: number
      bossAI?: string
      enemyDeck?: string[]
      opponentIntervalMs?: number
      opponentBaseHp?: number
    }>
  }

  const acts: [string, ActData][] = [
    ['Act 1', (await import('../src/data/acts/act1.json', { with: { type: 'json' } })).default as ActData],
    ['Act 2', (await import('../src/data/acts/act2.json', { with: { type: 'json' } })).default as ActData],
    ['Act 3', (await import('../src/data/acts/act3.json', { with: { type: 'json' } })).default as ActData],
  ]

  const BATTLE_TYPES = new Set(['battle', 'elite', 'boss'])
  const CONCURRENCY  = ((os.cpus().length) - 2 ) > 0 ? ((os.cpus().length) - 2 ) : 1 // leave 2 cores free for system responsiveness; worker threads can be CPU-intensive
  const PROGRESS_EVERY = Math.max(50, Math.floor(RUNS / 10))

  // Collect all tasks in act order
  const tasks: WorkerInput[] = []
  for (const [actName, actData] of acts) {
    for (const [nodeId, node] of Object.entries(actData.nodes)) {
      if (!BATTLE_TYPES.has(node.type)) continue
      tasks.push({
        actName, nodeId, nodeType: node.type,
        handicap: node.handicap ?? 0,
        bossAI: node.bossAI,
        enemyDeckNames: node.enemyDeck,
        opponentIntervalMs: node.opponentIntervalMs,
        opponentBaseHp: node.opponentBaseHp,
        runs: RUNS,
        progressEvery: PROGRESS_EVERY,
      })
    }
  }

  const totalNodes = tasks.length

  console.log(`\nBalance Test — ${totalNodes} nodes × ${RUNS}×2 runs — ${CONCURRENCY} threads`)
  console.log('='.repeat(70))

  // Live progress state per node
  const nodeProgress = new Map<string, { greedyDone: number; passiveDone: number }>()
  const inFlight     = new Set<string>()
  const mgr          = UpdateManager.getInstance()
  mgr.hook()

  function renderProgress(): void {
    const done  = resultMap.size
    const bar   = `[${done}/${totalNodes}]`
    const nodes = [...inFlight].map(id => {
      const p   = nodeProgress.get(id) ?? { greedyDone: 0, passiveDone: 0 }
      const pct = Math.floor(((p.greedyDone + p.passiveDone) / (RUNS * 2)) * 100)
      return `  ${id} ${pct}%`
    })
    mgr.update([`  ${bar} Running:`, ...nodes])
  }

  // Results keyed by nodeId; printed in original task order after all complete
  const resultMap = new Map<string, WorkerOutput>()
  let failedNodes = 0

  function onComplete(r: WorkerOutput): void {
    inFlight.delete(r.nodeId)
    nodeProgress.delete(r.nodeId)
    resultMap.set(r.nodeId, r)
    renderProgress()
  }

  function printSummary(): void {
    mgr.unhook()

    let currentAct = ''
    for (const task of tasks) {
      const r = resultMap.get(task.nodeId)!

      if (r.actName !== currentAct) {
        currentAct = r.actName
        console.log(`\n${r.actName}`)
        console.log('-'.repeat(70))
        console.log(
          '  Node'.padEnd(24) + 'h  ' +
          'Win (greedy)'.padStart(14) + '  ' +
          'Lose (passive)'.padStart(14) + '  ' +
          'Win (strong)'.padStart(14) + '  Status'
        )
      }

      const minWins   = minWinsFor(r.nodeType)
      const winMin    = MIN_WIN_MS[r.nodeType]    ?? 40_000
      const avgWinMs  = r.wins   > 0 ? r.totalWinMs  / r.wins   : 0
      const avgLoseMs = r.losses > 0 ? r.totalLoseMs / r.losses : 0
      const winOk     = r.wins   >= minWins
      const loseOk    = r.losses >= Math.ceil(RUNS * 0.8)
      const speedOk   = r.wins < SPEED_CHECK_MIN_WINS || avgWinMs >= winMin

      // Too easy: a competent player wins nearly always AND wins fast. Both
      // halves matter — always-winning-but-slow is a long fight, not a trivial
      // one, and a fast rare win is just variance (#2282).
      const avgStrongMs = r.strongWins > 0 ? r.totalStrongWinMs / r.strongWins : 0
      const tooEasy     = r.strongWins >= tooEasyWinsFor() && avgStrongMs < winMin
      const pass        = winOk && loseOk && speedOk && !tooEasy

      if (!pass) failedNodes++

      const flags = [
        !winOk   ? '⚠ not winnable' : '',
        !loseOk  ? '⚠ not losable'  : '',
        !speedOk ? `⚠ too fast (${fmt(avgWinMs)} < ${fmt(winMin)})` : '',
        tooEasy  ? `⚠ too easy (strong ${r.strongWins}/${RUNS} in ${fmt(avgStrongMs)})` : '',
      ].filter(Boolean).join(' ')

      const label    = `${r.nodeId} (${r.nodeType})`
      const winStr   = `${checkMark(winOk)} ${r.wins}/${RUNS} avg ${fmt(avgWinMs)}`
      const loseStr  = `${checkMark(loseOk)} ${r.losses}/${RUNS} avg ${fmt(avgLoseMs)}`
      const strongStr = `${checkMark(!tooEasy)} ${r.strongWins}/${RUNS} avg ${fmt(avgStrongMs)}`
      const status   = pass ? 'PASS' : `FAIL ${flags}`

      console.log(
        `  ${label.padEnd(22)} ${String(r.handicap).padStart(2)}  ` +
        `${winStr.padEnd(16)}  ${loseStr.padEnd(16)}  ${strongStr.padEnd(16)}  ${status}`
      )
    }
  }

  // ── Thread pool executor ──────────────────────────────────────────────────

  function runWorker(task: WorkerInput): Promise<WorkerOutput> {
    return new Promise((resolve, reject) => {
      inFlight.add(task.nodeId)
      nodeProgress.set(task.nodeId, { greedyDone: 0, passiveDone: 0 })
      renderProgress()

      // tsx skips hook registration inside worker threads (isMainThread guard),
      // so we bootstrap via tsx/esm/api explicitly from a sibling .mjs file.
      const bootstrapUrl = new URL('./tsx-worker.mjs', import.meta.url).href

      const worker = new Worker(new URL(import.meta.url), {
        workerData: task,
        execArgv: ['--import', bootstrapUrl],
      })

      worker.on('message', (msg: WorkerOutput | WorkerProgress) => {
        if (msg.type === 'progress') {
          nodeProgress.set(msg.nodeId, { greedyDone: msg.greedyDone, passiveDone: msg.passiveDone })
          renderProgress()
        } else {
          resolve(msg)
        }
      })
      worker.on('error', reject)
      worker.on('exit', (code: number) => {
        if (code !== 0) reject(new Error(`Worker exited with code ${code}`))
      })
    })
  }

  // Pool: keep CONCURRENCY workers busy
  let taskIdx = 0

  async function pool(): Promise<void> {
    while (taskIdx < tasks.length) {
      const task = tasks[taskIdx++]
      const result = await runWorker(task)
      onComplete(result)
    }
  }

  const startMs = Date.now()
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, pool))

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1)

  printSummary()
  console.log('\n' + '='.repeat(70))
  console.log(`Result: ${totalNodes - failedNodes}/${totalNodes} nodes passed  (${elapsed}s)`)
  if (failedNodes > 0) {
    console.log('Some nodes failed — review the table above.')
    process.exit(1)
  } else {
    console.log('All nodes balanced ✓')
  }
}
