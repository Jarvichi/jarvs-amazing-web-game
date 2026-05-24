import { BattleEventState, Card, GameState, UnitTemplate, Unit, UpgradeEffect, GamePhase, BattleStats, AnimEvent } from "./types";
import { Act, RunState, ConsumableDef } from "./questline";
import { RewardDef, UselessItem } from "./dailyLogin";
import { TDAttackEvent, TDEnemy, TDEnemyTemplate, TDGameState, TDHazard, TDPassives, TDUnit } from "./towerDefence";
import { TowerPool } from "../components/minigames/TowerDefence";

export const exampleUnitTemplate: UnitTemplate = {
  name: 'Goblin',
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

export const exampleUnit: Unit = {
  ...exampleUnitTemplate,
  id: 'example-unit-1',
  owner: 'player',
  hp: 4,
  x: 0,
  y: 0,
  attackTimer: 0,
};

const exampleUpgradeEffect: UpgradeEffect = { type: 'buffAttack', amount: 2 };

export const exampleCard: Card = {
  id: 'example-card',
  name: 'Example Card',
  rarity: 'common',
  cost: 3,
  cardType: 'unit',
  unit: exampleUnitTemplate,
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

export const exampleGamePhase: GamePhase = { type: 'playing' };

export const exampleBattleStats: BattleStats = {
  cardsPlayed: { 'example-card': 1 },
  playerKills: 3,
  playerUnitsLost: 2,
};

const exampleAnimEvent: AnimEvent = {
  id: 'anim1',
  kind: 'projectile',
  fromX: 0,
  fromY: 0,
  toX: 2,
  toY: 3,
  expiresAt: 500,
}

export const exampleUselessItem: UselessItem = {
  id: 'rusty_fork',
  name: 'Rusty Fork',
  icon: '🍴',
  desc: 'A fork of questionable origin.',
  lore: 'Someone left this here.',
  acquiredDate: '2026-01-01',
};

export const exampleRewardDef: RewardDef = {
  id: 'example-reward',
  name: 'Bag of Crystals',
  icon: '💎',
  desc: 'A generous helping of crystals.',
  lore: 'Shiny.',
  weight: 1,
  type: 'crystals',
  amount: 25,
};

export const exampleConsumableDef: ConsumableDef = {
  id: 'healing_herb',
  name: 'Healing Herb',
  icon: '🌿',
  desc: 'Restores 10 HP.',
  lore: 'A plant with restorative properties.',
  healAmount: 10,
  price: 20,
};

export const exampleAct: Act = {
  id: 'example-act',
  title: 'The Verdant Wood',
  subtitle: 'A Sample Adventure',
  nodes: {
    'node-1': { id: 'node-1', type: 'battle', label: 'The Clearing', description: 'Face a scouting party.', row: 0, col: 0, rowCols: 2, childIds: ['node-2', 'node-3'] },
    'node-2': { id: 'node-2', type: 'rest', label: 'Campfire', description: 'Rest and recover.', row: 1, col: 0, rowCols: 2, childIds: ['node-4'] },
    'node-3': { id: 'node-3', type: 'merchant', label: 'Wandering Merchant', description: 'Browse the wares.', row: 1, col: 1, rowCols: 2, childIds: ['node-4'] },
    'node-4': { id: 'node-4', type: 'boss', label: 'The Thornlord', description: 'A fearsome guardian blocks the path.', row: 2, col: 0, rowCols: 1, childIds: [] },
  },
  startNodeIds: ['node-1'],
  rewardRelic: 'Bark Shield',
  rewardRelicDesc: 'Your base gains +10 max HP at the start of every battle.',
};

export const exampleRunState: RunState = {
  actId: 'example-act',
  completedNodeIds: ['node-1'],
  skippedNodeIds: [],
  pendingNodeId: null,
  playerHp: 40,
  maxHp: 50,
  livesRemaining: 2,
  maxLives: 3,
  cardPlayCounts: {},
  nodeFailCounts: {},
  earnedCards: ['Goblin', 'Archer'],
  activeRelic: 'Bark Shield',
  crystalBonus: 0,
  consumables: [],
  activeModifierCount: 0,
  runSeed: 12345678,
};

export const exampleGameState: GameState = {
  playerBase: { hp: 20, maxHp: 20 },
  opponentBase: { hp: 30, maxHp: 30 },
  field: [exampleUnit, exampleUnit, exampleUnit],
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
  hazards: [],
};


export const exampleTDPassives: TDPassives = {
  attackSpeedMult: 1,
  rangeBonus: 0,
  damageMult: 1,
  respawnMult: 1,
}

export const exampleTDEnemyTemplate:TDEnemyTemplate = {
  id: "dave",
  label: "Dave the Goblin",
  spriteName: "Goblin",
  hp: 10,
  speed: 1,
  attack: 1,
  reward: 12,
  tags: []
}

export const exampleTDEnemy: TDEnemy = {
  id: 0,
  template: exampleTDEnemyTemplate,
  hp: 10,
  maxHp: 10,
  pathProgress: 10,
  x: 20,
  y: 20,
  unitAttackCd: 0,
  speedMult: 0,
  shielded: false,
  splitsOnDeath: false,
  slowsUnits: false
};

export const exampleTDUnit: TDUnit ={
  id: 0,
  towerId: 0,
  template: exampleUnitTemplate,
  hp: 0,
  maxHp: 0,
  x: 20,
  y: 20,
  homeX: 50,
  homeY: 50,
  stationed: false,
  attackCooldownRemaining: 0,
  rangeInCells: 0,
  speedMult: 0,
  rangeBonus: 0,
  damageMult: 0
}

export const exampleTDGameState: TDGameState = {
  remainingPlacements: { 'Example Unit': 5 },
  lives: 1,
  wavesCompleted: 333,
  currentWaveIndex: 2,
  gameTimeMs: 12220,
  towers: [],
  units: [exampleTDUnit,exampleTDUnit],
  enemies: [exampleTDEnemy],
  spawnQueue: [],
  waveSpawnTotal: 120,
  nextWaveAt: 0,
  score: 9999990,
  attackEvents: [],
  availableTemplates: [],
  mode: "collection",
  passives: exampleTDPassives,
  milestoneChoices: null,
  phase: "prep",
  mana: 0,
  log: [],
  hazards: [],
  enemyKills: 0
}

export const exampleTowerPool: TowerPool[] = [
  { template: exampleUnitTemplate, total: 10, buildingName: 'Goblin' },
  { template: exampleUnitTemplate, total: 10, buildingName: 'Ogre' },
  { template: exampleUnitTemplate, total: 10, buildingName: 'Wizard' },
  { template: exampleUnitTemplate, total: 10, buildingName: 'Archer' },
  { template: exampleUnitTemplate, total: 10, buildingName: 'Witch' },
  { template: exampleUnitTemplate, total: 10, buildingName: 'Knight' },
]

export const exampleTDAttackEvent: TDAttackEvent = {
  id: 1,
  fromX: 50,
  fromY: 50,
  toX: 20,
  toY: 20,
  projectileType: 'magic',
  aoeRadius: 0,
  expiresAt: 500,
};

export const exampleTDHazard: TDHazard = {
  id: 0,
  x: 50,
  y: 50,
  radius: 20,
  dps: 20,
  expiresAt: 2000,
  sourceTowerId: 0,
};