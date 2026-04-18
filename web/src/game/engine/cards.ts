import { logError } from '../../logger';
import { GameState, UpgradeEffect, Unit, BuffTag, LANE_WIDTH } from '../types';
import { spawnUnit } from './helpers';
import { drawCard } from './helpers';
import {  Card, UnitTemplate } from '../types';

// ─── Deploy a card onto the field ────────────────────────
export function deployCard(s: GameState, card: Card, owner: 'player' | 'opponent', log: string[]): void {
  if (card.cardType === 'unit' || card.cardType === 'structure') {
    if (!card.unit || typeof card.unit.maxHp !== 'number') {
      logError('deployCard: card has no valid unit template', { cardName: card.name, cardType: card.cardType, owner });
      return;
    }
    // If playing a structure and one of the same type already exists, upgrade it instead
    if (card.cardType === 'structure') {
      const template = card.unit;
      const existing = s.field.find(u => u.owner === owner && u.name === template.name);
      if (existing) {
        existing.maxHp *= 2;
        existing.hp = Math.min(existing.hp * 2, existing.maxHp);
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
        return;
      }
    }
    const unit = spawnUnit(card.unit, owner);
    if (owner === 'player' && s.relicGearHeart) unit.attack = Math.max(0, unit.attack + 1);
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
      log.push(`★ HERO ${card.name} unleashed by ${who}!`);
      applyUpgrade(s, card.heroEffect, owner, log);
    } else {
      log.push(`${who} ${verb} ${unit.name}.`);
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
  if (state.mana < card.cost) return state

  // Prevent playing a structure that is already at max upgrade level
  if (card.cardType === 'structure' && card.unit) {
    const existing = state.field.find(u => u.owner === 'player' && u.name === card.unit!.name)
    if (existing && (existing.upgradeLevel ?? 1) >= MAX_UPGRADE_LEVEL) {
      const s = structuredClone(state)
      s.log.push(`${existing.name} is already at max level — upgrade blocked.`)
      return s
    }
  }

  // Endless mode: block new (non-upgrade) structures beyond 3 rows from player base
  if (state.endlessMode && card.cardType === 'structure' && card.unit && !card.unit.isWall) {
    const existing = state.field.find(u => u.owner === 'player' && u.name === card.unit!.name)
    // Count current player structures to determine next row position
    const playerStructures = state.field.filter(u => u.owner === 'player' && u.moveSpeed === 0 && !u.isWall)
    const nextIdx = existing ? playerStructures.findIndex(u => u.name === card.unit!.name) : playerStructures.length
    // Each structure sits at x=10 base; rows push x outward by ~44px step — 3 rows ≈ x ≤ 60
    // Block new structures that would land in row 3+ (0-indexed: rows 0,1,2 = max 18 buildings)
    const row = Math.floor(nextIdx / 6)
    if (!existing && row >= 3) {
      const s = structuredClone(state)
      s.log.push('Endless mode: buildings are limited to 3 rows from your base.')
      return s
    }
  }

  const s = structuredClone(state)
  s.playerHand.splice(cardIdx, 1)
  s.mana -= card.cost

  deployCard(s, card, 'player', s.log)
  drawCard(s.playerDeck, s.playerHand)
  return s
}
/** Play an AoE upgrade card with a player-chosen target point (cx, cy in game units). */

export function playAoeCard(state: GameState, cardId: string, cx: number, cy: number): GameState {
  if (state.phase.type !== 'playing') return state
  const cardIdx = state.playerHand.findIndex(c => c.id === cardId)
  if (cardIdx === -1) return state
  const card = state.playerHand[cardIdx]
  if (state.mana < card.cost) return state
  if (card.cardType !== 'upgrade' || !card.upgradeEffect || card.upgradeEffect.type !== 'aoe') return state
  if (card.isHero && state.gameTime < 30000) return state

  const s = structuredClone(state)
  s.playerHand.splice(cardIdx, 1)
  s.mana -= card.cost

  const effect = card.upgradeEffect
  const dmg = effect.damage ?? effect.amount ?? 0
  const enemies = s.field.filter(u => u.owner !== 'player' && !u.isWall)
  const targets = effect.range != null
    ? enemies.filter(e => Math.sqrt((e.x - cx) ** 2 + (e.y - cy) ** 2) <= effect.range!)
    : enemies
  for (const u of targets) {
    u.hp -= dmg
    u.damageFlashTimer = 200
  }
  s.log.push(`Your AOE! ${targets.length} enem${targets.length === 1 ? 'y' : 'ies'} hit for ${dmg} damage.`)

  drawCard(s.playerDeck, s.playerHand)
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

