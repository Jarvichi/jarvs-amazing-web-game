/**
 * The thirteen campaign-2 heroes each carry one signature ability, and the whole
 * point is that no two of them are the same card. These tests cover each ability's
 * rule individually, and then guard the property that motivated the work: every
 * chapter-2 hero declares exactly one ability, and no two declare the same one.
 */
import { describe, it, expect } from 'vitest'
import { newGame } from '../engine'
import { HERO_CARDS } from '../cards'
import { spawnUnit } from './helpers'
import { moveUnits } from './units'
import { processAttacks } from './combat'
import { findAttackTarget } from './targeting'
import { deployCard } from './cards'
import {
  tickHeroAbilities, heroOutgoingDamage, heroIncomingDamage, afterHeroHit,
  onHeroKill, applyForcedMarch, hasSafePassage, chillMoveFactor, chillAttackFactor,
} from './heroAbilities'
import { GameState, HeroAbilities, Unit, UnitTemplate } from '../types'

const BASE: UnitTemplate = {
  name: 'Grunt', attack: 10, maxHp: 60, isWall: false, bypassWall: false,
  moveSpeed: 40, attackRange: 20, attackCooldownMs: 1000,
}

/** A battle with an empty field — newGame() seeds commanders we don't want in the way. */
function emptyBattle(): GameState {
  const s = newGame()
  s.field = []
  s.terrain = []
  return s
}

function put(
  s: GameState, owner: 'player' | 'opponent', over: Partial<UnitTemplate> & { heroAbility?: HeroAbilities },
  at?: { x?: number; y?: number },
): Unit {
  const u = spawnUnit({ ...BASE, ...over } as UnitTemplate, owner)
  u.x = at?.x ?? (owner === 'player' ? 100 : 400)
  u.y = at?.y ?? 0
  s.field.push(u)
  return u
}

// ─── Bulwark — Warden of the Marches ──────────────────────

describe('Bulwark', () => {
  const bulwark: HeroAbilities = { bulwark: { damageReductionPct: 50, thornsPct: 50 } }

  it('soaks its share of an incoming blow', () => {
    const s = emptyBattle()
    const warden = put(s, 'player', { heroAbility: bulwark })
    const attacker = put(s, 'opponent', {})
    expect(heroIncomingDamage(s, attacker, warden, 20, [])).toBe(10)
  })

  it('turns a share of a melee blow back on the attacker', () => {
    const s = emptyBattle()
    const warden = put(s, 'player', { heroAbility: bulwark })
    const attacker = put(s, 'opponent', { maxHp: 60 })
    heroIncomingDamage(s, attacker, warden, 20, [])
    expect(attacker.hp).toBe(50)
  })

  it('does not answer a ranged attacker — thorns need contact', () => {
    const s = emptyBattle()
    const warden = put(s, 'player', { heroAbility: bulwark })
    const archer = put(s, 'opponent', { bypassWall: true, maxHp: 60 })
    heroIncomingDamage(s, archer, warden, 20, [])
    expect(archer.hp).toBe(60)
  })

  it('never soaks a hit down to nothing', () => {
    const s = emptyBattle()
    const warden = put(s, 'player', { heroAbility: { bulwark: { damageReductionPct: 99, thornsPct: 0 } } })
    const attacker = put(s, 'opponent', {})
    expect(heroIncomingDamage(s, attacker, warden, 1, [])).toBe(1)
  })
})

// ─── Safe Passage — Causeway Guide ────────────────────────

describe('Safe Passage', () => {
  const passage: HeroAbilities = { safePassage: { range: 100, speedBonus: 20 } }

  it('covers allies inside the guide’s range and nobody else', () => {
    const s = emptyBattle()
    put(s, 'player', { heroAbility: passage }, { x: 100 })
    const near = put(s, 'player', {}, { x: 150 })
    const far  = put(s, 'player', {}, { x: 350 })
    const enemy = put(s, 'opponent', {}, { x: 150 })

    expect(hasSafePassage(s.field, near)).toBe(true)
    expect(hasSafePassage(s.field, far)).toBe(false)
    expect(hasSafePassage(s.field, enemy)).toBe(false)
  })

  it('marches a covered ally faster than an uncovered one', () => {
    const guided = emptyBattle()
    put(guided, 'player', { heroAbility: passage, moveSpeed: 0, attack: 0 }, { x: 100 })
    const withGuide = put(guided, 'player', { attack: 0 }, { x: 120 })
    withGuide.advanceY = 0

    const alone = emptyBattle()
    const noGuide = put(alone, 'player', { attack: 0 }, { x: 120 })
    noGuide.advanceY = 0

    moveUnits(guided, 500)
    moveUnits(alone, 500)

    expect(withGuide.x).toBeGreaterThan(noGuide.x)
  })
})

// ─── Harvest — First Reaper ───────────────────────────────

describe('Harvest', () => {
  const harvest: HeroAbilities = { harvest: { attackPerKill: 3, maxStacks: 2 } }

  it('raises the reaper’s own attack with each kill, then stops at the cap', () => {
    const s = emptyBattle()
    const reaper = put(s, 'player', { heroAbility: harvest, attack: 10 })
    const victim = put(s, 'opponent', {})

    onHeroKill(reaper, victim, [])
    expect(reaper.attack).toBe(13)
    onHeroKill(reaper, victim, [])
    expect(reaper.attack).toBe(16)
    onHeroKill(reaper, victim, [])
    expect(reaper.attack).toBe(16)
  })

  it('does not count a reflection as a harvest', () => {
    const s = emptyBattle()
    const reaper = put(s, 'player', { heroAbility: harvest, attack: 10 })
    const decoy = put(s, 'opponent', {})
    decoy.isDecoy = true

    onHeroKill(reaper, decoy, [])
    expect(reaper.attack).toBe(10)
  })
})

// ─── Cross-Reference — The Archivist Returned ─────────────

describe('Cross-Reference', () => {
  const crossRef: HeroAbilities = {
    crossReference: { cooldownMs: 1000, range: 200, bonusDamagePct: 50, durationMs: 3000 },
  }

  it('marks the hardest hitter in range, not the nearest body', () => {
    const s = emptyBattle()
    put(s, 'player', { heroAbility: crossRef, attack: 0 }, { x: 100 })
    const weak   = put(s, 'opponent', { attack: 5 },  { x: 130 })
    const strong = put(s, 'opponent', { attack: 30 }, { x: 250 })

    tickHeroAbilities(s, 1000, [])

    expect(strong.markedUntil).toBeGreaterThan(s.gameTime)
    expect(weak.markedUntil).toBeUndefined()
  })

  it('makes every ally hit the marked target harder, until the mark lapses', () => {
    const s = emptyBattle()
    const ally = put(s, 'player', {}, { x: 100 })
    const marked = put(s, 'opponent', { attack: 30 }, { x: 150 })
    marked.markedUntil = s.gameTime + 1000
    marked.markedBonusPct = 50

    expect(heroOutgoingDamage(s, ally, marked, 20)).toBe(30)

    marked.markedUntil = s.gameTime - 1
    expect(heroOutgoingDamage(s, ally, marked, 20)).toBe(20)
  })

  it('clears an expired mark', () => {
    const s = emptyBattle()
    const marked = put(s, 'opponent', {})
    marked.markedUntil = s.gameTime
    marked.markedBonusPct = 50

    tickHeroAbilities(s, 16, [])

    expect(marked.markedUntil).toBeUndefined()
    expect(marked.markedBonusPct).toBeUndefined()
  })
})

// ─── Last Light — Candle Sergeant ─────────────────────────

describe('Last Light', () => {
  const lastLight: HeroAbilities = {
    lastLight: { range: 100, healAmount: 12, attackBonus: 6, durationMs: 5000 },
  }

  it('heals and rallies the survivors when an ally falls in range', () => {
    const s = emptyBattle()
    const sergeant = put(s, 'player', { heroAbility: lastLight }, { x: 100 })
    const survivor = put(s, 'player', {}, { x: 140 })
    survivor.hp = 30
    const fallen = put(s, 'player', {}, { x: 120 })
    fallen.hp = 0

    tickHeroAbilities(s, 16, [])

    expect(survivor.hp).toBe(42)
    expect(survivor.tempAttackBonus).toBe(6)
    expect(survivor.tempAttackUntil).toBeGreaterThan(s.gameTime)
    expect(sergeant.tempAttackBonus).toBe(6)
  })

  it('answers each fallen ally once, not once per tick while the body lingers', () => {
    const s = emptyBattle()
    put(s, 'player', { heroAbility: lastLight }, { x: 100 })
    const survivor = put(s, 'player', {}, { x: 140 })
    survivor.hp = 10
    const fallen = put(s, 'player', {}, { x: 120 })
    fallen.hp = 0
    fallen.dyingTimer = 1200

    tickHeroAbilities(s, 16, [])
    const afterFirst = survivor.hp
    tickHeroAbilities(s, 16, [])

    expect(survivor.hp).toBe(afterFirst)
  })

  it('ignores an enemy death', () => {
    const s = emptyBattle()
    const survivor = put(s, 'player', { heroAbility: lastLight }, { x: 100 })
    survivor.hp = 30
    const enemy = put(s, 'opponent', {}, { x: 120 })
    enemy.hp = 0

    tickHeroAbilities(s, 16, [])

    expect(survivor.hp).toBe(30)
  })
})

// ─── Undertow — Tide Warden ───────────────────────────────

describe('Undertow', () => {
  const undertow: HeroAbilities = { undertow: { cooldownMs: 1000, range: 150, pullPx: 40 } }

  it('drags enemies in range back toward their own base', () => {
    const s = emptyBattle()
    put(s, 'player', { heroAbility: undertow, attack: 0 }, { x: 200 })
    const near = put(s, 'opponent', { attack: 0 }, { x: 250 })
    const far  = put(s, 'opponent', { attack: 0 }, { x: 450 })

    tickHeroAbilities(s, 1000, [])

    expect(near.x).toBe(290)
    expect(far.x).toBe(450)
  })

  it('leaves structures and deep-rooted units where they stand', () => {
    const s = emptyBattle()
    put(s, 'player', { heroAbility: undertow, attack: 0 }, { x: 200 })
    const building = put(s, 'opponent', { moveSpeed: 0, attack: 0 }, { x: 250 })
    const rooted = put(s, 'opponent', { attack: 0, heroAbility: { deeproot: { hpPerSec: 1, calmMs: 1000 } } }, { x: 250 })

    tickHeroAbilities(s, 1000, [])

    expect(building.x).toBe(250)
    expect(rooted.x).toBe(250)
  })
})

// ─── Mirror Step — Marsh Pathfinder ───────────────────────

describe('Mirror Step', () => {
  const mirror: HeroAbilities = { mirrorStep: { cooldownMs: 1000, decoyHpPct: 50, durationMs: 2000 } }

  it('leaves a reflection that carries her silhouette but none of her bite', () => {
    const s = emptyBattle()
    const pathfinder = put(s, 'player', { heroAbility: mirror, maxHp: 60 }, { x: 200 })

    tickHeroAbilities(s, 1000, [])

    const decoy = s.field.find(u => u.isDecoy)
    expect(decoy).toBeDefined()
    expect(decoy!.attack).toBe(0)
    expect(decoy!.maxHp).toBe(30)
    expect(decoy!.spriteName).toBe(pathfinder.spriteName ?? pathfinder.name)
    expect(decoy!.heroAbility).toBeUndefined()
  })

  it('evaporates once its time is up', () => {
    const s = emptyBattle()
    put(s, 'player', { heroAbility: mirror }, { x: 200 })
    tickHeroAbilities(s, 1000, [])
    const decoy = s.field.find(u => u.isDecoy)!

    s.gameTime += 3000
    tickHeroAbilities(s, 16, [])

    expect(decoy.hp).toBe(0)
  })

  it('pulls enemy fire off the real column', () => {
    const s = emptyBattle()
    const real = put(s, 'player', {}, { x: 200 })
    const decoy = put(s, 'player', { attack: 0 }, { x: 205 })
    decoy.isDecoy = true
    const enemy = put(s, 'opponent', { attackRange: 100 }, { x: 240 })

    expect(findAttackTarget(s.field, enemy)?.id).toBe(decoy.id)
    expect(real.hp).toBe(real.maxHp)
  })

  it('does not book a fading reflection as a lost unit', () => {
    const s = emptyBattle()
    put(s, 'player', { heroAbility: mirror }, { x: 200 })
    tickHeroAbilities(s, 1000, [])
    s.gameTime += 3000
    tickHeroAbilities(s, 16, [])

    const before = s.battleStats.playerUnitsLost
    processAttacks(s, 16, [])

    expect(s.battleStats.playerUnitsLost).toBe(before)
  })
})

// ─── Duel — Masked Duelist ────────────────────────────────

describe('Duel', () => {
  const duel: HeroAbilities = { duel: { bonusDamagePct: 50 } }

  it('challenges the hardest hitter in reach rather than the closest', () => {
    const s = emptyBattle()
    const duelist = put(s, 'player', { heroAbility: duel, attackRange: 200 }, { x: 100 })
    put(s, 'opponent', { attack: 5 }, { x: 130 })
    const strong = put(s, 'opponent', { attack: 40 }, { x: 260 })

    expect(findAttackTarget(s.field, duelist)?.id).toBe(strong.id)
  })

  it('hits harder than usual only against something that outguns her', () => {
    const s = emptyBattle()
    const duelist = put(s, 'player', { heroAbility: duel, attack: 11 })
    const stronger = put(s, 'opponent', { attack: 40 })
    const weaker   = put(s, 'opponent', { attack: 5 })

    expect(heroOutgoingDamage(s, duelist, stronger, 20)).toBe(30)
    expect(heroOutgoingDamage(s, duelist, weaker, 20)).toBe(20)
  })
})

// ─── Cold Snap — Winter Warden ────────────────────────────

describe('Cold Snap', () => {
  const coldSnap: HeroAbilities = {
    coldSnap: { cooldownMs: 1000, range: 150, slowFactor: 0.5, attackSlowPct: 40, durationMs: 4000 },
  }

  it('drags on enemy movement AND swing speed at once', () => {
    const s = emptyBattle()
    put(s, 'player', { heroAbility: coldSnap, attack: 0 }, { x: 200 })
    const enemy = put(s, 'opponent', { attack: 0 }, { x: 250 })

    tickHeroAbilities(s, 1000, [])

    expect(enemy.chillTimer).toBe(4000)
    expect(chillMoveFactor(enemy)).toBe(0.5)
    expect(chillAttackFactor(enemy)).toBeCloseTo(0.6)
  })

  it('spares the warden’s own side', () => {
    const s = emptyBattle()
    put(s, 'player', { heroAbility: coldSnap, attack: 0 }, { x: 200 })
    const ally = put(s, 'player', { attack: 0 }, { x: 250 })

    tickHeroAbilities(s, 1000, [])

    expect(chillMoveFactor(ally)).toBe(1)
  })

  it('thaws once the chill runs out', () => {
    const s = emptyBattle()
    const enemy = put(s, 'opponent', {})
    enemy.chillTimer = 100
    enemy.chillMoveMult = 0.5

    tickHeroAbilities(s, 200, [])

    expect(chillMoveFactor(enemy)).toBe(1)
  })
})

// ─── Deeproot — Grove Sentinel ────────────────────────────

describe('Deeproot', () => {
  const deeproot: HeroAbilities = { deeproot: { hpPerSec: 10, calmMs: 3000 } }

  it('regrows once she has gone long enough without a hit', () => {
    const s = emptyBattle()
    const sentinel = put(s, 'player', { heroAbility: deeproot, maxHp: 60 })
    sentinel.hp = 30

    tickHeroAbilities(s, 1000, [])

    expect(sentinel.hp).toBe(40)
  })

  it('holds off while she is still being hit', () => {
    const s = emptyBattle()
    const sentinel = put(s, 'player', { heroAbility: deeproot, maxHp: 60 })
    sentinel.hp = 30
    sentinel.lastDamagedAt = s.gameTime

    tickHeroAbilities(s, 1000, [])

    expect(sentinel.hp).toBe(30)
  })

  it('never overgrows her own maximum', () => {
    const s = emptyBattle()
    const sentinel = put(s, 'player', { heroAbility: deeproot, maxHp: 60 })
    sentinel.hp = 58

    tickHeroAbilities(s, 1000, [])

    expect(sentinel.hp).toBe(60)
  })
})

// ─── Forced March — Road Captain ──────────────────────────

describe('Forced March', () => {
  const march: HeroAbilities = { forcedMarch: { advancePx: 60, speedBonus: 10 } }

  it('lands a newly deployed unit further forward and marching faster', () => {
    const s = emptyBattle()
    put(s, 'player', { heroAbility: march }, { x: 100 })
    const recruit = spawnUnit(BASE, 'player')
    const startX = recruit.x

    applyForcedMarch(s.field, recruit)

    expect(recruit.x).toBe(startX + 60)
    expect(recruit.moveSpeed).toBe(BASE.moveSpeed + 10)
  })

  it('pushes an opponent’s recruit forward along their own axis', () => {
    const s = emptyBattle()
    put(s, 'opponent', { heroAbility: march }, { x: 400 })
    const recruit = spawnUnit(BASE, 'opponent')
    const startX = recruit.x

    applyForcedMarch(s.field, recruit)

    expect(recruit.x).toBe(startX - 60)
  })

  it('leaves structures at the base where they belong', () => {
    const s = emptyBattle()
    put(s, 'player', { heroAbility: march }, { x: 100 })
    const farm = spawnUnit({ ...BASE, moveSpeed: 0 }, 'player')
    const startX = farm.x

    applyForcedMarch(s.field, farm)

    expect(farm.x).toBe(startX)
  })

  it('reaches units deployed through deployCard', () => {
    const s = emptyBattle()
    put(s, 'player', { name: 'Captain', heroAbility: march }, { x: 100 })
    const card = { id: 'c1', name: 'Recruit', rarity: 'common' as const, cost: 1, cardType: 'unit' as const, unit: { ...BASE, name: 'Recruit' }, description: '' }

    deployCard(s, card, 'player', [])

    const recruit = s.field.find(u => u.name === 'Recruit')!
    expect(recruit.moveSpeed).toBe(BASE.moveSpeed + 10)
  })
})

// ─── Breach — Reach Breaker ───────────────────────────────

describe('Breach', () => {
  const breach: HeroAbilities = { breach: { knockbackPx: 30, structureDamageMult: 2 } }

  it('hits walls and buildings for a multiple of the usual damage', () => {
    const s = emptyBattle()
    const breaker = put(s, 'player', { heroAbility: breach })
    const wall = put(s, 'opponent', { isWall: true, moveSpeed: 0 })
    const trooper = put(s, 'opponent', {})

    expect(heroOutgoingDamage(s, breaker, wall, 20)).toBe(40)
    expect(heroOutgoingDamage(s, breaker, trooper, 20)).toBe(20)
  })

  it('knocks a surviving target backwards', () => {
    const s = emptyBattle()
    const breaker = put(s, 'player', { heroAbility: breach }, { x: 200 })
    const trooper = put(s, 'opponent', {}, { x: 220 })

    afterHeroHit(s, breaker, trooper)

    expect(trooper.x).toBe(250)
  })

  it('does not shift a wall it cannot move', () => {
    const s = emptyBattle()
    const breaker = put(s, 'player', { heroAbility: breach }, { x: 200 })
    const wall = put(s, 'opponent', { isWall: true, moveSpeed: 0 }, { x: 220 })

    afterHeroHit(s, breaker, wall)

    expect(wall.x).toBe(220)
  })
})

// ─── Unbroken Vigil — Vigil Knight ────────────────────────

describe('Unbroken Vigil', () => {
  const vigil: HeroAbilities = { vigil: { range: 100, charges: 2 } }

  it('refuses a lethal blow on an ally in range, leaving it standing', () => {
    const s = emptyBattle()
    put(s, 'player', { heroAbility: vigil }, { x: 200 })
    const ally = put(s, 'player', {}, { x: 240 })
    ally.hp = 0
    ally.dyingTimer = 1200

    tickHeroAbilities(s, 16, [])

    expect(ally.hp).toBe(1)
    expect(ally.dyingTimer).toBeUndefined()
  })

  it('saves each ally only once', () => {
    const s = emptyBattle()
    put(s, 'player', { heroAbility: vigil }, { x: 200 })
    const ally = put(s, 'player', {}, { x: 240 })
    ally.hp = 0
    tickHeroAbilities(s, 16, [])
    ally.hp = 0

    tickHeroAbilities(s, 16, [])

    expect(ally.hp).toBe(0)
  })

  it('runs out of charges', () => {
    const s = emptyBattle()
    const knight = put(s, 'player', { heroAbility: vigil }, { x: 200 })
    const allies = [1, 2, 3].map(i => {
      const a = put(s, 'player', {}, { x: 200 + i })
      a.hp = 0
      return a
    })

    tickHeroAbilities(s, 16, [])

    expect(knight.vigilChargesLeft).toBe(0)
    expect(allies.filter(a => a.hp === 1)).toHaveLength(2)
  })

  it('does not reach an ally outside the watch, or an enemy inside it', () => {
    const s = emptyBattle()
    put(s, 'player', { heroAbility: vigil }, { x: 200 })
    const distant = put(s, 'player', {}, { x: 400 })
    distant.hp = 0
    const enemy = put(s, 'opponent', {}, { x: 240 })
    enemy.hp = 0

    tickHeroAbilities(s, 16, [])

    expect(distant.hp).toBe(0)
    expect(enemy.hp).toBe(0)
  })
})

// ─── The property that motivated all of the above ─────────

describe('hero card abilities are not copies of each other', () => {
  /** Chapter-2 heroes: the ones that shipped as thirteen recolours of one card. */
  const CHAPTER_2 = HERO_CARDS.filter(c => c.unit?.heroAbility !== undefined)

  it('covers all thirteen chapter-2 heroes', () => {
    expect(CHAPTER_2).toHaveLength(13)
  })

  it('gives each hero exactly one signature ability', () => {
    const offenders = CHAPTER_2
      .map(c => ({ name: c.name, keys: Object.keys(c.unit!.heroAbility!) }))
      .filter(h => h.keys.length !== 1)
    expect(offenders, `heroes without exactly one ability: ${JSON.stringify(offenders)}`).toEqual([])
  })

  it('gives no two heroes the same ability', () => {
    const byAbility = new Map<string, string[]>()
    for (const card of CHAPTER_2) {
      const key = Object.keys(card.unit!.heroAbility!)[0]
      byAbility.set(key, [...(byAbility.get(key) ?? []), card.name])
    }
    const shared = [...byAbility.entries()].filter(([, names]) => names.length > 1)
    expect(shared, `abilities used by more than one hero: ${JSON.stringify(shared)}`).toEqual([])
  })

  it('does not reissue a chapter-1 trick as a chapter-2 signature', () => {
    const chapterOneTricks = [
      'teleportAbility', 'invisibilityAbility', 'bloodSummonAbility',
      'halfHealthEffect', 'onDeathEffect', 'structureEffect',
    ] as const
    const offenders: string[] = []
    for (const card of CHAPTER_2) {
      for (const trick of chapterOneTricks) {
        if (card.unit![trick] !== undefined) offenders.push(`${card.name}: ${trick}`)
      }
    }
    expect(offenders, `chapter-2 heroes reusing a chapter-1 mechanic: ${offenders.join(', ')}`).toEqual([])
  })

  it('leaves the guardBase stance to the one hero whose card it is', () => {
    const guards = CHAPTER_2.filter(c => c.unit!.unitTrait?.guardBase).map(c => c.name)
    expect(guards).toEqual(['Warden of the Marches'])
  })

  it('describes each signature ability on the card the player reads', () => {
    const missing = CHAPTER_2
      .filter(c => !/[A-Z]{2,}[A-Z -]*:/.test(c.description.replace('HERO:', '')))
      .map(c => c.name)
    expect(missing, `heroes whose description never names their ability: ${missing.join(', ')}`).toEqual([])
  })
})
