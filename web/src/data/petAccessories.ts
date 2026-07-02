// Pet accessory catalog. Each entry maps 1:1 to a composited sprite asset at
// web/public/sprites/pet-accessory-<id>.svg (see hubAnimals.ts's
// setPetAccessory/AnimalSystem). Adding a second accessory for an existing
// slot (e.g. a second hat) just needs one more entry here + one more SVG —
// no structural change.

export type AccessorySlot = 'collar' | 'hat' | 'bow' | 'bow-tie' | 'boots' | 'coat'

export interface PetAccessoryDef {
  id:    string
  slot:  AccessorySlot
  name:  string
  price: number  // crystals, for the Tailor Pell shop listing
}

export const PET_ACCESSORIES: PetAccessoryDef[] = [
  { id: 'leather-collar', slot: 'collar',  name: 'Leather Collar',  price: 40 },
  { id: 'top-hat',        slot: 'hat',     name: 'Top Hat',         price: 60 },
  { id: 'red-bow',        slot: 'bow',     name: 'Red Bow',         price: 35 },
  { id: 'black-bowtie',   slot: 'bow-tie', name: 'Black Bow Tie',   price: 45 },
  { id: 'brown-boots',    slot: 'boots',   name: 'Brown Boots',     price: 50 },
  { id: 'blue-coat',      slot: 'coat',    name: 'Blue Coat',       price: 65 },
]

export function getPetAccessoryDef(id: string): PetAccessoryDef | undefined {
  return PET_ACCESSORIES.find(a => a.id === id)
}
