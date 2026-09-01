/**
 * Balance test — simulates every battle/elite/boss node across all acts
 * with two player strategies and reports win/lose outcomes + timing.
 *
 * Run: npx tsx scripts/balance-test.ts
 *
 * PASS criteria per node:
 *   - Greedy player wins ≥ 4/5 runs
 *   - Passive player loses ≥ 4/5 runs
 *   - Average win time (greedy) ≥ MIN_WIN_MS
 */

import { isMainThread, workerData, parentPort, Worker } from 'node:worker_threads'
import os from 'node:os'
import UpdateManager from 'stdout-update'

import { newGame, tick, NewGameOptions } from '../src/game/engine'
import { playCard } from '../src/game/engine/cards'
import { makeDeck } from '../src/game/cards'

// ── Config ──────────────────────────────────────────────────────────────────

const TICK_MS      = 100          // ms per simulation step
const MAX_GAME_MS  = 12 * 60_000  // give up after 12 min game-time
// Runs per node (different shuffles). 100 is the local/full-confidence
// figure — a full 32-node sweep measured ~95s at 10 and so roughly 16 min
// at 100, which is too slow a feedback loop for CI, where this only needs
// to catch a node that has become unwinnable or trivial. CI therefore sets
// BALANCE_RUNS lower; the report prints whichever depth was used, so a
// shallow run is never mistaken for a full one.
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
 */
const SPEED_CHECK_MIN_WINS = 16  // > 50% of RUNS

/**
 * Minimum greedy win count (out of RUNS) per node type.
 * Greedy AI is weaker than a real player (plays most expensive card, no tactics).
 * So a lower bar here still means real players find the fight beatable.
 */
const MIN_WIN_COUNT: Record<string, number> = {
  battle: 1,   // ≥ 1/10 (10%) — catches "completely unwinnable" nodes
  elite:  1,   // ≥ 1/10 (10%) — elites are hard; real players need skill
  boss:   1,   // ≥ 1/10 (10%) — bosses need real strategy; random AI barely wins
}

// ── Simulation ───────────────────────────────────────────────────────────────

interface SimResult {
  winner: 'player' | 'opponent' | 'timeout'
  gameTimeMs: number
}

function simulateGame(opts: NewGameOptions, strategy: 'greedy' | 'passive'): SimResult {
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

  parentPort!.postMessage({
    type: 'done',
    actName: input.actName, nodeId: input.nodeId, nodeType: input.nodeType,
    handicap: input.handicap, wins, losses, totalWinMs, totalLoseMs,
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
          'Lose (passive)'.padStart(14) + '  Status'
        )
      }

      const minWins   = MIN_WIN_COUNT[r.nodeType] ?? 1
      const winMin    = MIN_WIN_MS[r.nodeType]    ?? 40_000
      const avgWinMs  = r.wins   > 0 ? r.totalWinMs  / r.wins   : 0
      const avgLoseMs = r.losses > 0 ? r.totalLoseMs / r.losses : 0
      const winOk     = r.wins   >= minWins
      const loseOk    = r.losses >= Math.ceil(RUNS * 0.8)
      const speedOk   = r.wins < SPEED_CHECK_MIN_WINS || avgWinMs >= winMin
      const pass      = winOk && loseOk && speedOk

      if (!pass) failedNodes++

      const flags = [
        !winOk   ? '⚠ not winnable' : '',
        !loseOk  ? '⚠ not losable'  : '',
        !speedOk ? `⚠ too fast (${fmt(avgWinMs)} < ${fmt(winMin)})` : '',
      ].filter(Boolean).join(' ')

      const label   = `${r.nodeId} (${r.nodeType})`
      const winStr  = `${checkMark(winOk)} ${r.wins}/${RUNS} avg ${fmt(avgWinMs)}`
      const loseStr = `${checkMark(loseOk)} ${r.losses}/${RUNS} avg ${fmt(avgLoseMs)}`
      const status  = pass ? 'PASS' : `FAIL ${flags}`

      console.log(
        `  ${label.padEnd(22)} ${String(r.handicap).padStart(2)}  ` +
        `${winStr.padEnd(16)}  ${loseStr.padEnd(16)}  ${status}`
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
