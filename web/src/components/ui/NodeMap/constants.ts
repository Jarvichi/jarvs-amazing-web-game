import type * as PIXI from 'pixi.js'

// Map text sits on terrain that ranges from near-black (ashen, vault) to the
// near-white cloud floor of the sky acts, so no flat fill reads on all of them.
// White with a black outline does: the outline carries the contrast on bright
// terrain, the fill carries it on dark.
export function mapLabelStyle(fontSize: number, fill = '#ffffff'): PIXI.TextStyleOptions {
  return {
    fontSize, fill, fontFamily: 'monospace',
    stroke: { color: '#000000', width: 3, join: 'round' },
    dropShadow: { alpha: 0.9, blur: 2, distance: 1, color: '#000000' },
  }
}

export const NODE_ICON: Record<string, string> = {
  battle: '⚔', elite: '★', boss: '☠', rest: '⛺',
  event: '?', merchant: '⚖', memory: '◆',
  town: '🏘', castle: '🏰', camp: '⛺', cave: '🕳', port: '⚓',
}

export const NODE_LABEL: Record<string, string> = {
  battle: 'BATTLE', elite: 'ELITE', boss: 'BOSS', rest: 'REST',
  event: 'EVENT', merchant: 'SHOP', memory: 'MEMORY',
  town: 'TOWN', castle: 'CASTLE', camp: 'CAMP', cave: 'CAVE', port: 'PORT',
}
