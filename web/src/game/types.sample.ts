import { Card, UnitTemplate, UpgradeEffect } from "./types";

const exampleUnit:UnitTemplate = {
  name: 'Example Unit',
  attack: 5,
  maxHp: 4,
  isWall: false,
  isMoat: false,
  bypassWall: false,
  flying: false,
  climber: false,
  moveSpeed: 1,
  attackRange: 1,
  attackCooldownMs: 1000,
};

const exampleUpgradeEffect :UpgradeEffect = { type: 'buffAttack', amount: 2 };

export const exampleCard: Card = {
  id: 'example-card',
  name: 'Example Card',
  rarity: 'common',
  cost: 3,
  cardType: 'unit',
  unit:exampleUnit,
  upgradeEffect: exampleUpgradeEffect,
  description: 'An example card for testing.',
  lore: 'This is the lore of the example card.',
  isHero: false,
  heroEffect: undefined,
};