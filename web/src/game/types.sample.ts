import { BattleEventState, Card, GameState, UnitTemplate,Unit, UpgradeEffect, GamePhase, BattleStats, AnimEvent } from "./types";

const exampleUnitTemplate:UnitTemplate = {
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

const exampleUnit:Unit={
  ...exampleUnitTemplate,
  id: 'example-unit-1',
  owner: 'player',
  hp: 4,
  x: 0,
  y: 0,
  attackTimer: 0,

}

const exampleUpgradeEffect :UpgradeEffect = { type: 'buffAttack', amount: 2 };

export const exampleCard: Card = {
  id: 'example-card',
  name: 'Example Card',
  rarity: 'common',
  cost: 3,
  cardType: 'unit',
  unit:exampleUnitTemplate,
  upgradeEffect: exampleUpgradeEffect,
  description: 'An example card for testing.',
  lore: 'This is the lore of the example card.',
  isHero: false,
  heroEffect: undefined,
};

export const exampleBattleEventState: BattleEventState = {
  type: 'bloodMoon',
  label: 'Blood Moon Rises',
  remainingMs: 15000,
};

export const exampleGamePhase : GamePhase= { type: 'playing' };

export const exampleBattleStats:BattleStats = {
  cardsPlayed: { 'example-card': 1 },
  playerKills: 3,
  playerUnitsLost: 2,
};

const exampleAnimEvent:AnimEvent = {
  id: 'anim1',
  kind: 'projectile',
  fromX: 0,
  fromY: 0,
  toX: 2,
  toY: 3,
  expiresAt: 500,
}

export const exampleGameState: GameState = {
  playerBase: { hp: 20, maxHp: 20 },
opponentBase: { hp: 30, maxHp: 30 },
field: [exampleUnit,exampleUnit,exampleUnit],
playerHand: [exampleCard],
playerDeck: [exampleCard],
opponentHand: [exampleCard],
opponentDeck: [exampleCard],
mana: 5,
maxMana: 10,
manaAccum: 0,
log: ['Player played Example Card.'],
phase: exampleGamePhase,
opponentTimer: 0,
opponentIntervalMs: 2000,
opponentStrategy: 'rush',
gameTime: 60000,
playerScore: 10,
opponentScore: 15,
suddenDeath: false,
suddenDeathTimer: 0,
suddenDeathBuildingTimer: 0,
battleEventTimer: 0,
activeBattleEvent: exampleBattleEventState,
terrain: [],
battleStats: exampleBattleStats,
animEvents: [exampleAnimEvent],
bloodPools: [{ id: 'bp1', x: 2, y: 3 }],
};