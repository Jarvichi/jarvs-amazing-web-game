#!/usr/bin/env python3
"""
rebalance_cards.py — Applies a power-score formula to unit, spawner, and buff
cards in web/src/data/cards.json, then rebalances stats/costs to make each
cost tier internally consistent.

Run from the repo root:
    python3 rebalance_cards.py

Outputs:
    balance_report.txt  — full diff of every flag/change
    web/src/data/cards.json — updated in-place

════════════════════════════════════════════════════════════
FORMULAS  (constants chosen by the author — see calibration notes below)
════════════════════════════════════════════════════════════

Unit power score
────────────────
    dps   = attack × (1000 / attackCooldownMs)
    score = dps^x  ×  maxHp^y  ×  moveSpeed^z  ×  (attackRange + 5)^a
            ──────────────────────────────────────────────────────────
                                  c

where:
    x = 0.65   (DPS exponent — diminishing returns on burst damage)
    y = 0.65   (HP exponent — similar diminishing returns)
    z = 0.20   (speed exponent — mobility matters but not linearly)
    a = 0.15   (range exponent — range+5 offset keeps melee at ≥1)
    b = 1.0    (cooldown is already captured inside dps, no separate term)
    c = 30.0   (divisor calibrated so Goblin {atk=3,hp=10,spd=45,rng=5,cd=1000} → 1.0)

Resulting formula cost = round(score / c), clamped to [1, 8].

Building / spawner mana cost
────────────────────────────
    rate_factor = (7000 / intervalMs)^r   where r = 0.50
    hp_factor   = (maxHp / 20)^p          where p = 0.25
    raw         = spawned_unit_cost × rate_factor × hp_factor
    cost        = round(raw × q + s)

where:
    r = 0.50   (spawn-rate exponent — faster spawning → higher cost, sub-linearly)
    p = 0.25   (hp exponent — tankier buildings cost slightly more)
    q = 1.40   (overall scale factor)
    s = 1.30   (base offset — every spawner costs at least ~s mana before raw)

Calibration: Barracks {goblin cost-1, 7 s, hp 25} → formula 3 ✓

Buff / upgrade mana cost
────────────────────────
    cost = max(1, round(|amount| × weight[effect_type]))

weight table (chosen to reproduce current calibration cards):
    buffAttack        : 0.60   (+4 ATK → 2.4 → cost 2 ✓)
    buffMaxHp         : 0.10   (+15 HP → 1.5 → cost 2 ✓)
    buffSpeed         : 0.13   (+12 speed → 1.56 → cost 2 ✓)
    buffRange         : 0.07   (+25 range → 1.75 → cost 2 ✓)
    healUnits         : 0.15   (+4 heal → 0.6 → cost 1 ✓)
    buffHp            : 0.10
    aoe               : 0.50
    buffAttackCooldown: 0.20
"""

import json
import math
from pathlib import Path

CARDS_PATH = Path("web/src/data/cards.json")
REPORT_PATH = Path("balance_report.txt")

# ── Constants ─────────────────────────────────────────────────────────────────

# Unit formula exponents (map to issue variables x, y, z, a, b, c)
X = 0.65   # DPS exponent
Y = 0.65   # HP exponent
Z = 0.20   # speed exponent
A = 0.15   # range exponent
C = 30.0   # divisor (calibration)

# Building formula constants (map to issue variables p, q, r, s)
P = 0.25   # hp_factor exponent
Q = 1.40   # overall scale
R = 0.50   # spawn-rate exponent
S = 1.30   # base offset

BUFF_WEIGHTS = {
    "buffAttack":         0.60,
    "buffMaxHp":          0.10,
    "buffSpeed":          0.13,
    "buffRange":          0.07,
    "healUnits":          0.15,
    "buffHp":             0.10,
    "aoe":                0.50,
    "buffAttackCooldown": 0.20,
}

# Tolerance for flagging unit outliers (fraction from tier median)
OUTLIER_THRESHOLD = 0.45   # flag if score is >45% above/below median
# Max single-stat adjustment when correcting an outlier
MAX_STAT_CHANGE_RATIO = 0.15  # ±15 %

# Template slug prefixes to never auto-adjust
PROTECTED_PREFIXES = ("boss-", "hero-", "weak-")
# Template slug suffixes to never auto-adjust
PROTECTED_SUFFIXES = ("-weak", "-mini", "-boss")


# ── Formula functions ─────────────────────────────────────────────────────────

def unit_power_score(attack, maxHp, moveSpeed, attackRange, attackCooldownMs):
    """Return raw power score for a unit. Higher = stronger."""
    if attackCooldownMs <= 0 or attack <= 0 or maxHp <= 0 or moveSpeed <= 0:
        return 0.0
    dps = attack * (1000.0 / attackCooldownMs)
    return (dps ** X) * (maxHp ** Y) * (moveSpeed ** Z) * ((attackRange + 5) ** A)


def formula_unit_cost(score):
    """Map raw score → mana cost integer [1, 8]."""
    return max(1, min(8, round(score / C)))


def building_formula_cost(spawned_card_cost, intervalMs, maxHp):
    """Return formula mana cost for a spawner building."""
    rate_factor = (7000.0 / intervalMs) ** R
    hp_factor   = (maxHp / 20.0) ** P
    raw = spawned_card_cost * rate_factor * hp_factor
    return max(2, min(9, round(raw * Q + S)))


def upgrade_formula_cost(effect_type, amount):
    """Return formula mana cost for an upgrade card."""
    weight = BUFF_WEIGHTS.get(effect_type, 0.10)
    # Use standard (non-banker's) rounding so 0.5 always rounds up.
    val = abs(amount) * weight
    return max(1, min(6, int(val + 0.5)))


# ── Helpers ───────────────────────────────────────────────────────────────────

def is_protected_template(slug):
    for pre in PROTECTED_PREFIXES:
        if slug.startswith(pre):
            return True
    for suf in PROTECTED_SUFFIXES:
        if slug.endswith(suf):
            return True
    return False


def get_unit_stats(unit_dict):
    """Return stat tuple from a unit dict (template or inline)."""
    return (
        unit_dict.get("attack", 0),
        unit_dict.get("maxHp", 0),
        unit_dict.get("moveSpeed", 0),
        unit_dict.get("attackRange", 0),
        unit_dict.get("attackCooldownMs", 1000),
    )


def median(lst):
    if not lst:
        return 0.0
    s = sorted(lst)
    n = len(s)
    return s[n // 2] if n % 2 == 1 else (s[n // 2 - 1] + s[n // 2]) / 2.0


def adjust_stat(stats_dict, current_score, target_score, report_lines, name):
    """
    Nudge the single most-impactful stat (HP) to bring score closer to target.
    Adjustment capped at MAX_STAT_CHANGE_RATIO. Returns True if a change was made.
    """
    atk  = stats_dict.get("attack", 1)
    hp   = stats_dict.get("maxHp", 1)
    spd  = stats_dict.get("moveSpeed", 1)
    rng  = stats_dict.get("attackRange", 5)
    cd   = stats_dict.get("attackCooldownMs", 1000)

    ratio = (target_score / current_score) if current_score > 0 else 1.0
    ratio = max(1 - MAX_STAT_CHANGE_RATIO, min(1 + MAX_STAT_CHANGE_RATIO, ratio))

    # Try HP first (most neutral/"flavour-safe" stat to tweak)
    new_hp = max(4, round(hp * ratio))
    if new_hp != hp:
        stats_dict["maxHp"] = new_hp
        report_lines.append(f"    → [{name}] maxHp {hp} → {new_hp}")
        return True

    # Fall back to attack
    new_atk = max(1, round(atk * ratio))
    if new_atk != atk:
        stats_dict["attack"] = new_atk
        report_lines.append(f"    → [{name}] attack {atk} → {new_atk}")
        return True

    return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    data = json.loads(CARDS_PATH.read_text())
    templates = data["templates"]
    cards     = data["cards"]

    lines = []
    lines.append("BALANCE REPORT — rebalance_cards.py")
    lines.append("=" * 60)
    lines.append(__doc__)

    total_changes = 0

    # ── Count template usages ─────────────────────────────────────────────────
    # For each template slug track how many cards reference it and how many
    # structures spawn from it (so we avoid auto-adjusting shared templates).
    template_card_usages    = {}   # slug → count of unit cards using unitRef
    template_spawner_usages = {}   # slug → count of spawner structures
    card_cost_for_ref       = {}   # slug → card cost (for the one unit card)

    for card in cards:
        if card.get("cardType") == "unit" and "unitRef" in card:
            slug = card["unitRef"]
            template_card_usages[slug] = template_card_usages.get(slug, 0) + 1
            card_cost_for_ref[slug] = card["cost"]

        if card.get("cardType") == "structure":
            se = card.get("unit", {}).get("structureEffect", {})
            if se.get("type") == "spawn":
                ref = se.get("unitTemplateRef", "")
                if ref:
                    template_spawner_usages[ref] = template_spawner_usages.get(ref, 0) + 1

    # ────────────────────────────────────────────────────────────────────────
    # PART 1 — UNIT CARDS
    # ────────────────────────────────────────────────────────────────────────
    lines.append("\n" + "─" * 60)
    lines.append("PART 1 — UNIT CARDS")
    lines.append("─" * 60)

    # Pass 1: collect scores by cost tier
    scores_by_cost = {}   # cost → list of (score, card_name, stats_source, stats_dict, is_adjustable)

    for card in cards:
        if card.get("cardType") != "unit":
            continue

        cost = card["cost"]
        stats_dict   = None
        is_adjustable = False

        if "unitRef" in card:
            slug = card["unitRef"]
            if slug in templates and not is_protected_template(slug):
                stats_dict = templates[slug]
                # Adjustable only if exactly one unit card references it AND no spawner uses it
                if (template_card_usages.get(slug, 0) == 1
                        and template_spawner_usages.get(slug, 0) == 0):
                    is_adjustable = True
        elif "unit" in card:
            stats_dict = card["unit"]
            is_adjustable = True   # inline → only affects this card

        if stats_dict is None:
            continue

        atk, hp, spd, rng, cd = get_unit_stats(stats_dict)
        if atk == 0 or hp == 0 or spd == 0:
            continue   # wall/non-combat unit

        sc = unit_power_score(atk, hp, spd, rng, cd)
        scores_by_cost.setdefault(cost, []).append(
            (sc, card["name"], stats_dict, is_adjustable)
        )

    # Compute median target per tier
    tier_medians = {cost: median([e[0] for e in entries])
                    for cost, entries in scores_by_cost.items()}

    lines.append("\nTier power-score medians (formula cost in brackets):")
    for cost in sorted(tier_medians):
        med = tier_medians[cost]
        lines.append(f"  Cost {cost}: median score = {med:.1f}  "
                     f"[formula cost = {formula_unit_cost(med)}]  "
                     f"n={len(scores_by_cost[cost])}")

    lines.append(
        f"\nOutliers (>{OUTLIER_THRESHOLD*100:.0f}% above or below tier median):"
    )

    unit_changes = 0
    for cost in sorted(scores_by_cost):
        target = tier_medians[cost]
        for (sc, name, stats_dict, is_adjustable) in scores_by_cost[cost]:
            if target <= 0:
                continue
            deviation = abs(sc - target) / target
            if deviation <= OUTLIER_THRESHOLD:
                continue

            direction   = "OVER" if sc > target else "UNDER"
            formula_c   = formula_unit_cost(sc)
            lines.append(
                f"  [{direction} {sc/target:.2f}×] {name}  "
                f"(cost {cost}, formula→{formula_c})  score={sc:.1f}  target={target:.1f}"
            )

            if is_adjustable:
                changed = adjust_stat(stats_dict, sc, target, lines, name)
                if changed:
                    unit_changes += 1
                    total_changes += 1
            else:
                lines.append(f"    → Template shared or protected — skipped auto-adjust")

    lines.append(f"\nUnit stat adjustments applied: {unit_changes}")

    # ────────────────────────────────────────────────────────────────────────
    # PART 2 — SPAWNER STRUCTURES
    # ────────────────────────────────────────────────────────────────────────
    lines.append("\n" + "─" * 60)
    lines.append("PART 2 — SPAWNER STRUCTURES")
    lines.append("─" * 60)
    lines.append(
        "\nFormula: cost = round( spawned_unit_cost"
        " × (7000/intervalMs)^0.50"
        " × (maxHp/20)^0.25"
        " × 1.40 + 1.30 )"
    )
    lines.append("Only auto-applies when |diff| ≤ 1.\n")

    spawner_changes = 0
    for card in cards:
        if card.get("cardType") != "structure":
            continue
        unit_def = card.get("unit", {})
        se = unit_def.get("structureEffect", {})
        if se.get("type") != "spawn":
            continue

        spawned_ref = se.get("unitTemplateRef", "")
        intervalMs  = se.get("intervalMs", 10000)
        maxHp       = unit_def.get("maxHp", 20)
        current     = card["cost"]

        # Prefer using the actual card cost for the spawned unit
        spawned_cost = card_cost_for_ref.get(spawned_ref)
        if spawned_cost is None:
            # Fall back to formula cost from template
            if spawned_ref in templates:
                t = templates[spawned_ref]
                atk, hp, spd, rng, cd = get_unit_stats(t)
                sc = unit_power_score(atk, hp, spd, rng, cd)
                spawned_cost = formula_unit_cost(sc)
            else:
                continue   # can't determine spawned unit cost

        formula_c = building_formula_cost(spawned_cost, intervalMs, maxHp)
        diff = formula_c - current

        if diff == 0:
            continue

        lines.append(
            f"  {card['name']}: current={current}  formula={formula_c}  "
            f"(spawns '{spawned_ref}' cost {spawned_cost}, "
            f"every {intervalMs//1000}s, hp={maxHp})  diff={diff:+d}"
        )

        if abs(diff) <= 1:
            card["cost"] = formula_c
            lines.append(f"    → Updated cost {current} → {formula_c}")
            spawner_changes += 1
            total_changes += 1
        else:
            lines.append(f"    → Diff |{diff}| > 1 — flagged for manual review")

    lines.append(f"\nSpawner cost adjustments applied: {spawner_changes}")

    # ────────────────────────────────────────────────────────────────────────
    # PART 3 — UPGRADE / BUFF CARDS
    # ────────────────────────────────────────────────────────────────────────
    lines.append("\n" + "─" * 60)
    lines.append("PART 3 — UPGRADE / BUFF CARDS")
    lines.append("─" * 60)
    lines.append(
        "\nFormula: cost = max(1, round(|amount| × weight[effect_type]))"
    )
    lines.append("Only auto-applies when |diff| ≤ 1.\n")

    upgrade_changes = 0
    for card in cards:
        if card.get("cardType") != "upgrade":
            continue
        ue = card.get("upgradeEffect", {})
        effect_type = ue.get("type", "")
        amount = ue.get("amount", 0)
        current = card["cost"]

        if not effect_type or amount == 0:
            continue

        formula_c = upgrade_formula_cost(effect_type, amount)
        diff = formula_c - current

        if diff == 0:
            continue

        lines.append(
            f"  {card['name']}: current={current}  formula={formula_c}  "
            f"({effect_type} ×{amount})  diff={diff:+d}"
        )

        if abs(diff) <= 1:
            card["cost"] = formula_c
            lines.append(f"    → Updated cost {current} → {formula_c}")
            upgrade_changes += 1
            total_changes += 1
        else:
            lines.append(f"    → Diff |{diff}| > 1 — flagged for manual review")

    lines.append(f"\nUpgrade cost adjustments applied: {upgrade_changes}")

    # ────────────────────────────────────────────────────────────────────────
    # SUMMARY
    # ────────────────────────────────────────────────────────────────────────
    lines.append("\n" + "=" * 60)
    lines.append("SUMMARY")
    lines.append("=" * 60)
    lines.append(f"  Unit stat adjustments : {unit_changes}")
    lines.append(f"  Spawner cost changes  : {spawner_changes}")
    lines.append(f"  Upgrade cost changes  : {upgrade_changes}")
    lines.append(f"  TOTAL changes applied : {total_changes}")

    # Save
    CARDS_PATH.write_text(json.dumps(data, indent=2))
    REPORT_PATH.write_text("\n".join(lines))
    print("\n".join(lines[-12:]))
    print(f"\nFull report written to: {REPORT_PATH}")
    print(f"Updated cards.json: {CARDS_PATH}")


if __name__ == "__main__":
    main()
