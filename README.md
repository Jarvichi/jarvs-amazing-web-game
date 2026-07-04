# Jarv's Amazing Web Game

A browser-based campaign roguelike: explore a hub-world town, pick your path through a branching act map, and fight real-time card battles to take down each act's boss.

> ## 🤖 This project is almost entirely AI-generated
>
> The code, content, and this README are built and maintained by an AI coding agent (Claude), working from GitHub Issues. There is no expectation that humans read the code or submit pull requests.
>
> **If you want to contribute, please [open a GitHub Issue](https://github.com/Jarvichi/jarvs-amazing-web-game/issues)** — a bug report or a feature request. Don't fork the repo to implement an issue yourself; the agent picks up open issues and does the implementation.

**Play now:** [https://jawg.uk/](https://jawg.uk/)

## What is this game

- **Hub world** — a walkable town with NPCs, quests, shops, and casino-style minigames.
- **Campaign map** — each act is a branching map of nodes (battle, elite, boss, rest, event, merchant, mystery) that converge before a boss fight.
- **Real-time card battles** — mana regenerates continuously (no discrete turns). Play cards to deploy units, build structures, and cast upgrades; units then move and fight automatically, guided by a stance you set (auto / attack / hold / defend).
- **Relics & progression** — relics, lives, and collection/mastery persist across runs even though your deck resets each act.
- **Minigames** — Tower Defence, City Builder, Fishing, Farming Sim, and several casino games are all reachable from the hub.

For full mechanical detail, see [`AGENTS.md`](AGENTS.md), [`docs/acts.md`](docs/acts.md) (campaign/act structure), and [`docs/hubworld.md`](docs/hubworld.md) (hub-world schemas).

## Cards

The card collection has grown to **610 cards** (441 unit templates, plus hero cards) across rarities from common to legendary, with costs, targeting rules, tags, and affinities between cards. The full list lives in [`web/src/data/cards.json`](web/src/data/cards.json).

## Run Locally

```bash
cd web
npm install
npm run dev
```

## Deploy

The game auto-deploys to the custom domain [jawg.uk](https://jawg.uk/) when merged to `main` via GitHub Actions.
