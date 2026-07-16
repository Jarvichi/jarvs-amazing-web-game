# Campaign 2 — The Forgotten Kingdom

> Authoritative story + content outline for the second 13-act campaign arc
> (issue #181, milestone "Campaign: The Forgotten Kingdom"). Read this before
> authoring any `c2act*.json` file. Mechanics rules are unchanged — follow
> `docs/acts.md` and the "Creating a New Act" workflow in `AGENTS.md` for
> everything structural; this doc defines the *story*, per-act themes, bosses,
> relics, and hero cards so acts written in separate sessions stay consistent.

---

## 1. Premise

Campaign 1 ended with Jarv sealing the Fracture: the shards fused back into a
single Dominion, and the world calls Jarv **Worldmender**.

But the Fracture did not only break the world — it *erased* part of it. When
the Grand Dominion shattered, one entire kingdom — **Amarath** — was cast
outside existence. Every map, record, and memory of it was wiped in the same
instant. Nobody mourned Amarath, because nobody remembered it had ever been.

When Jarv mended the world, everything the Fracture had scattered came back.
*Everything.* East of Ironhold Keep, where every map shows an empty quarter,
there is now a kingdom: pale towns, candle-lit roads, fields under a mist that
never lifts. Its people — the **Unremembered** — endured centuries in the void,
held together by their monarch's vigil-rite. They remember everything about
the old world. The world remembers nothing about them.

Amarath has not returned grateful. Its ruling **Pale Court** wants restitution:
not reintegration, but *replacement* — unwriting the Dominion's history so that
Amarath's can be written back in its place. The kingdom's vanguard is already
crossing the Marches.

**Tone:** aftermath, memory, and grief — the celebration of campaign 1 curdling
into a colder war. The Unremembered are not monsters; they are the people the
world forgot, led by rulers who refuse to be forgotten twice. Boss dialogue
should carry that wound.

**How it starts:** Cartographer Elsben in Ironhold Keep notices his new surveys
disagree with every archived map — there is a kingdom in the blank quarter.
Once campaign 1 is complete, talking to Elsben launches Campaign 2.

## 2. The antagonist — the Pale Court

- **The Vigil King** (finale boss) — the monarch whose vigil-rite kept Amarath
  alive in the void. Centuries of holding a kingdom together by will alone have
  hollowed him into something between a king and a rite. He does not hate the
  Dominion; he simply cannot allow it to keep the centuries Amarath lost.
- The act bosses are his court and its instruments — heralds, wardens,
  regents — each embodying one thing the kingdom preserved (or lost) in the void.
- Recurring motifs: candles and vigils, blank maps, names (kept, eaten,
  returned), mist, and things that waited too long.

## 3. Structure & registry

- Acts: `c2act1` … `c2act13`, then `c2finale` — mirrors campaign 1
  (act1…act13 → actfinale). Chained via `nextActId`; the last authored act has
  **no** `nextActId` until its successor lands (the app shows a
  "TO BE CONTINUED" screen at the chain's current end).
- Campaign metadata lives in `CAMPAIGNS` in `web/src/game/questline.ts`
  (campaign 2 = id `c2`, start `c2act1`, finale `c2finale`).
- Campaign 2 is unlocked by completing campaign 1 (`loadActCount('actfinale') > 0`)
  and launched only from Elsben's dialogue in Ironhold Keep.
- Collection, crystals, relics, mastery, archetypes all persist — no resets.
- Each act still follows the standard 13-node map, 25 themed cards, boss +
  trait, relic, hero card, and achievement set (see `docs/acts.md` §12).

## 4. Act-by-act outline

| # | Act id | Title / Region | Boss (bossAI id) | Boss trait sketch | Relic | Hero card |
|---|--------|----------------|------------------|-------------------|-------|-----------|
| 1 | `c2act1` | **The Pale Marches** — the mist border where the maps go blank; first contact with Amarath's vanguard | **The Pale Herald** (`paleherald`) | *Proclamation Descent* — fly: ascends untouchable, descends on the player's densest cluster | **Vigil Candle** 🕯️ | Warden of the Marches |
| 2 | `c2act2` | **The Grey Causeway** — the mile-long toll-road into Amarath, lined with unlit lamps | The Toll Warden (`tollwarden`) | column_aoe — slams the causeway, one column pays the toll | Toll Warden's Scale | Causeway Guide |
| 3 | `c2act3` | **The Unremembered Fields** — farmland growing memory-wheat; eating it returns lost memories | The Gleaner Queen (`gleanerqueen`) | split — scatters into harvest effigies that must all fall | Sheaf of Names | First Reaper |
| 4 | `c2act4` | **The Archive of Names** — where every erased name is shelved, guarded, and fed | The Name-Eater (`nameeater`) | burrow — slips between shelves, resurfaces beside your strongest unit | Index of the Lost | The Archivist Returned |
| 5 | `c2act5` | **The Candle City** — Amarath's second city, lit by ten thousand vigil flames | The Lamplighter General (`lamplighter`) | periodic jump_aoe — snuffs a region with a wax-fall | Lamplighter's Wick | Candle Sergeant |
| 6 | `c2act6` | **The Sunken Border** — the coast came back misaligned; drowned towers stand in new tide | The Drowned Envoy (`drownedenvoy`) | fly (wave dive) — rides a returning tide onto your lines | Envoy's Pearl | Tide Warden |
| 7 | `c2act7` | **The Mirror Marsh** — still water reflecting the world as it was before the Fracture | The Reflection (`thereflection`) | split — steps out of the water as three of itself | Backwards Glass | Marsh Pathfinder |
| 8 | `c2act8` | **The Hollow Court** — Amarath's nobility, masked because they forgot their own faces | The Chamberlain (`chamberlain`) | column_aoe — a courtly gesture erases one column of the field | Hollow Mask | Masked Duelist |
| 9 | `c2act9` | **The Winter That Waited** — the season Amarath stored in the void, released as a weapon | The Frost Regent (`frostregent`) | periodic column_aoe — waited winter rolls down a column | Waited Snowflake | Winter Warden |
| 10 | `c2act10` | **The Bone Orchards** — groves grown from the kingdom's dead, tended and beloved | The Orchard Keeper (`orchardkeeper`) | split — the orchard rises: saplings that must all be felled | Orchard Blossom | Grove Sentinel |
| 11 | `c2act11` | **The Vigil Roads** — processional highways walked for centuries to keep the rite alive | The Procession Master (`processionmaster`) | periodic jump_aoe — the procession marches through your lines | Procession Bell | Road Captain |
| 12 | `c2act12` | **The Crown Reaches** — the fortified approach to the capital; the Court's last field army | The Pale Marshal (`palemarshal`) | jump_aoe — commander's drop onto your densest cluster | Marshal's Baton | Reach Breaker |
| 13 | `c2act13` | **The City of Vigils** — Amarath's capital, where every window holds a candle | The Vigil Queen (`vigilqueen`) | fly + heavy landing — the queen's ascent, grief made weather | Queen's Candle | Vigil Knight |
| F | `c2finale` | **The Throne of the Unremembered** — the vigil chamber where the King held a kingdom in his mind | **The Vigil King** (`vigilking`) | multi-threshold (66/33) — the vigil-rite reignites: full-field events | Crown of the Remembered (campaign trophy) | — |

> Boss trait sketches are starting points — give each a full §13 trait object
> in `bossAIs.json` when the act is authored, and vary the trait types so
> adjacent acts don't repeat.

**Arc shape:** acts 1–4 are the border war (discovery, first contact, learning
what Amarath is). Acts 5–8 go deep into the kingdom and humanise it — the
player starts to see what the Dominion's forgetting cost these people. Acts
9–12 are the Court's counter-offensive and the march on the capital. Act 13 and
the finale resolve it: the Vigil Queen falls, and the Vigil King's rite must be
ended — not by erasing Amarath again, but by *remembering* it. The finale's
outro writes Amarath back onto the world's maps: remembered, at peace, part of
the mended Dominion. (Leave a hook: what else did the Fracture erase?)

## 5. Story continuity rules (in addition to `docs/acts.md` §4)

- Campaign 2 text must treat campaign 1 as **finished history**: the Fracture
  is sealed, the shards are one Dominion, Jarv is the Worldmender. No dangling
  "the Fracture still threatens" phrasing.
- The Unremembered remember the pre-Fracture world perfectly. Use that: their
  dialogue can reference true old-world details no living Dominion NPC knows.
- Never present the Unremembered rank-and-file as evil — the Pale Court is the
  antagonist; grief is the engine.
- Card lore for `forgotten`-tagged cards should echo the motifs in §2.
- Hub world: post-campaign-1 NPC lines (`postCampaignDialogue`) acknowledge the
  sealed Fracture and, in border towns, unease about the east. Elsben is the
  only NPC who *launches* campaign 2.

## 6. Per-act theming checklist (delta on top of `docs/acts.md` §12)

- [ ] Act `rewardTags` include `"forgotten"` plus one act-specific tag
      (e.g. `["forgotten", "marches"]`); the act's 25 cards carry `"forgotten"`.
- [ ] Intro panels acknowledge where the previous act left the invasion.
- [ ] Boss dialogue references the Court and the vigil.
- [ ] 2 memory-fragment nodes with entries in `memoryFragments.json` telling
      Amarath's side of the erasure (mirrors campaign 1's fragment usage).
- [ ] `nextActId` added to the *previous* act's JSON when a new act lands.
- [ ] Sub-issue for the act closed only after the full §12 checklist passes.
