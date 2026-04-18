import { Unit } from '../types';

// ─── Mana bonus from Farms ────────────────────────────────
export function getManaBonus(field: Unit[], owner: 'player' | 'opponent'): number {
  return field
    .filter(u => u.owner === owner && u.structureEffect?.type === 'mana')
    .reduce((sum, u) => sum + (u.structureEffect as { type: 'mana'; amount: number; }).amount, 0);
}
export function getManaSpeedMult(field: Unit[], owner: 'player' | 'opponent'): number {
  return field
    .filter(u => u.owner === owner && u.structureEffect?.type === 'manaSpeed')
    .reduce((mult, u) => mult + (u.structureEffect as { type: 'manaSpeed'; speedMult: number; }).speedMult, 0);
}

export function getAttackAura(field: Unit[], owner: 'player' | 'opponent'): number {
  return field
    .filter(u => u.owner === owner && u.structureEffect?.type === 'attackAura')
    .reduce((sum, u) => sum + (u.structureEffect as { type: 'attackAura'; amount: number; }).amount, 0);
}
