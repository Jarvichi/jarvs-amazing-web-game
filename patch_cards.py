#!/usr/bin/env python3
import json, copy

# Template key -> unitTrait dict
# Skip: goblin (fleeFrom large), bat (fleeFrom large+armored), catapult (guardBase), crossbow (guardBase)
TEMPLATE_TRAITS = {
    # --- Small/weak creatures → fleeFrom ['large'] ---
    "plague-rat":        {"fleeFrom": ["large"], "fleeRange": 75},
    "pixie":             {"fleeFrom": ["large"], "fleeRange": 70},
    "pixie-scout":       {"fleeFrom": ["large"], "fleeRange": 70},
    "specter":           {"fleeFrom": ["large"], "fleeRange": 70},
    "mana-wisp":         {"fleeFrom": ["large"], "fleeRange": 70},
    "techno-imp":        {"fleeFrom": ["large"], "fleeRange": 70},
    "shard-familiar":    {"fleeFrom": ["large", "armored"], "fleeRange": 68},
    "reef-crawler":      {"fleeFrom": ["large"], "fleeRange": 75},
    "tide-sprite":       {"fleeFrom": ["large", "armored"], "fleeRange": 68},
    "wind-sprite":       {"fleeFrom": ["large", "armored"], "fleeRange": 68},
    "zephyr-scout":      {"fleeFrom": ["large"], "fleeRange": 72},
    "air-sprite":        {"fleeFrom": ["large", "armored"], "fleeRange": 68},
    "shore-scout":       {"fleeFrom": ["large"], "fleeRange": 75},
    "tide-runner":       {"fleeFrom": ["large"], "fleeRange": 75},
    "gear-scout":        {"fleeFrom": ["large"], "fleeRange": 75},
    "canopy-scout":      {"fleeFrom": ["large"], "fleeRange": 72},
    "vine-runner":       {"fleeFrom": ["large"], "fleeRange": 72},
    "clockwork-archer":  {"fleeFrom": ["large"], "fleeRange": 70},
    "coastal-skirmisher":{"fleeFrom": ["large"], "fleeRange": 70},
    # weak-skeleton: special → fleeFrom large AND fire
    "weak-skeleton":     {"fleeFrom": ["large", "fire"], "fleeRange": 70},
    "skeleton":          {"fleeFrom": ["large"], "fleeRange": 70},
    "spore-bat":         {"fleeFrom": ["large"], "fleeRange": 72},
    "dune-bat":          {"fleeFrom": ["large", "armored"], "fleeRange": 68},
    "scorch-bat":        {"fleeFrom": ["large", "armored"], "fleeRange": 68},
    "ice-wraith":        {"fleeFrom": ["large"], "fleeRange": 70},
    "cold-snap":         {"fleeFrom": ["large"], "fleeRange": 70},
    "wraith":            {"fleeFrom": ["large"], "fleeRange": 72},
    "bloom-wisp":        {"fleeFrom": ["large"], "fleeRange": 72},
    "bloom-sprite":      {"fleeFrom": ["large", "armored"], "fleeRange": 68},
    "ancient-sprite":    {"fleeFrom": ["large", "armored"], "fleeRange": 68},
    "revenant":          {"fleeFrom": ["large"], "fleeRange": 70},
    "root-wraith":       {"fleeFrom": ["large"], "fleeRange": 65},
    "vault-drone":       {"fleeFrom": ["large"], "fleeRange": 70},
    "cog-runner":        {"fleeFrom": ["large"], "fleeRange": 75},
    "storm-hawk":        {"fleeFrom": ["large"], "fleeRange": 70},
    "spore-crawler":     {"fleeFrom": ["large"], "fleeRange": 72},
    "frost-crawler":     {"fleeFrom": ["large"], "fleeRange": 72},
    "sand-raider":       {"fleeFrom": ["large"], "fleeRange": 72},
    "ember-crawler":     {"fleeFrom": ["large"], "fleeRange": 72},

    # --- Ranged / siege guard units → guardBase: True ---
    "archer":             {"guardBase": True, "baseGuardRange": 80, "engageRange": 170},
    "bone-archer":        {"guardBase": True, "baseGuardRange": 80, "engageRange": 160},
    "ballista":           {"guardBase": True, "baseGuardRange": 90, "engageRange": 200},
    "ballista-crew":      {"guardBase": True, "baseGuardRange": 90, "engageRange": 195},
    "battering-ram-crew": {"guardBase": True, "baseGuardRange": 80, "engageRange": 170},
    "siege-engineer":     {"guardBase": True, "baseGuardRange": 90, "engageRange": 195},
    "demolitions-expert": {"guardBase": True, "baseGuardRange": 80, "engageRange": 165},
    "sappers":            {"guardBase": True, "baseGuardRange": 70, "engageRange": 160},
    "centaur":            {"guardBase": True, "baseGuardRange": 75, "engageRange": 185},
    "dark-elf":           {"guardBase": True, "baseGuardRange": 80, "engageRange": 185},
    "harpy":              {"guardBase": True, "baseGuardRange": 80, "engageRange": 185},
    "necromancer":        {"guardBase": True, "baseGuardRange": 85, "engageRange": 195},
    "fire-mage":          {"guardBase": True, "baseGuardRange": 80, "engageRange": 185},
    "lich-apprentice":    {"guardBase": True, "baseGuardRange": 80, "engageRange": 180},
    "soulrend-witch":     {"guardBase": True, "baseGuardRange": 80, "engageRange": 190},
    "sea-witch":          {"guardBase": True, "baseGuardRange": 85, "engageRange": 200},
    "chronomancer":       {"guardBase": True, "baseGuardRange": 80, "engageRange": 185},
    "dryad-sentinel":     {"guardBase": True, "baseGuardRange": 80, "engageRange": 180},
    "void-elemental":     {"guardBase": True, "baseGuardRange": 75, "engageRange": 175},
    "jellyfish-drifter":  {"guardBase": True, "baseGuardRange": 75, "engageRange": 175},
    "abyssal-hunter":     {"guardBase": True, "baseGuardRange": 85, "engageRange": 210},
    "tide-caller":        {"guardBase": True, "baseGuardRange": 85, "engageRange": 200},
    "lightning-archer":   {"guardBase": True, "baseGuardRange": 90, "engageRange": 215},
    "eel-striker":        {"guardBase": True, "baseGuardRange": 80, "engageRange": 185},
    "spore-drifter":      {"guardBase": True, "baseGuardRange": 80, "engageRange": 185},
    "canopy-archer":      {"guardBase": True, "baseGuardRange": 85, "engageRange": 205},
    "desert-archer":      {"guardBase": True, "baseGuardRange": 85, "engageRange": 210},
    "frost-archer":       {"guardBase": True, "baseGuardRange": 85, "engageRange": 210},
    "spore-archer":       {"guardBase": True, "baseGuardRange": 85, "engageRange": 215},
    "magma-archer":       {"guardBase": True, "baseGuardRange": 85, "engageRange": 205},
    "glass-dancer":       {"guardBase": True, "baseGuardRange": 85, "engageRange": 210},
    "sandstorm-shaman":   {"guardBase": True, "baseGuardRange": 85, "engageRange": 210},
    "stormcaller":        {"guardBase": True, "baseGuardRange": 85, "engageRange": 200},
    "gale-warden":        {"guardBase": True, "baseGuardRange": 85, "engageRange": 200},
    "mana-siphon":        {"guardBase": True, "baseGuardRange": 75, "engageRange": 175},
}

# Card name (must match card "name" field exactly) → lore string
# Only add where lore is MISSING or needs updating
CARD_LORE = {
    # --- Already have lore (skip) ---
    # Goblin, Archer, Barbarian, Knight, Wizard, Dragon, Stone Wall, Farm, Mana Spring,
    # Healer's Hut, Stone Mason, Blacksmith, Barracks, Arcane Tower, Dragon Lair,
    # Sharpen Blades, Fortify, Skeleton, Troll, Crossbow, Paladin, Rogue, Catapult,
    # Werewolf, Golem, Pixie, Ogre, Crypt, Troll Den, Garrison, Cathedral, Rogue Den,
    # Siege Works, Dark Shrine, Iron Forge, Fairy Ring, Ogre Den, Rally, Haste,
    # Iron Skin, Eagle Eye, War Drums, Bloodlust, Plague Rat, Bandit, Bat, Scorpion,
    # Shield Guard, Centaur, Harpy, Specter, Lizardman, Ballista, Vampire, Griffin,
    # Fire Mage, Executioner, Mammoth, Dark Elf, Necromancer, Giant, Wyvern, Behemoth,
    # Rat Burrow, Bandit Camp, Bat Cave, Scorpion Pit, Guard Post, Centaur Stable,
    # Harpy Roost, Spirit Well, Lizard Warren, Ballista Tower, Vamp. Coven, Aerie,
    # Mage Tower, Gallows, Mammoth Pen, Shadow Academy, Death Tower, Giant's Hall,
    # Wyvern Roost, Ancient Altar, Field Medic, Titan Blood, Sniper Scope, Battle Cry,
    # Vine Golem, Spore Bat (first), Thornbeast, Elder Treant, Frog Knight, Thornwall,
    # Ancient Grove, Ironclad Guard, War Drummer, Siege Engineer, Shield Wall Soldier,
    # Grizzled Veteran, Armory, Command Tent, Bone Archer, Wight Knight, Ash Elemental,
    # Revenant, Lich Apprentice, Bone Wall, Soul Obelisk, Arcane Golem, Mana Wisp,
    # Rune Knight, Spellblade, Crystal Hydra, Mana Tower, Crystal Wall, Leyline Node,
    # Mana Surge, Arcane Efficiency, Dryad Sentinel, Mushroom Hulk, Pixie Scout,
    # Swamp Lurker, Moss Golem, Spore Tower, Mushroom Circle, Root Network (structure),
    # Overgrowth, Nature's Bounty, Spore Cloud (upgrade forest), Root Bind, Wild Surge,
    # Battering Ram Crew, Cavalry Scout, Demolitions Expert, Sappers, Ballista Crew,
    # Siege Tower, Fortified Wall, Moat, Battle Hardened, Iron Discipline, Siege Protocol,
    # Tactical Retreat, Shadow Stalker, Soulrend Witch, Bone Colossus, Wraith,
    # Death Altar, Necrotic Pool, Graveblight Tower, Undying Rage, Soul Harvest,
    # Plague Spread, Dark Ritual, Entropy Wave, Techno Imp, Mana Siphon, Arcane Turret,
    # Void Elemental, Chronomancer, Arcane Forge, Null Field, Crystal Resonance,
    # Void Tap, Temporal Loop, Prism Warden, Shard Familiar, Arcane Conduit,
    # Resonance Spire, Crystalline Shell, Reef Crawler, Tide Sprite, Coral Guard,
    # Crab Shielder, Seahorse Lancer, Jellyfish Drifter, Eel Striker, Reef Shark,
    # Tide Caller, Sea Witch, Anglerfish Lurker, Shipwreck Golem, Abyssal Hunter,
    # Tide Dragon, Leviathan, Coral Wall, Tide Shrine, Siren's Post, Reef Mender,
    # Depth Anchor, Kraken Beacon, Tidal Surge, Pearl Power, Deep Resilience,
    # Current Mastery, Wind Sprite, Air Sprite, Zephyr Scout, Skyguard, Cloud Hawk,
    # Stormcaller (sky), Lightning Archer, Gale Warden, Sky Sentinel, Thunder Drake,
    # Cloudborn Colossus, Sky Leviathan, Gust Wall, Wind Shrine, Storm Tower,
    # Aerie Roost, Sky Beacon, Cloudfort, Thunder Battery, Wind Surge, Feather Step,
    # Lightning Strike, Aerial Volley, Storm Surge (sky), Cloud Cover,
    # Ember Crawler, Cinder Hound, Magma Archer, Scorch Bat, Ash Stalker,
    # Pyroclast Runner, Fire Salamander, Cinder Knight, Ash Revenant, Lava Troll,
    # Ember Wyrm, Flame Warden, Volcanic Golem, Inferno Drake, Molten Colossus,
    # Cinder Wall, Ash Turret, Magma Vent, Fire Forge, Lava Spire, Ember Shrine,
    # Burning Rush, Smelted Blade, Volcanic Hide, Inferno Surge, Spore Crawler,
    # Mycelium Guard, Spore Archer, Rot Stalker, Fungal Shambler, Bloom Sprite,
    # Toadstool Knight, Spore Bat (fungal), Bloom Wisp, Mycelium Hulk, Rot Titan,
    # Spore Colossus, Mycelium Wall, Spore Vent, Fungal Den, Root Snare (fungal),
    # Bloom Spire, Rot Shrine, Spore Cloud (fungal), Mycelium Surge, Deep Growth,
    # Root Surge (fungal), Root Wraith, Queen Spore, Fungal Bloom,
    # Frost Crawler, Ice Shard, Glacier Guard, Frost Archer, Blizzard Runner,
    # Ice Wraith, Rime Stalker, Frozen Knight, Cold Snap, Frost Drake,
    # Glacier Titan, Ice Colossus, Permafrost Wyrm, Ice Wall, Frost Turret,
    # Glacier Beacon, Blizzard Spire, Cryo Forge, Pale Shrine, Frost Surge,
    # Glacier Hide, Blizzard Blast, Permafrost, Sand Raider, Dune Stalker,
    # Desert Archer, Sandstorm Runner, Mirage Blade, Dune Bat, Sand Knight,
    # Mercenary Captain, Mirage Scout, Sandstorm Shaman, Dune Colossus, Desert Titan,
    # Sand Wyrm, Bone Merchant, Sand Wall, Oasis Well, Dune Barracks, Mirage Tower,
    # Desert Spire, Bazaar Post, Desert Rush, Mercenary Pact, Sandstorm,
    # Gold Standard, Avalanche Bear, Pale Colossus, Glass Dancer, Canopy Scout,
    # Vine Runner, Root Creeper, Bark Hound, Ancient Sprite, Root Snare (canopy),
    # Canopy Farm, Ancient Blessing, Elderwood Guard, Canopy Archer, Ancient Treant,
    # Jungle Stalker, Spore Drifter, Ancient Barracks, Canopy Watchtower,
    # Living Thornwall, Elder Shrine, Canopy Growth, Root Network (upgrade canopy),
    # Root Walker, Canopy Drake, Vine Colossus, Elder Grove, Root Surge (canopy),
    # The Elder Warden, Shore Scout, Tide Runner, Salvage Hauler, Wave Brawler,
    # Drift Net, Storm Beacon, Wreck Patch, Coastal Skirmisher, Wreck Diver,
    # Stormcaller (storm), Reef Warden, Storm Hawk, Breakwater Wall, Salvage Dock,
    # Tidal Fortress, Storm Surge (storm), Riptide, Salvage Charge, Tide Stalker,
    # Tempest Rider, Wreck Golem, Stormgate, Maelstrom, The Harbormaster,
    # Coast Leviathan, Gear Scout, Cog Runner, Brass Sentry, Vault Scrap,
    # Gear Assembly, Pressure Valve, Clockwork Tune, Clockwork Archer, Vault Guardian,
    # Piston Brawler, Vault Drone, Gear Wall, Clockwork Forge, Vault Repair Bay,
    # Overcharge, Gear Sprint, Vault Burst, Steam Walker, Iron Colossus,
    # Clockwork Titan, Titan Forge, Drone Array, Overload, The Grand Automaton
    # (Hero cards all have lore)
}

def patch(path):
    with open(path) as f:
        data = json.load(f)

    # Patch templates
    patched_templates = 0
    for key, trait in TEMPLATE_TRAITS.items():
        if key in data['templates']:
            if 'unitTrait' not in data['templates'][key]:
                data['templates'][key]['unitTrait'] = trait
                patched_templates += 1
        else:
            print(f"WARNING: template key '{key}' not found in data['templates']")

    # Patch card lore
    patched_lore = 0
    for card in data['cards']:
        if card['name'] in CARD_LORE and not card.get('lore'):
            card['lore'] = CARD_LORE[card['name']]
            patched_lore += 1

    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Done. Patched {patched_templates} template traits, {patched_lore} card lore entries.")

patch('web/src/data/cards.json')
