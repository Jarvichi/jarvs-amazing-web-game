/**
 * Signature hero abilities for the campaign-2 heroes.
 *
 * Every ability declared in `HeroAbilities` (types.ts) is driven from here, and
 * every one of them is a mechanic that exists nowhere else in the engine. The
 * chapter-2 heroes originally shipped as thirteen copies of one card — the same
 * `guardBase` stance and a flat stat buff apiece — so "give it a `teleportAbility`
 * like the Phantom Dasher" was never the fix. Each hero needed a rule of its own.
 *
 * Three kinds of ability live here:
 *
 *  - **Periodic** — fired off the shared `heroAbilityTimer` in `tickHeroAbilities`.
 *    A hero carries at most one periodic ability, so one timer per unit is enough.
 *  - **Continuous** — recomputed every tick (Deeproot regen) or read at the point
 *    of use by the movement code (Safe Passage).
 *  - **Reactive** — hooks called from `combat.ts` (`heroOutgoingDamage`,
 *    `heroIncomingDamage`, `afterHeroHit`, `onHeroKill`) and from `engine/cards.ts`
 *    (`applyForcedMarch`) at the moment the thing they react to happens.
 */
import { GameState, Unit, UnitTemplate, LANE_WIDTH } from '../types'
import { DAMAGE_FLASH_MS } from './constants'
import { spawnUnit } from './helpers'

/** Keep pulled/knocked units inside the playable strip rather than on top of a base. */
const EDGE_MARGIN_PX = 12

function sideLabel(owner: 'player' | 'opponent'): string {
  return owner === 'player' ? 'Your' : 'Enemy'
}

/** Direction (in forward-X) that pushes `unit` back toward its OWN base. */
function retreatDir(unit: Unit): number {
  return unit.owner === 'player' ? -1 : 1
}

/** True for anything a displacement effect should leave where it stands. */
function isImmovable(unit: Unit): boolean {
  return unit.moveSpeed === 0 || unit.isWall === true || unit.isMoat === true ||
         unit.heroAbility?.deeproot !== undefined
}

/** Shove a unit along the forward axis, clamped to the battlefield. */
function displace(unit: Unit, px: number): void {
  unit.x = Math.max(EDGE_MARGIN_PX, Math.min(LANE_WIDTH - EDGE_MARGIN_PX, unit.x + px))
}

/** Live units on `owner`'s side that carry the named hero ability. */
function wardensOf<K extends keyof NonNullable<UnitTemplate['heroAbility']>>(
  field: Unit[], owner: 'player' | 'opponent', key: K,
): Unit[] {
  return field.filter(u => u.owner === owner && u.hp > 0 && !u.isDecoy && u.heroAbility?.[key] !== undefined)
}

// ─── Continuous: Safe Passage (Causeway Guide) ────────────

const NO_GUIDES: readonly Unit[] = []

/**
 * The Safe Passage guides on the field right now.
 *
 * Hoist this ONCE per tick and hand the result to `hasSafePassage` /
 * `safePassageSpeedBonus`, rather than letting each of them rescan the field
 * per unit — that is O(n²) every tick to answer "no" in the overwhelmingly
 * common case where no Causeway Guide has been played at all. The battlefield
 * render budget (`Battlefield.stories.tsx` → Performance Profile) is measured
 * around the real engine tick, so this is not a hypothetical cost.
 */
export function safePassageGuides(field: Unit[]): readonly Unit[] {
  let guides: Unit[] | null = null
  for (const u of field) {
    if (u.hp > 0 && !u.isDecoy && u.heroAbility?.safePassage !== undefined) (guides ??= []).push(u)
  }
  return guides ?? NO_GUIDES
}

/**
 * True when `unit` is walking in the lee of a Safe Passage guide — the Causeway
 * Guide's allies ignore slow zones, moat drag and gas clouds entirely. Read by
 * `engine/units.ts` at the point it applies each of those.
 */
export function hasSafePassage(guides: readonly Unit[], unit: Unit): boolean {
  for (const guide of guides) {
    if (guide.owner !== unit.owner) continue
    const passage = guide.heroAbility!.safePassage!
    if (Math.hypot(guide.x - unit.x, guide.y - unit.y) <= passage.range) return true
  }
  return false
}

/** Move-speed bonus granted by a nearby Safe Passage guide (0 when none is in range). */
export function safePassageSpeedBonus(guides: readonly Unit[], unit: Unit): number {
  let bonus = 0
  for (const guide of guides) {
    if (guide.owner !== unit.owner) continue
    const passage = guide.heroAbility!.safePassage!
    if (Math.hypot(guide.x - unit.x, guide.y - unit.y) <= passage.range) {
      bonus = Math.max(bonus, passage.speedBonus)
    }
  }
  return bonus
}

/** 0–1 move-speed multiplier from Cold Snap's chill (1 when not chilled). */
export function chillMoveFactor(unit: Unit): number {
  if (unit.chillTimer == null || unit.chillTimer <= 0) return 1
  return unit.chillMoveMult ?? 1
}

// ─── Reactive: damage hooks ───────────────────────────────

/**
 * Multiplies damage `unit` is about to deal to `target`:
 *  - **Duel** (Masked Duelist) — a bonus against any opponent hitting harder than she does.
 *  - **Breach** (Reach Breaker) — multiplied damage to walls and structures.
 *  - **Cross-Reference** (The Archivist Returned) — everyone hits her marked target harder.
 */
export function heroOutgoingDamage(s: GameState, unit: Unit, target: Unit, dmg: number): number {
  let out = dmg

  const duel = unit.heroAbility?.duel
  if (duel && target.attack > unit.attack) out *= 1 + duel.bonusDamagePct / 100

  const breach = unit.heroAbility?.breach
  if (breach && (target.isWall || target.moveSpeed === 0)) out *= breach.structureDamageMult

  if (target.markedUntil != null && target.markedUntil > s.gameTime && target.markedBonusPct) {
    out *= 1 + target.markedBonusPct / 100
  }

  return Math.round(out)
}

/**
 * Reduces damage `target` is about to take and applies Bulwark's thorns.
 * The Warden of the Marches soaks a share of every hit and sends part of it back
 * at a melee attacker — reflected damage never reflects again.
 */
export function heroIncomingDamage(s: GameState, attacker: Unit, target: Unit, dmg: number, log: string[]): number {
  const bulwark = target.heroAbility?.bulwark
  if (!bulwark) return dmg

  const soaked = Math.max(1, Math.round(dmg * (1 - bulwark.damageReductionPct / 100)))

  // Thorns only answers a melee attacker — a unit that closed to contact to swing.
  if (!attacker.bypassWall && attacker.hp > 0 && bulwark.thornsPct > 0) {
    const thorns = Math.round(dmg * bulwark.thornsPct / 100)
    if (thorns > 0) {
      attacker.hp = Math.max(0, attacker.hp - thorns)
      attacker.damageFlashTimer = DAMAGE_FLASH_MS
      if (attacker.hp <= 0) {
        log.push(`!!🛡️ ${target.name} turns ${attacker.name}'s own blow back on it!`)
      }
    }
  }

  return soaked
}

/** Breach knockback — called once a hit has landed and the target survived it. */
export function afterHeroHit(s: GameState, unit: Unit, target: Unit): void {
  target.lastDamagedAt = s.gameTime
  const breach = unit.heroAbility?.breach
  if (breach && breach.knockbackPx > 0 && target.hp > 0 && !isImmovable(target)) {
    displace(target, retreatDir(target) * breach.knockbackPx)
  }
}

/** Harvest — the First Reaper's attack grows permanently with every kill she lands. */
export function onHeroKill(unit: Unit, victim: Unit, log: string[]): void {
  const harvest = unit.heroAbility?.harvest
  if (!harvest || victim.isDecoy) return
  const stacks = unit.harvestStacks ?? 0
  if (stacks >= harvest.maxStacks) return
  unit.harvestStacks = stacks + 1
  unit.attack += harvest.attackPerKill
  log.push(`!!🌾 ${unit.name} harvests ${victim.name} — attack now ${unit.attack}.`)
}

/** Attack bonus currently granted to `unit` by Last Light (0 when none is running). */
export function tempAttackBonus(s: GameState, unit: Unit): number {
  if (unit.tempAttackUntil == null || unit.tempAttackUntil <= s.gameTime) return 0
  return unit.tempAttackBonus ?? 0
}

/** Attack-speed multiplier from Cold Snap's chill (1 when not chilled). */
export function chillAttackFactor(unit: Unit): number {
  if (unit.chillTimer == null || unit.chillTimer <= 0) return 1
  return unit.chillAtkMult ?? 1
}

// ─── Reactive: deployment ─────────────────────────────────

/**
 * Forced March (Road Captain) — every friendly unit deployed while he lives
 * arrives further up the field and marching faster. Applied to the freshly
 * spawned unit before it is pushed onto the field.
 */
export function applyForcedMarch(field: Unit[], unit: Unit): void {
  if (unit.moveSpeed === 0 || unit.isWall) return
  for (const captain of wardensOf(field, unit.owner, 'forcedMarch')) {
    const march = captain.heroAbility!.forcedMarch!
    displace(unit, -retreatDir(unit) * march.advancePx)
    unit.moveSpeed += march.speedBonus
    return
  }
}

// ─── Per-tick driver ──────────────────────────────────────

export function tickHeroAbilities(s: GameState, deltaMs: number, log: string[]): void {
  expireTimedStates(s, deltaMs)
  applyVigilSaves(s, log)
  applyLastLight(s, log)
  applyDeeproot(s, deltaMs)
  firePeriodicAbilities(s, deltaMs, log)
}

/** Tick down marks, temporary attack surges, chill and reflections. */
function expireTimedStates(s: GameState, deltaMs: number): void {
  for (const unit of s.field) {
    if (unit.chillTimer != null && unit.chillTimer > 0) {
      unit.chillTimer = Math.max(0, unit.chillTimer - deltaMs)
    }
    if (unit.markedUntil != null && unit.markedUntil <= s.gameTime) {
      unit.markedUntil = undefined
      unit.markedBonusPct = undefined
    }
    if (unit.tempAttackUntil != null && unit.tempAttackUntil <= s.gameTime) {
      unit.tempAttackUntil = undefined
      unit.tempAttackBonus = undefined
    }
    if (unit.isDecoy && unit.decoyExpiresAt != null && unit.decoyExpiresAt <= s.gameTime && unit.hp > 0) {
      unit.hp = 0
      unit.deathNotified = true   // a reflection fading is not a fallen ally
    }
  }
}

/**
 * Unbroken Vigil (Vigil Knight) — a lethal blow on an ally standing inside his
 * watch is refused: the ally is left on 1 HP instead. Limited charges, and no
 * ally is saved twice. Reviving a body that is still lingering follows the same
 * shape the Phantom Legion revive already uses in `combat.ts`.
 */
function applyVigilSaves(s: GameState, log: string[]): void {
  const knights = s.field.filter(u => u.hp > 0 && !u.isDecoy && u.heroAbility?.vigil !== undefined)
  if (knights.length === 0) return

  for (const knight of knights) {
    const vigil = knight.heroAbility!.vigil!
    if (knight.vigilChargesLeft == null) knight.vigilChargesLeft = vigil.charges
    if (knight.vigilChargesLeft <= 0) continue

    for (const ally of s.field) {
      if (knight.vigilChargesLeft <= 0) break
      if (ally.owner !== knight.owner || ally.id === knight.id) continue
      if (ally.hp > 0 || ally.vigilSaved || ally.isDecoy) continue
      if (ally.moveSpeed === 0 || ally.isWall) continue
      if (Math.hypot(knight.x - ally.x, knight.y - ally.y) > vigil.range) continue

      ally.hp = 1
      ally.vigilSaved = true
      ally.dyingTimer = undefined
      ally.deathNotified = false
      knight.vigilChargesLeft--
      // processAttacks already booked this unit as a casualty this tick — it did not
      // actually die, so take the count back. (The Phantom Legion revive avoids this
      // by running before the stat loop; the vigil runs a step later and cannot.)
      if (ally.owner === 'player') s.battleStats.playerUnitsLost = Math.max(0, s.battleStats.playerUnitsLost - 1)
      else                        s.battleStats.playerKills     = Math.max(0, s.battleStats.playerKills - 1)
      log.push(`!!🕯️ ${knight.name} keeps the vigil — ${ally.name} will not fall.`)
    }
  }
}

/**
 * Last Light (Candle Sergeant) — a death inside her range is answered, once per
 * fallen ally: the survivors are healed and swing harder for a few seconds.
 * Runs after the vigil saves so a rescued ally is not counted as a casualty.
 */
function applyLastLight(s: GameState, log: string[]): void {
  // Runs every tick, and almost every tick nobody has died — check before allocating.
  let fallen: Unit[] | null = null
  for (const u of s.field) {
    if (u.hp <= 0 && !u.deathNotified && !u.isDecoy && u.moveSpeed > 0 && !u.isWall) (fallen ??= []).push(u)
  }
  if (!fallen) return
  for (const body of fallen) body.deathNotified = true
  const dead = fallen

  for (const sergeant of s.field) {
    if (sergeant.hp <= 0 || sergeant.isDecoy) continue
    const lastLight = sergeant.heroAbility?.lastLight
    if (!lastLight) continue

    const mourned = dead.some(body =>
      body.owner === sergeant.owner &&
      Math.hypot(sergeant.x - body.x, sergeant.y - body.y) <= lastLight.range,
    )
    if (!mourned) continue

    let rallied = 0
    for (const ally of s.field) {
      if (ally.owner !== sergeant.owner || ally.hp <= 0 || ally.isDecoy) continue
      if (Math.hypot(sergeant.x - ally.x, sergeant.y - ally.y) > lastLight.range) continue
      ally.hp = Math.min(ally.maxHp, ally.hp + lastLight.healAmount)
      ally.tempAttackBonus = lastLight.attackBonus
      ally.tempAttackUntil = s.gameTime + lastLight.durationMs
      rallied++
    }
    if (rallied > 0) {
      log.push(`!!🕯️ ${sideLabel(sergeant.owner)} ${sergeant.name} raises the last light — ${rallied} unit(s) rally!`)
    }
  }
}

/**
 * Deeproot (Grove Sentinel) — regenerates while she has gone `calmMs` without
 * being hit. `regenAccum` carries the fraction between ticks so a slow trickle
 * isn't rounded away to nothing every frame.
 */
function applyDeeproot(s: GameState, deltaMs: number): void {
  for (const unit of s.field) {
    const deeproot = unit.heroAbility?.deeproot
    if (!deeproot || unit.hp <= 0) continue

    // "Without taking a hit" has to mean any damage, not just a melee swing. Burn,
    // poison, gas, AOE splash and thorns never route through `afterHeroHit`, so watch
    // her HP instead of the attack path — a drop since last tick is a hit, whatever
    // dealt it. Without this she regenerates straight through a damage-over-time.
    if (unit.lastSeenHp != null && unit.hp < unit.lastSeenHp) unit.lastDamagedAt = s.gameTime

    const calm = unit.lastDamagedAt == null || s.gameTime - unit.lastDamagedAt >= deeproot.calmMs
    if (calm && unit.hp < unit.maxHp) {
      unit.regenAccum = (unit.regenAccum ?? 0) + deeproot.hpPerSec * deltaMs / 1000
      const healed = Math.floor(unit.regenAccum)
      if (healed > 0) {
        unit.regenAccum -= healed
        unit.hp = Math.min(unit.maxHp, unit.hp + healed)
      }
    }
    unit.lastSeenHp = unit.hp
  }
}

/** Drive the one periodic ability each hero may carry off the shared timer. */
function firePeriodicAbilities(s: GameState, deltaMs: number, log: string[]): void {
  // Mirror Step appends to s.field mid-loop and a decoy must not act on the tick it
  // is born, so walk the original length by index rather than copying the field.
  const count = s.field.length
  for (let i = 0; i < count; i++) {
    const unit = s.field[i]
    if (unit.hp <= 0 || unit.isDecoy) continue
    const ability = unit.heroAbility
    if (!ability) continue

    const cooldownMs = ability.crossReference?.cooldownMs ?? ability.undertow?.cooldownMs ??
                       ability.mirrorStep?.cooldownMs ?? ability.coldSnap?.cooldownMs
    if (cooldownMs == null) continue

    if (unit.heroAbilityTimer == null) unit.heroAbilityTimer = cooldownMs
    unit.heroAbilityTimer -= deltaMs
    if (unit.heroAbilityTimer > 0) continue
    unit.heroAbilityTimer = cooldownMs

    if (ability.crossReference) fireCrossReference(s, unit, ability.crossReference, log)
    else if (ability.undertow)  fireUndertow(s, unit, ability.undertow, log)
    else if (ability.mirrorStep) fireMirrorStep(s, unit, ability.mirrorStep, log)
    else if (ability.coldSnap)  fireColdSnap(s, unit, ability.coldSnap, log)
  }
}

/**
 * Cross-Reference (The Archivist Returned) — she finds the most dangerous thing
 * on the field and files it. While the mark holds, everything on her side hits
 * it harder (`heroOutgoingDamage` reads the mark off the target).
 */
function fireCrossReference(
  s: GameState, unit: Unit, def: NonNullable<NonNullable<Unit['heroAbility']>['crossReference']>, log: string[],
): void {
  let best: Unit | null = null
  for (const enemy of s.field) {
    if (enemy.owner === unit.owner || enemy.hp <= 0 || enemy.isDecoy || enemy.isMoat) continue
    if (Math.hypot(enemy.x - unit.x, enemy.y - unit.y) > def.range) continue
    if (enemy.markedUntil != null && enemy.markedUntil > s.gameTime) continue
    if (!best || enemy.attack > best.attack) best = enemy
  }
  if (!best) return

  best.markedUntil = s.gameTime + def.durationMs
  best.markedBonusPct = def.bonusDamagePct
  log.push(`!!📖 ${sideLabel(unit.owner)} ${unit.name} cross-references ${best.name} — +${def.bonusDamagePct}% damage against it!`)
}

/**
 * Undertow (Tide Warden) — the misaligned tide drags every enemy in range back
 * toward the base they came from. Structures and deep-rooted units hold fast.
 */
function fireUndertow(
  s: GameState, unit: Unit, def: NonNullable<NonNullable<Unit['heroAbility']>['undertow']>, log: string[],
): void {
  let dragged = 0
  for (const enemy of s.field) {
    if (enemy.owner === unit.owner || enemy.hp <= 0 || enemy.isMoat) continue
    if (isImmovable(enemy)) continue
    if (Math.hypot(enemy.x - unit.x, enemy.y - unit.y) > def.range) continue
    displace(enemy, retreatDir(enemy) * def.pullPx)
    dragged++
  }
  if (dragged > 0) {
    log.push(`!!🌊 ${sideLabel(unit.owner)} ${unit.name} turns the tide — ${dragged} enemy unit(s) dragged back!`)
  }
}

/**
 * Mirror Step (Marsh Pathfinder) — the marsh shows a version of her that isn't
 * there. The reflection carries her silhouette, deals no damage, and pulls
 * targeting (see `findAttackTarget`) until it evaporates.
 */
function fireMirrorStep(
  s: GameState, unit: Unit, def: NonNullable<NonNullable<Unit['heroAbility']>['mirrorStep']>, log: string[],
): void {
  const template: UnitTemplate = {
    ...unit,
    name: `${unit.name}'s Reflection`,
    attack: 0,
    maxHp: Math.max(1, Math.round(unit.maxHp * def.decoyHpPct / 100)),
    heroAbility: undefined,
    unitTrait: undefined,
    structureEffect: undefined,
    attackEffect: undefined,
  }
  const decoy = spawnUnit(template, unit.owner)
  decoy.x = unit.x
  decoy.y = unit.y
  decoy.isDecoy = true
  decoy.isHero = false
  decoy.spriteName = unit.spriteName ?? unit.name
  decoy.decoyExpiresAt = s.gameTime + def.durationMs
  // The template was spread off a live Unit, so clear the combat/ability state that
  // rode along with it — a reflection starts blank and never inherits her progress.
  decoy.targetId = undefined
  decoy.lastAttackerId = undefined
  decoy.heroAbilityTimer = undefined
  decoy.harvestStacks = undefined
  decoy.vigilChargesLeft = undefined
  decoy.vigilSaved = undefined
  decoy.markedUntil = undefined
  decoy.markedBonusPct = undefined
  decoy.dyingTimer = undefined
  s.field.push(decoy)
  log.push(`!!🪞 ${sideLabel(unit.owner)} ${unit.name} steps through the mirror — the marsh answers with a reflection.`)
}

/**
 * Cold Snap (Winter Warden) — three centuries of stored cold, let out a little
 * at a time. Chill is its own status, not the `freeze` on-hit effect: it drags
 * on movement AND attack speed at once, which nothing else in the engine does.
 */
function fireColdSnap(
  s: GameState, unit: Unit, def: NonNullable<NonNullable<Unit['heroAbility']>['coldSnap']>, log: string[],
): void {
  let chilled = 0
  for (const enemy of s.field) {
    if (enemy.owner === unit.owner || enemy.hp <= 0 || enemy.isMoat) continue
    if (Math.hypot(enemy.x - unit.x, enemy.y - unit.y) > def.range) continue
    enemy.chillTimer   = def.durationMs
    enemy.chillMoveMult = def.slowFactor
    enemy.chillAtkMult  = Math.max(0.1, 1 - def.attackSlowPct / 100)
    chilled++
  }
  if (chilled > 0) {
    log.push(`!!❄️ ${sideLabel(unit.owner)} ${unit.name} lets the winter out — ${chilled} enemy unit(s) chilled!`)
  }
}
