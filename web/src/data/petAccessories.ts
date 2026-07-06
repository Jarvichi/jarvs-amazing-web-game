// Pet accessory catalog. Each entry composites one or more neutral-toned
// sprite parts at web/public/sprites/pet-accessory-<asset>-<part.key>.svg,
// tinted per-part (see hubAnimals.ts's setPetAccessory/AnimalSystem). Colour
// variants of the same physical item share an `asset` (and therefore its art)
// but supply their own tints — adding another colour is just one more entry
// here, no new SVGs needed.

export type AccessorySlot = 'collar' | 'hat' | 'bow' | 'bow-tie' | 'boots' | 'coat'

export interface AccessoryPart {
  key:  string  // sprite filename suffix: pet-accessory-<asset>-<key>.svg
  tint: number  // PIXI tint (0xRRGGBB) applied to that part
}

export interface PetAccessoryDef {
  id:    string
  slot:  AccessorySlot
  name:  string
  price: number         // crystals, for the Tailor Pell shop listing
  asset: string         // shared filename stem across colour variants
  parts: AccessoryPart[] // 1 part for single-tone items, 2+ for multi-tone items
}

export const PET_ACCESSORIES: PetAccessoryDef[] = [
  // Leather Collar — band + stud
  { id: 'leather-collar', slot: 'collar', name: 'Leather Collar', price: 40, asset: 'leather-collar',
    parts: [{ key: 'band', tint: 0x6b4423 }, { key: 'stud', tint: 0xd4af37 }] },
  { id: 'leather-collar-black', slot: 'collar', name: 'Black Collar', price: 40, asset: 'leather-collar',
    parts: [{ key: 'band', tint: 0x2a2a2a }, { key: 'stud', tint: 0xc0c0c0 }] },
  { id: 'leather-collar-red', slot: 'collar', name: 'Red Collar', price: 40, asset: 'leather-collar',
    parts: [{ key: 'band', tint: 0x9c2b2b }, { key: 'stud', tint: 0xd4af37 }] },

  // Top Hat — crown + band
  { id: 'top-hat', slot: 'hat', name: 'Top Hat', price: 60, asset: 'top-hat',
    parts: [{ key: 'crown', tint: 0x1a1a1a }, { key: 'band', tint: 0x7a1f2b }] },
  { id: 'top-hat-navy', slot: 'hat', name: 'Navy Top Hat', price: 60, asset: 'top-hat',
    parts: [{ key: 'crown', tint: 0x3a3a3a }, { key: 'band', tint: 0x24345c }] },
  { id: 'top-hat-brown', slot: 'hat', name: 'Brown Top Hat', price: 60, asset: 'top-hat',
    parts: [{ key: 'crown', tint: 0x5a3a1a }, { key: 'band', tint: 0xd4af37 }] },

  // Red Bow — single tone
  { id: 'red-bow', slot: 'bow', name: 'Red Bow', price: 35, asset: 'red-bow',
    parts: [{ key: 'main', tint: 0xc81e3a }] },
  { id: 'red-bow-pink', slot: 'bow', name: 'Pink Bow', price: 35, asset: 'red-bow',
    parts: [{ key: 'main', tint: 0xe86bb0 }] },
  { id: 'red-bow-purple', slot: 'bow', name: 'Purple Bow', price: 35, asset: 'red-bow',
    parts: [{ key: 'main', tint: 0x8f4fc8 }] },

  // Black Bow Tie — single tone
  { id: 'black-bowtie', slot: 'bow-tie', name: 'Black Bow Tie', price: 45, asset: 'black-bowtie',
    parts: [{ key: 'main', tint: 0x1a1a1a }] },
  { id: 'black-bowtie-navy', slot: 'bow-tie', name: 'Navy Bow Tie', price: 45, asset: 'black-bowtie',
    parts: [{ key: 'main', tint: 0x24345c }] },
  { id: 'black-bowtie-burgundy', slot: 'bow-tie', name: 'Burgundy Bow Tie', price: 45, asset: 'black-bowtie',
    parts: [{ key: 'main', tint: 0x6e1f2e }] },

  // Brown Boots — single tone
  { id: 'brown-boots', slot: 'boots', name: 'Brown Boots', price: 50, asset: 'brown-boots',
    parts: [{ key: 'main', tint: 0x5a3a1a }] },
  { id: 'brown-boots-black', slot: 'boots', name: 'Black Boots', price: 50, asset: 'brown-boots',
    parts: [{ key: 'main', tint: 0x2a2a2a }] },
  { id: 'brown-boots-grey', slot: 'boots', name: 'Grey Boots', price: 50, asset: 'brown-boots',
    parts: [{ key: 'main', tint: 0x8a8a8a }] },

  // Blue Coat — body + trim
  { id: 'blue-coat', slot: 'coat', name: 'Blue Coat', price: 65, asset: 'blue-coat',
    parts: [{ key: 'body', tint: 0x2f5da0 }, { key: 'trim', tint: 0x1e3f70 }] },
  { id: 'blue-coat-red', slot: 'coat', name: 'Red Coat', price: 65, asset: 'blue-coat',
    parts: [{ key: 'body', tint: 0xa02f2f }, { key: 'trim', tint: 0xd4af37 }] },
  { id: 'blue-coat-green', slot: 'coat', name: 'Green Coat', price: 65, asset: 'blue-coat',
    parts: [{ key: 'body', tint: 0x2f8a4a }, { key: 'trim', tint: 0x5a3a1a }] },
]

export function getPetAccessoryDef(id: string): PetAccessoryDef | undefined {
  return PET_ACCESSORIES.find(a => a.id === id)
}
