import { logError } from '../../logger';
import { Card, UnitTemplate, Unit, LANE_WIDTH } from '../types';
import { rollSecretRarity, makeShinyVariant, makeHolofoilVariant, makeGlassVariant } from '../secretRarities';
import { getCardCatalog, COMMANDER_UNIT, WARLORD_UNIT } from '../cards';
import { PLAYER_SPAWN_X, OPPONENT_SPAWN_X, COMMANDER_HOME_X } from './constants';

// ─── Helpers ─────────────────────────────────────────────
let _unitId = 0;
export function uid(): string { return `unit-${++_unitId}`; }
/**
 * Advance the unit-id counter past every id in a restored field. The counter lives in
 * module state and resets to 0 on page reload, so without this a restored battle's
 * units collide with freshly spawned ones — and any removal-by-id (e.g. the endless
 * finger smash) then deletes the restored unit too, including the player commander.
 */
export function syncUnitIdCounter(field: { id?: string }[]): void {
  for (const u of field) {
    const m = /^unit-(\d+)$/.exec(u.id ?? '');
    if (m) _unitId = Math.max(_unitId, parseInt(m[1], 10));
  }
}
let _recycleId = 0;
export function recycleCardId(): string { return `rc-${++_recycleId}`; }
let _animId = 0;
export function animUid(): string { return `anim-${++_animId}`; }
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function drawCard(deck: Card[], hand: Card[], secretLog?: string[]): void {
  if (deck.length === 0) return
  let card = deck.shift()!
  const secretType = rollSecretRarity()
  if (secretType !== null) {
    if (secretType === 'shiny') {
      card = makeShinyVariant(card)
    } else if (secretType === 'holofoil') {
      card = makeHolofoilVariant(card)
    } else if (secretType === 'glass') {
      card = makeGlassVariant(card)
    } else {
      // mythic — inject a random mythic card from the catalog; fall back to shiny if none exist
      const mythics = getCardCatalog().filter((c: Card) => c.rarity === 'mythic')
      if (mythics.length > 0) {
        const base = mythics[Math.floor(Math.random() * mythics.length)] as Card
        card = { ...base, id: `mythic-${Math.random().toString(36).slice(2, 9)}` }
      } else {
        card = makeShinyVariant(card)
      }
    }
    secretLog?.push(card.name)
  }
  hand.push(card)
}
// Five lanes evenly spread across the battle-field's lateral (Y) axis.
// Y=0 is centre; units move continuously between these positions.
export const LANE_POSITIONS = [-80, -40, 0, 40, 80] as const;
export const LANE_MIN_Y = -80;
export const LANE_MAX_Y = 80;
export function spawnUnit(template: UnitTemplate, owner: 'player' | 'opponent'): Unit {
  if (!template || typeof template.maxHp !== 'number') {
    logError('spawnUnit: invalid template — maxHp missing', { templateName: (template as UnitTemplate | undefined)?.name, owner });
    // Return a minimal safe unit so the game can continue without crashing
    return { id: uid(), owner, name: 'Unknown', attack: 0, maxHp: 1, hp: 1, isWall: false, bypassWall: false, moveSpeed: 0, attackRange: 0, attackCooldownMs: 2000, x: owner === 'player' ? PLAYER_SPAWN_X : OPPONENT_SPAWN_X, y: 0, attackTimer: 0 };
  }
  const unit: Unit = {
    ...template,
    id: uid(),
    owner,
    hp: template.maxHp,
    x: owner === 'player' ? PLAYER_SPAWN_X : OPPONENT_SPAWN_X,
    y: 0,
    attackTimer: 0,
  };
  const effect = template.structureEffect;
  if (effect?.type === 'spawn' || effect?.type === 'healAura' || effect?.type === 'repairAura') {
    const intervalMs = (effect as { intervalMs?: number; }).intervalMs ?? 8000;
    unit.spawnTimer = intervalMs;
  }
  // Structures stay at base; walls are placed further out to form a defensive line
  // Moats are placed just in front of the wall (enemy-side of it)
  if (template.moveSpeed === 0) {
    unit.x = template.isMoat
      ? (owner === 'player' ? 185 : LANE_WIDTH - 185)
      : template.isWall
        ? (owner === 'player' ? 150 : LANE_WIDTH - 150)
        : (owner === 'player' ? 10 : LANE_WIDTH - 10);
    unit.upgradeLevel = 1;
  } else {
    // Mobile units spawn in a random lane
    unit.y = LANE_POSITIONS[Math.floor(Math.random() * LANE_POSITIONS.length)];
  }
  return unit;
}

export function spawnCommander(owner: 'player' | 'opponent', hp: number): Unit {
  const homeX = owner === 'player' ? COMMANDER_HOME_X : LANE_WIDTH - COMMANDER_HOME_X
  const template = owner === 'player' ? COMMANDER_UNIT : WARLORD_UNIT
  const unit = spawnUnit({ ...template, maxHp: hp }, owner)
  unit.isCommander    = true
  unit.commanderHomeX = homeX
  unit.x              = homeX
  unit.y              = 0
  return unit
}
