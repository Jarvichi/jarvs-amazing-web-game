// Pet coat pattern catalog. Each pattern composites one or more animated
// sprite layers on top of a pet's base body sprite, at
// web/public/sprites/pattern-<species>-<patternId>-<part.key>[-1/-2/-3/-sleep].svg
// (mirroring the base animal-<type>[-1/-2/-3/-sleep].svg frame convention —
// see hubAnimals.ts's patternLayers). A part is either tinted with whatever
// base colour the player picked (`useBaseColor`) or a fixed marking colour
// (`tint`) — never both.

export type PatternSpecies = 'cat' | 'dog'

export interface PatternPart {
  key: string          // sprite filename suffix
  useBaseColor?: true  // tinted with the pet's picked variant colour
  tint?: number        // fixed PIXI tint (0xRRGGBB); ignored if useBaseColor is set
}

export interface AnimalPatternDef {
  id:      string
  species: PatternSpecies
  label:   string
  parts:   PatternPart[]  // 1 part for most patterns, 3 for calico
}

export const PET_PATTERNS: AnimalPatternDef[] = [
  { id: 'tuxedo', species: 'cat', label: 'Tuxedo', parts: [{ key: 'white', tint: 0xf5f5f0 }] },
  { id: 'tabby', species: 'cat', label: 'Tabby', parts: [{ key: 'stripes', tint: 0x2a2016 }] },
  { id: 'calico', species: 'cat', label: 'Calico', parts: [
    { key: 'base', useBaseColor: true },
    { key: 'white', tint: 0xf5f5f0 },
    { key: 'ginger', tint: 0xd97b3f },
  ] },

  { id: 'brindle', species: 'dog', label: 'Brindle', parts: [{ key: 'stripes', tint: 0x1c1712 }] },
  { id: 'black-and-tan', species: 'dog', label: 'Black & Tan', parts: [{ key: 'saddle', tint: 0x1c1712 }] },
  { id: 'spotted', species: 'dog', label: 'Spotted', parts: [{ key: 'spots', tint: 0x2a2016 }] },
]

export function getPatternsForSpecies(species: PatternSpecies): AnimalPatternDef[] {
  return PET_PATTERNS.filter(p => p.species === species)
}

export function getPatternDef(species: PatternSpecies, id: string | undefined): AnimalPatternDef | undefined {
  if (!id || id === 'none') return undefined
  return PET_PATTERNS.find(p => p.species === species && p.id === id)
}
