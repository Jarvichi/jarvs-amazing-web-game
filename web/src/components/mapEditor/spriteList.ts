// Enumerate all SVG sprites from /public/sprites/ at build time (Vite import.meta.glob).
// Used to populate sprite pickers in the map editor.

const ALL_SPRITE_URLS = import.meta.glob('/sprites/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>

function slugFromPath(path: string): string {
  return path.replace(/^\/sprites\//, '').replace(/\.svg$/, '')
}

// All sprites that are NOT animation frames (-1/-2/-3) and NOT animal sprites.
// Used for NPC sprite selection.
export const NPC_SPRITE_SLUGS: string[] = Object.keys(ALL_SPRITE_URLS)
  .filter(p => !/-[123]\.svg$/.test(p) && !/\/animal-/.test(p))
  .map(slugFromPath)
  .sort()

// Animal types supported in the map editor (matches HubAnimalType in loader.ts).
export const ANIMAL_TYPES = ['cat', 'dog', 'bird', 'fish', 'butterfly', 'rabbit', 'chicken', 'frog'] as const
export type EditorAnimalType = typeof ANIMAL_TYPES[number]

// Returns the public URL for a given animal type's static sprite.
export function animalSpriteUrl(type: string): string {
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  return `${base}sprites/animal-${type}.svg`
}

// Returns the public URL for a given NPC sprite slug.
export function npcSpriteUrl(slug: string): string {
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  return `${base}sprites/${slug}.svg`
}

// NPC sprite default + resolver live in game/sprites.ts (no import.meta.glob, so
// they're safe to import from the game bundle); re-exported here for editor use.
export { DEFAULT_NPC_SPRITE, resolveNpcSprite } from '../../game/sprites'
