# Jarv's Amazing Web Game — Agent Guide

> All general project rules (Git workflow, error logging, CSS, GitHub Issues, Todo tracking, Sprites, etc.) are in **CLAUDE.md**. This file contains only agent-specific checklists not covered there.

---

## Acts — Design Rules

All rules governing how acts, the campaign map, node types, relics, heroes, the lives system, music, and card authoring work are documented in **[`docs/acts.md`](docs/acts.md)**. Agents must read this file before:
- Creating or modifying act JSON files (`web/src/data/acts/*.json`)
- Adding new node types, relics, hero cards, or boss mechanics
- Authoring campaign story text or replay variants
- Implementing any of the features listed as ❌ not implemented in that doc

The doc also contains the **Act Authoring Checklist** (§12) — run through it for every new act.

---

## Campaign Event Checklist (for agents)

When creating or modifying campaign act files (`web/src/data/acts/*.json`) ensure any new `eventId` values are present in the events catalog (`web/src/data/events.json`) or handled by the generator functions (`generateShrineEvent`, `generateRuinsEvent`). Follow this checklist:

- **Add event entry:** If the `eventId` is a named catalog entry (not `shrine`/`ruins`), add an entry under `catalog` in `web/src/data/events.json` with `id`, `title`, `description`, and `choices` matching the `EventData` shape.
- **Generators:** If the event should be procedurally generated per-visit (like `shrine`/`ruins`), prefer adding a generator in `web/src/game/questline.ts` and adding the key to `EVENT_CATALOG` there.
- **Update act JSON:** Ensure the act node uses the same `eventId` string used in `events.json` (exact match).
- **Unit tests / quick QA:** Run the dev server and verify that selecting the node opens the event UI (not a battle). Quick local test:
  ```bash
  cd web
  npm run dev
  # Start the app and navigate to the act, click the new event node
  ```
- **Sprites / assets:** If the event includes new named items or cards, ensure their assets (card images, sprites) exist and are committed.
- **Commit message:** Use a clear message, e.g. `feat(campaign): add supply-cache event + act2 node reference`.
- **PR description:** Mention the act id and node id, and add a note asking QA to verify the node opens the event screen.
