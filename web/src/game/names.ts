// ─── Shared character name pools ─────────────────────────────────────────────
//
// One source of truth for procedurally-named characters. The first-name pool
// started life inside the city builder's walkerTypes.ts; the hub town's
// wandering NPCs need the same pool, and `game/` can't import from
// `components/`, so it lives here and the city builder imports it back.
//
// Nothing here picks a name — callers own their own seeding and uniqueness
// rules (city-builder residents are a pure function of grid position and
// tolerate collisions; hub wanderers mint distinct names per town visit, see
// game/hub/ambientNpcIdentity.ts).

export const RESIDENT_FIRST_NAMES = [
  'Bob', 'Grak', 'Mira', 'Thorin', 'Zyx', 'Elda', 'Fang', 'Nix', 'Wren', 'Dusk',
  'Pip', 'Crux', 'Vale', 'Sorn', 'Brix', 'Holt', 'Vera', 'Kurn', 'Dex', 'Ori',
  'Sable', 'Flint', 'Rook', 'Ivy', 'Bryn', 'Quill', 'Ash', 'Moss', 'Thorn', 'Lark',
  'Grit', 'Nyx', 'Rune', 'Cora', 'Drake', 'Frey', 'Vex', 'Sage', 'Onyx', 'Luna',
  'Zara', 'Kade', 'Ember', 'Riven', 'Sylas', 'Jade', 'Dorian', 'Nyssa', 'Orin', 'Soren',
  'Tess', 'Galen', 'Vira', 'Kira', 'Bram', 'Lena', 'Zane', 'Mara', 'Rhea', 'Dax',
  'Cyrus', 'Elara', 'Fen', 'Nora', 'Vaughn', 'Sia', 'Kieran', 'Lyra', 'Eira', 'Zev',
  'Mina', 'Thane', 'Vela', 'Kass', 'Dara', 'Orion', 'Faye', 'Gideon', 'Lira', 'Kara',
  'Elys', 'Kael', 'Varyn', 'Selene', 'Torik', 'Xara', 'Brakka', 'Zephyr', 'Isolde', 'Malric',
  'Tavra', 'Voren', 'Calyx', 'Seraph', 'Nymer', 'Talon', 'Velric', 'Auren', 'Morwen', 'Zyra',
  'Graham', 'Rob', 'Jarv', 'Jason',
]

// Surnames for townsfolk who need a full name rather than a "<Name> the <Unit>"
// epithet — trade and place names, so a wanderer reads as somebody who lives
// and works somewhere rather than as a fantasy hero.
export const WANDERER_SURNAMES = [
  'Ashdown', 'Fenwick', 'Millward', 'Thatcher', 'Quarryman', 'Barrowe', 'Coalter',
  'Dunmere', 'Estwick', 'Fallowes', 'Grindle', 'Hallow', 'Ingles', 'Kettleby',
  'Lorrimer', 'Marlow', 'Netherby', 'Oakhurst', 'Pennyworth', 'Rushmore',
  'Saltmarsh', 'Tanner', 'Underhill', 'Vances', 'Wraysbury', 'Yarrow',
  'Brightwater', 'Cobbleton', 'Duskmoor', 'Elmsley', 'Foxglove', 'Greave',
  'Harrowgate', 'Larkspur', 'Mossbank', 'Ravensworth', 'Stonecrop', 'Thornbury',
  'Weatherall', 'Wyndham',
]
