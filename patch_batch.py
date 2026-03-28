#!/usr/bin/env python3
import json

TEMPLATE_PRIORITY = {
    "rot-titan":        "buildings",
    "queen-spore":      "boss",       # the queen hunts enemy commanders
    "frost-drake":      "boss",
    "glacier-titan":    "buildings",
    "ice-colossus":     "buildings",
    "permafrost-wyrm":  "buildings",
    "dune-colossus":    "buildings",
    "desert-titan":     "buildings",
    "sand-wyrm":        "buildings",
    "ancient-treant":   "buildings",
    "root-walker":      "buildings",
    "vine-colossus":    "walls",
    "wreck-golem":      "buildings",
    "tempest-rider":    "boss",
    "coast-leviathan":  "buildings",
    "iron-colossus":    "buildings",
    "clockwork-titan":  "buildings",
    "the-grand-automaton": "boss",    # legendary — hunts the enemy boss
}

TEMPLATE_TRAITS = {}
CARD_LORE = {}

path = "web/src/data/cards.json"
with open(path) as f:
    data = json.load(f)

for key, pri in TEMPLATE_PRIORITY.items():
    if key in data["templates"] and "targetPriority" not in data["templates"][key]:
        data["templates"][key]["targetPriority"] = pri
        print(f"  priority -> {key}: {pri}")

for key, trait in TEMPLATE_TRAITS.items():
    if key in data["templates"] and "unitTrait" not in data["templates"][key]:
        data["templates"][key]["unitTrait"] = trait
        print(f"  trait -> {key}")

for card in data["cards"]:
    if card["name"] in CARD_LORE and not card.get("lore"):
        card["lore"] = CARD_LORE[card["name"]]
        print(f"  lore  -> {card['name']}")

with open(path, "w") as f:
    json.dump(data, f, indent=2)
print("Done.")
