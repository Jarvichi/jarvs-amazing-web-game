import { logError } from '../../logger';
import { GameState, UpgradeEffect, Unit, BuffTag, LANE_WIDTH } from '../types';
import { spawnUnit } from './helpers';
import { drawCard } from './helpers';
import {  Card, UnitTemplate } from '../types';
import { playUpgrade } from '../sound';
import {
  ARCH_STRUCTURE_COST_REDUCTION, ARCH_STRUCTURE_HP_MULT,
  ARCH_SWARM_UNIT_THRESHOLD, ARCH_SWARM_COST_REDUCTION,
  ARCH_SCHOLAR_UPGRADE_MULT,
} from './constants';
import { DEATH_LINGER_MS } from './combat';

/** Returns the mana cost the player actually pays for a card, after archetype passives. */
export function getEffectiveCardCost(card: Card, state: GameState): number {
  const archetype = state.archetypePassive
  if (archetype === 'siege_commander' && card.cardType === 'structure') {
    return Math.max(0, card.cost - ARCH_STRUCTURE_COST_REDUCTION)
  }
  if (archetype === 'swarm_tactician' && card.cardType === 'unit') {
    const mobileCount = state.field.filter(u => u.owner === 'player' && !u.isWall && u.moveSpeed > 0).length
    if (mobileCount >= ARCH_SWARM_UNIT_THRESHOLD) {
      return Math.max(0, card.cost - ARCH_SWARM_COST_REDUCTION)
    }
  }
  return card.cost
}

// ─── Deploy a card onto the field ────────────────────────
export function deployCard(s: GameState, card: Card, owner: 'player' | 'opponent', log: string[]): void {
  if (card.cardType === 'unit' || card.cardType === 'structure') {
    if (!card.unit || typeof card.unit.maxHp !== 'number') {
      logError('deployCard: card has no valid unit template', { cardName: card.name, cardType: card.cardType, owner });
      return;
    }
    // If playing a structure and one of the same type exists below max level, upgrade it instead
    if (card.cardType === 'structure') {
      const template = card.unit;
      const existing = s.field.find(u => u.owner === owner && u.name === template.name && (u.upgradeLevel ?? 1) < MAX_UPGRADE_LEVEL);
      if (existing) {
        // Moat: indestructible — upgrade widens and deepens the slow zone instead of doubling HP
        if (existing.isMoat) {
          const effect = existing.structureEffect as { type: 'slowZone'; slowFactor: number; radius: number; damagePerSec?: number } | undefined
          if (effect?.type === 'slowZone') {
            const oldRadius = effect.radius
            effect.radius     = Math.round(effect.radius * 1.5)
            effect.slowFactor = Math.max(0.15, parseFloat((effect.slowFactor - 0.05).toFixed(2)))
            existing.upgradeLevel = (existing.upgradeLevel ?? 1) + 1
            const pct = Math.round(effect.slowFactor * 100)
            const who = owner === 'player' ? 'You' : 'Opponent'
            let note = `${oldRadius}→${effect.radius}px wide, slows to ${pct}% speed`
            if (effect.damagePerSec) {
              const oldDmg = effect.damagePerSec
              effect.damagePerSec = Math.round(effect.damagePerSec * 1.35)
              note += `, dmg ${oldDmg}→${effect.damagePerSec}/s`
            }
            log.push(`${who} upgraded ${existing.name}! (${note})`)
            if (owner === 'player') playUpgrade()
          }
          return
        }
        existing.maxHp *= 2;
        existing.hp = existing.maxHp;
        existing.upgradeLevel = (existing.upgradeLevel ?? 1) + 1;
        let note = 'HP×2';
        if (existing.structureEffect?.type === 'spawn') {
          const spawnEffect = existing.structureEffect as { type: 'spawn'; unitTemplate: UnitTemplate; intervalMs: number; };
          spawnEffect.intervalMs = Math.max(1500, Math.floor(spawnEffect.intervalMs / 2));
          if (existing.spawnTimer != null) {
            existing.spawnTimer = Math.min(existing.spawnTimer, spawnEffect.intervalMs);
          }
          note += ', spawn×2';
        }
        if (existing.structureEffect?.type === 'mana') {
          const manaEffect = existing.structureEffect as { type: 'mana'; amount: number; };
          manaEffect.amount += 1;
          note += ', mana+1';
        }
        if (existing.structureEffect?.type === 'manaSpeed') {
          const msEffect = existing.structureEffect as { type: 'manaSpeed'; speedMult: number; };
          msEffect.speedMult += 0.5;
          note += ', speed+50%';
        }
        if (existing.structureEffect?.type === 'healAura') {
          const hEffect = existing.structureEffect as { type: 'healAura'; amount: number; intervalMs: number; };
          hEffect.intervalMs = Math.max(2000, Math.floor(hEffect.intervalMs / 2));
          if (existing.spawnTimer != null) existing.spawnTimer = Math.min(existing.spawnTimer, hEffect.intervalMs);
          note += ', heal×2';
        }
        if (existing.structureEffect?.type === 'repairAura') {
          const rEffect = existing.structureEffect as { type: 'repairAura'; amount: number; intervalMs: number; };
          rEffect.intervalMs = Math.max(2000, Math.floor(rEffect.intervalMs / 2));
          if (existing.spawnTimer != null) existing.spawnTimer = Math.min(existing.spawnTimer, rEffect.intervalMs);
          note += ', repair×2';
        }
        if (existing.structureEffect?.type === 'attackAura') {
          const aEffect = existing.structureEffect as { type: 'attackAura'; amount: number; };
          aEffect.amount += 2;
          note += ', atk+2';
        }
        const who = owner === 'player' ? 'You' : 'Opponent';
        log.push(`${who} upgraded ${existing.name}! (${note})`);
        if (owner === 'player') playUpgrade();
        return;
      }
    }
    const unit = spawnUnit(card.unit, owner);
    if (owner === 'player' && s.onCardPlayedEffects?.length) {
      for (const e of s.onCardPlayedEffects) {
        if (e.attackBonus) unit.attack = Math.max(0, unit.attack + e.attackBonus)
      }
    }
    // Siege Commander: new structures get +20% max HP
    if (owner === 'player' && card.cardType === 'structure' && s.archetypePassive === 'siege_commander') {
      unit.maxHp = Math.round(unit.maxHp * ARCH_STRUCTURE_HP_MULT)
      unit.hp    = unit.maxHp
    }
    if (card.lore) unit.lore = card.lore;
    // Hero units use the card's display name but keep the base unit sprite
    if (card.isHero) {
      unit.spriteName = unit.name; // preserve original name for sprite lookup
      unit.name = card.name;
      unit.isHero = true;
    }
    // Assign a stable lateral slot to non-wall structures so that units
    // spawned from them start at the same horizontal position.
    if (card.cardType === 'structure' && !card.unit.isWall) {
      // Spread buildings evenly; pick first slot not already occupied by a same-side structure
      const STRUCTURE_Y_SLOTS = [-65, -40, -15, 15, 40, 65, -55, -25, 5, 30, 55, 0, -75, -50, 50, 75];
      const usedY = new Set(
        s.field.filter(u => u.moveSpeed === 0 && !u.isWall && u.owner === owner).map(u => u.y)
      );
      unit.y = STRUCTURE_Y_SLOTS.find(y => !usedY.has(y)) ?? STRUCTURE_Y_SLOTS[0];
    }
    s.field.push(unit);
    const verb = card.cardType === 'structure' ? 'built' : 'deployed';
    const who = owner === 'player' ? 'You' : 'Opponent';
    // Hero cards deploy their unit AND apply a buff to all friendly units
    if (card.isHero && card.heroEffect) {
      log.push(`!!★ HERO ${card.name} unleashed by ${who}!`);
      applyUpgrade(s, card.heroEffect, owner, log);
    } else {
      log.push(`${who} ${verb} ${unit.name}.`);
    }
    // Glass cards: chance to shatter immediately after deployment
    if (card.glassBreakChance && Math.random() < card.glassBreakChance) {
      unit.hp = 0;
      unit.dyingTimer = 400;
      log.push(`💎 ${unit.name} shattered!`);
      s.glassShatterCount = (s.glassShatterCount ?? 0) + 1;
    }
  } else if (card.cardType === 'upgrade' && card.upgradeEffect) {
    applyUpgrade(s, card.upgradeEffect, owner, log);
  }
}// ─── Play Card (immediate deploy + cooldown) ─────────────

export const MAX_UPGRADE_LEVEL = 4

export function playCard(state: GameState, cardId: string): GameState {
  if (state.phase.type !== 'playing') return state

  const cardIdx = state.playerHand.findIndex(c => c.id === cardId)
  if (cardIdx === -1) return state

  const card = state.playerHand[cardIdx]
  const effectiveCost = getEffectiveCardCost(card, state)
  if (state.mana < effectiveCost) return state

  // For structures: if there's no upgradeable copy below max level, a new building will be placed.
  // In endless mode, block that new placement once the 3-row limit is reached.
  if (card.cardType === 'structure' && card.unit) {
    const upgradeable = state.field.find(
      u => u.owner === 'player' && u.name === card.unit!.name && (u.upgradeLevel ?? 1) < MAX_UPGRADE_LEVEL
    )
    if (!upgradeable && state.endlessMode && !card.unit.isWall) {
      const playerStructures = state.field.filter(u => u.owner === 'player' && u.moveSpeed === 0 && !u.isWall)
      const row = Math.floor(playerStructures.length / 6)
      if (row >= 3) {
        const s = structuredClone(state)
        s.log.push('Endless mode: buildings are limited to 3 rows from your base.')
        return s
      }
    }
  }

  const s = structuredClone(state)
  s.playerHand.splice(cardIdx, 1)
  s.mana -= effectiveCost

  // Arcane Scholar: double upgrade effect amounts before applying
  const isScholarUpgrade =
    s.archetypePassive === 'arcane_scholar' &&
    card.cardType === 'upgrade' &&
    card.upgradeEffect != null
  const cardToPlay: Card = isScholarUpgrade
    ? { ...card, upgradeEffect: scaleUpgradeEffect(card.upgradeEffect!, ARCH_SCHOLAR_UPGRADE_MULT) }
    : card

  deployCard(s, cardToPlay, 'player', s.log)
  if (!s.secretRaresObtained) s.secretRaresObtained = []
  drawCard(s.playerDeck, s.playerHand, s.secretRaresObtained)
  // Arcane Scholar: draw an extra card after each upgrade
  if (isScholarUpgrade) {
    drawCard(s.playerDeck, s.playerHand, s.secretRaresObtained)
  }
  return s
}

/** Scale all numeric amount fields on an UpgradeEffect by a multiplier. */
function scaleUpgradeEffect(effect: UpgradeEffect, mult: number): UpgradeEffect {
  switch (effect.type) {
    case 'buffAttack':        return { ...effect, amount: Math.round(effect.amount * mult) }
    case 'healUnits':         return { ...effect, amount: Math.round(effect.amount * mult) }
    case 'buffSpeed':         return { ...effect, amount: Math.round(effect.amount * mult) }
    case 'buffMaxHp':         return { ...effect, amount: Math.round(effect.amount * mult) }
    case 'buffRange':         return { ...effect, amount: Math.round(effect.amount * mult) }
    case 'buffHp':            return { ...effect, amount: Math.round(effect.amount * mult) }
    case 'buffHeal':          return { ...effect, amount: Math.round(effect.amount * mult) }
    case 'buffAttackCooldown': return { ...effect, amount: Math.round(effect.amount * mult) }
    case 'aoe': return {
      ...effect,
      damage: effect.damage != null ? Math.round(effect.damage * mult) : undefined,
      amount: effect.amount != null ? Math.round(effect.amount * mult) : undefined,
    }
    default: return effect
  }
}
/** Play an AoE upgrade card with a player-chosen target point (cx, cy in game units). */

export function playAoeCard(state: GameState, cardId: string, cx: number, cy: number): GameState {
  if (state.phase.type !== 'playing') return state
  const cardIdx = state.playerHand.findIndex(c => c.id === cardId)
  if (cardIdx === -1) return state
  const card = state.playerHand[cardIdx]
  const effectiveCost = getEffectiveCardCost(card, state)
  if (state.mana < effectiveCost) return state
  if (card.cardType !== 'upgrade' || !card.upgradeEffect || card.upgradeEffect.type !== 'aoe') return state
  if (card.isHero && state.gameTime < 30000) return state

  const s = structuredClone(state)
  s.playerHand.splice(cardIdx, 1)
  s.mana -= effectiveCost

  const rawEffect = card.upgradeEffect
  const effect = s.archetypePassive === 'arcane_scholar'
    ? scaleUpgradeEffect(rawEffect, ARCH_SCHOLAR_UPGRADE_MULT) as typeof rawEffect & { type: 'aoe' }
    : rawEffect
  const dmg = effect.damage ?? effect.amount ?? 0
  const enemies = s.field.filter(u => u.owner !== 'player' && !u.isWall)
  const targets = effect.range != null
    ? enemies.filter(e => Math.sqrt((e.x - cx) ** 2 + (e.y - cy) ** 2) <= effect.range!)
    : enemies
  for (const u of targets) {
    u.hp -= dmg
    u.damageFlashTimer = 200
    // Mark mobile kills as dying so they linger for the death animation and aren't
    // silently purged before the commander/base HP sync + game-over check can see them.
    if (u.hp <= 0 && u.moveSpeed > 0 && !u.isWall) u.dyingTimer = DEATH_LINGER_MS
  }
  s.log.push(`Your AOE! ${targets.length} enem${targets.length === 1 ? 'y' : 'ies'} hit for ${dmg} damage.`)

  if (!s.secretRaresObtained) s.secretRaresObtained = []
  drawCard(s.playerDeck, s.playerHand, s.secretRaresObtained)
  // Arcane Scholar: draw an extra card after each upgrade
  if (s.archetypePassive === 'arcane_scholar') {
    drawCard(s.playerDeck, s.playerHand, s.secretRaresObtained)
  }
  return s
}
// ─── Apply Upgrade ────────────────────────────────────────

export function applyUpgrade(s: GameState, effect: UpgradeEffect, owner: 'player' | 'opponent', log: string[]): void {
  const units = s.field.filter(u => u.owner === owner)
  const label = owner === 'player' ? 'Your' : 'Enemy'
  const addBuff = (u: Unit, tag: BuffTag) => {
    if (!u.buffs) u.buffs = []
    if (!u.buffs.includes(tag)) u.buffs.push(tag)
  }
  if (effect.type === 'buffAttack') {
    for (const u of units) { u.attack += effect.amount; addBuff(u, 'atk')} 
    log.push(`${label} units gain +${effect.amount} attack!`)
  } else if (effect.type === 'healUnits') {
    for (const u of units) if (u.hp >= 1) u.hp = Math.min(u.maxHp, u.hp + effect.amount)
    log.push(`${label} units healed ${effect.amount} HP.`)
  } else if (effect.type === 'buffSpeed') {
    for (const u of units) if (u.moveSpeed > 0) { u.moveSpeed += effect.amount; addBuff(u, 'spd')} 
    log.push(`${label} units surge +${effect.amount} speed!`)
  } else if (effect.type === 'buffMaxHp') {
    for (const u of units) if (u.moveSpeed > 0 && u.hp >= 1) { u.maxHp += effect.amount; u.hp = Math.min(u.hp + effect.amount, u.maxHp); addBuff(u, 'hp')}
    log.push(`${label} units gain +${effect.amount} max HP!`)
  } else if (effect.type === 'buffRange') {
    for (const u of units) if (u.attackRange > 0) { u.attackRange += effect.amount; addBuff(u, 'range')} 
    log.push(`${label} units gain +${effect.amount} attack range!`)
  } else if (effect.type === 'aoe') {
    const dmg = effect.damage ?? effect.amount ?? 0
    const enemies = s.field.filter(u => u.owner !== owner && !u.isWall)
    const targets = effect.range != null
      ? enemies.filter(e => owner === 'player'
        ? e.x <= effect.range!
        : (LANE_WIDTH - e.x) <= effect.range!)
      : enemies
    for (const u of targets) {
      u.hp -= dmg
      u.damageFlashTimer = 200
      // Mark mobile kills as dying so they linger for the death animation and aren't
      // silently purged before the commander/base HP sync + game-over check can see them.
      if (u.hp <= 0 && u.moveSpeed > 0 && !u.isWall) u.dyingTimer = DEATH_LINGER_MS
    }
    log.push(`${label} AOE! ${targets.length} enem${targets.length === 1 ? 'y' : 'ies'} hit for ${dmg} damage.`)
  } else if (effect.type === 'buffHp') {
    for (const u of units) if (u.hp >= 1) u.hp = Math.min(u.maxHp, u.hp + effect.amount)
    log.push(`${label} units gain +${effect.amount} HP!`)
  } else if (effect.type === 'buffAttackCooldown') {
    for (const u of units) u.attackCooldownMs = Math.max(500, u.attackCooldownMs + effect.amount)
    log.push(`${label} units attack ${effect.amount < 0 ? 'faster' : 'slower'}!`)
  } else if (effect.type === 'buffHeal') {
    for (const u of units) if (u.hp >= 1) u.hp = Math.min(u.maxHp, u.hp + effect.amount)
    log.push(`${label} units healed for ${effect.amount} HP.`)
  }
}

