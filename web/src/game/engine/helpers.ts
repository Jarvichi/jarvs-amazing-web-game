import { logError } from '../../logger';
import { Card, UnitTemplate, Unit, LANE_WIDTH } from '../types';
import { PLAYER_SPAWN_X, OPPONENT_SPAWN_X, COMMANDER_HOME_X } from './constants';

// ─── Helpers ─────────────────────────────────────────────
let _unitId = 0;
export function uid(): string { return `unit-${++_unitId}`; }
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
export function drawCard(deck: Card[], hand: Card[]): void {
  if (deck.length > 0) hand.push(deck.shift()!);
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
  const unit = spawnUnit(
    { name: owner === 'player' ? 'Commander' : 'Warlord',
      attack: 15, maxHp: hp, isWall: false, bypassWall: false,
      moveSpeed: 8, attackRange: 35, attackCooldownMs: 2000, size: 'large' },
    owner
  )
  unit.isCommander    = true
  unit.commanderHomeX = homeX
  unit.x              = homeX
  unit.y              = 0
  return unit
}
