import React, { useRef } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../hooks/usePixiApp'
import { buildTerrainGfx, buildBgTileGfx, buildDecorGfx } from '../../utils/terrainLayer'
import { renderPathTiles } from '../../utils/tileLookup'
import { loadSpriteTexture, loadTextureUrl, loadAnimFrames, loadTileRef } from '../../utils/pixiHelpers'
import { resolveNpcSprite, spriteSlug } from '../../game/sprites'
import { getTodaysShopItems } from '../../game/hub/shopStock'
import { loadDailyShopState, isShopItemSold } from '../../game/shopSchedule'
import { PATH_TILE } from '../../data/tiles/tileIndex'
import { findPath, nearestWalkable } from '../../utils/hubPathfinder'
import { isBuildingOpen, getNpcLocation, getNpcActivity, getNpcDialoguePool } from '../../game/hub/hubNpcSchedule'
import { getGameHour, getGameMinute } from '../../game/hub/hubClock'
import { emitSound, startInteriorAudio, stopInteriorAudio, setNightAmbiance } from '../../game/sound'
import { WALL_TILES } from '../../data/tiles/buildingMaterials'
import type { WallMaterial, RoofMaterial } from '../../data/tiles/buildingMaterials'
import { placeBuildingTiles, resolveBuildingVisual } from '../../data/tiles/buildingRender'
import { loadPlayerAvatar, ALL_CONSUMABLES } from '../../game/questline'
import { getAugmentCard, AUGMENT_SPRITE } from '../../game/augments'
import { createChunkCuller } from '../../utils/chunkCull'
import { CommanderState } from '../../game/commander'
import rollbar from '../../rollbar'
import { FlameColor, FlameType, HubInteractable, HubInterior, HubInteriorExit, HubLocationBundle, HubNpc, HubQuestBundle, HubStreetGroup, NpcScheduleEntry, isVisibleAtLevel } from '../../data/hub/loader'
import { createAnimalSystem, AnimalSystem, GlowSource, PLAYER_OWNER_ID } from './hubAnimals'
import { getActivePet } from '../../game/hub/pet'
import { isInteractableGranted, interactableStoreKey } from '../../game/hub/interactables'
import type { AnimalType } from '../../game/hub/animals'
import { createWeatherSystem } from './hubWeather'
import { resolveWeather } from '../../game/hub/weather'
import { getActiveFestival } from '../../game/hub/hubCalendar'
import { loadHomeLayout } from '../../game/hub/homeLayout'
import { getFurnitureTileOffsets } from '../../game/hub/furnitureTiles'
import { getResolvedRoomStyle } from '../../game/hub/roomStyle'
import {
  getPurchasedSlotIds, getRoomSlotDef, buildMainRoomExit, parseSlotBuildingId, synthesizeSlotInterior,
} from '../../game/hub/houseRooms'


const T                 = 32
const SPRITE_SIZE       = T * 1.5
const WALK_PX_PER_S     = 160
const NPC_WALK_PX_PER_S = 80

const NIGHT_LIGHT_INNER  = 4 * T   // fully lit within this radius of avatar
const NIGHT_LIGHT_OUTER  = 7 * T   // fully dark beyond this radius
const NIGHT_NPC_LIGHT_R  = 2 * T   // small glow radius around each NPC

// ── Interactable affordance aura ────────────────────────────────────────────
// A faint pulsing halo drawn behind tap-reactive objects that own visible decor
// (stalls, notice boards, chests, forage spots, etc.), so players can spot what's
// interactable without a wiki. Deliberately skips true secrets (dialogue/giveItem-only,
// authored to stay hidden — see docs/hubworld.md §7). Tune these to iterate on the look.
const INTERACTABLE_AURA_ENABLED      = true
const INTERACTABLE_AURA_COLOR_EXTERIOR = 0xffa94d  // warm orange, outdoors
const INTERACTABLE_AURA_COLOR_INTERIOR = 0x7ec8ff  // faint sky-blue, indoors
const INTERACTABLE_AURA_RADIUS_PAD   = 6         // px the aura extends past the object's footprint
const INTERACTABLE_AURA_OUTER_ALPHA  = 0.10      // outermost soft layer
const INTERACTABLE_AURA_MID_ALPHA    = 0.10
const INTERACTABLE_AURA_INNER_ALPHA  = 0.14      // brightest, innermost layer
const INTERACTABLE_AURA_PULSE_MIN    = 0.6       // aura alpha multiplier at the dimmest point of the pulse
const INTERACTABLE_AURA_PULSE_MAX    = 1.0       // ...and the brightest
const INTERACTABLE_AURA_PULSE_PERIOD = 2400      // ms per full pulse cycle — slow, calm breathing
// Reaction types that mean "the player is meant to find and use this" — gates the aura.
// Deliberately excludes dialogue/giveItem-only secrets, which are authored to stay hidden
// (docs/hubworld.md §7), regardless of whether they own decor. `dig` isn't included here
// directly — it's handled specially in interactableWantsAura below, since only weather-gated
// dig spots (rain puddles, fog moss) share forage's problem of reusing an ordinary-looking
// prop; earth/hollow dig spots pair with a dirt patch, which already reads as diggable.
const AURA_REACTION_TYPES = new Set(['buy', 'buyPack', 'buyHubItem', 'screen', 'quest', 'move', 'forage'])

const _savedTiles = new Map<string, [number, number]>()
export function getSavedHubTile(locationKey?: string): [number, number] | null {
  return _savedTiles.get(locationKey ?? 'ravenwatch') ?? null
}

// ── Interior BFS pathfinder ────────────────────────────────────────────────────
function findInteriorPath(
  from: [number, number],
  to: [number, number],
  walkable: Set<string>,
): [number, number][] {
  const key = (t: [number, number]) => `${t[0]},${t[1]}`
  const queue: [number, number][][] = [[from]]
  const visited = new Set([key(from)])
  while (queue.length > 0) {
    const path = queue.shift()!
    const cur = path[path.length - 1]
    if (cur[0] === to[0] && cur[1] === to[1]) return path
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const next: [number, number] = [cur[0] + dx, cur[1] + dy]
      if (walkable.has(key(next)) && !visited.has(key(next))) {
        visited.add(key(next))
        queue.push([...path, next])
      }
    }
  }
  return [from]
}

interface Props {
  onAreaEnter:      (areaName: string | null) => void
  onNodeInteract:   (screen: string) => void
  onAvatarMove:     (px: number, py: number) => void
  /** Fires once per tile the avatar walks onto (a discrete "step"). */
  onAvatarStep?:    () => void
  returnRef?:       React.MutableRefObject<(() => void) | null>
  unitCards?:       string[]
  commander?:       CommanderState
  onNpcTap?:        (dialogue: string, npcId: string) => void
  onAnimalTap?:     (animalId: string) => void
  /** Fires for every animal tap (placed or procedural) for journal/bestiary tracking. */
  onAnimalSeen?:    (type: AnimalType, variant?: string) => void
  /** Lets React intercept a tap on an ambient (id-less) animal, e.g. to offer
   *  feeding it. Return true if handled (suppresses the flavour bubble). */
  onAmbientAnimalTap?: (type: AnimalType) => boolean
  interiorEnterRef?: React.MutableRefObject<((buildingId: string) => void) | null>
  interiorExitRef?:  React.MutableRefObject<(() => void) | null>
  petActionRef?:     React.MutableRefObject<{ sendPetFetching: (onReturn: () => void) => boolean; givePetAffection: () => void; setPetAccessory: (assetId: string | null) => void } | null>
  onEnterInterior?:  (buildingId: string) => void
  onExitInterior?:   () => void
  onTileTap?:        (tx: number, ty: number) => void
  pickedUpIds?:      Set<string>
  onItemPickup?:     (id: string, questId?: string) => void
  doorKeys?:         Set<string>
  onDoorLocked?:     (buildingId: string, requiredItem: string) => void
  questNpcState?:        React.MutableRefObject<Map<string, 'offer' | 'ready' | null>>
  activeQuestIdsRef?:    React.MutableRefObject<Set<string>>
  completedQuestIdsRef?: React.MutableRefObject<Set<string>>
  collectedTreasureIds?: Set<string>
  onTreasureStep?:       (id: string) => void
  gameHour?:             number
  isNight?:              boolean
  npcProximityDialogue?: React.MutableRefObject<Map<string, { atDistance: number; text: string }[]>>
  onInteractableTap?:         (id: string) => void
  /** Indicator condition id → visible (e.g. 'unread-news' → true) */
  interactableIndicatorsRef?: React.MutableRefObject<Map<string, boolean>>
  /** Interactable id → persisted position override */
  interactableMovesRef?:      React.MutableRefObject<Map<string, { tx: number; ty: number }>>
  /** Receives a callback to reposition an interactable's sprites live */
  moveInteractableRef?:       React.MutableRefObject<((id: string, tx: number, ty: number) => void) | null>
  /** Receives a callback to add a live "Sold" badge to a shop interactable */
  markInteractableSoldRef?:   React.MutableRefObject<((id: string) => void) | null>
  /** Receives a callback to float a ❤️/💔 above a named exterior NPC's head
   *  when their friendship changes. No-ops if that NPC isn't currently a
   *  visible exterior sprite (indoors, gated, or not on screen). */
  showFriendshipReactionRef?: React.MutableRefObject<((npcId: string, kind: 'up' | 'down') => void) | null>
  /** buildingId → purchased upgrade level; reveals unlocked decor live */
  buildingUpgradeLevelsRef?:  React.MutableRefObject<Record<string, number>>
  locationData:         HubLocationBundle
  questData: HubQuestBundle
  /** Scroll container whose scroll position drives the camera. When set, the
   *  canvas is viewport-sized; without it (e.g. Storybook) it spans the map. */
  viewportRef?:          React.RefObject<HTMLDivElement | null>
}

export function HubTownCanvas({
  onAreaEnter, onNodeInteract, onAvatarMove, onAvatarStep,
  returnRef, unitCards, commander, onNpcTap, onAnimalTap, onAnimalSeen, onAmbientAnimalTap,
  interiorEnterRef, interiorExitRef, petActionRef, onEnterInterior, onExitInterior, onTileTap,
  pickedUpIds, onItemPickup, doorKeys, onDoorLocked, questNpcState, activeQuestIdsRef,
  completedQuestIdsRef, collectedTreasureIds, onTreasureStep,
  gameHour, isNight, npcProximityDialogue,
  onInteractableTap, interactableIndicatorsRef, interactableMovesRef, moveInteractableRef, markInteractableSoldRef,
  showFriendshipReactionRef,
  buildingUpgradeLevelsRef,
  locationData,
  questData,
  viewportRef
}: Props) {
  const {
    MAP_W, MAP_H, AVATAR_START,
    HUB_AREAS, HUB_BUILDINGS,
    HUB_STREET_GROUPS,
    HUB_STREET_TILES,
    EXTERIOR_DECOR, HUB_WINDOWS, HUB_POND_TILES, HUB_BRIDGE_TILES,
    HUB_FESTIVAL_DECOR,
    HUB_DOORS, HUB_INTERIORS, EXTERIOR_NPCS, INTERIOR_NPCS,
    NPC_SPAWN_TILES, AMBIENT_NPC_SPRITES,
   HUB_LOCKED_DOORS, HUB_TREASURES, HUB_INTERACTABLES, HUB_ANIMALS, HUB_CHICKEN_ZONES,
    EXIT_TILES: exitTilesData,
    HUB_TOWN_NAME: locationKey,
  } = locationData
  const {HUB_QUEST_DEFS,FRIENDSHIP_DIALOGUE,HUB_PICKUP_ITEMS,HUB_BLOCKED_PATHS} = questData
  const HUB_ENV = locationData?.ENVIRONMENT || 'camp'
  const HUB_WEATHER = locationData?.WEATHER
  const COURTYARD_PX = { x: AVATAR_START.tx * T + T / 2, y: AVATAR_START.ty * T + T }
  const containerRef      = useRef<HTMLDivElement>(null)
  const onAreaRef         = useRef(onAreaEnter)
  onAreaRef.current       = onAreaEnter
  const onNodeInteractRef = useRef(onNodeInteract)
  onNodeInteractRef.current = onNodeInteract
  const onAvatarMoveRef   = useRef(onAvatarMove)
  onAvatarMoveRef.current = onAvatarMove
  const onAvatarStepRef   = useRef(onAvatarStep)
  onAvatarStepRef.current = onAvatarStep
  const onNpcTapRef       = useRef(onNpcTap)
  onNpcTapRef.current     = onNpcTap
  const onAnimalTapRef    = useRef(onAnimalTap)
  onAnimalTapRef.current  = onAnimalTap
  const onAnimalSeenRef   = useRef(onAnimalSeen)
  onAnimalSeenRef.current = onAnimalSeen
  const onAmbientAnimalTapRef   = useRef(onAmbientAnimalTap)
  onAmbientAnimalTapRef.current = onAmbientAnimalTap
  const unitCardsRef      = useRef(unitCards)
  unitCardsRef.current    = unitCards
  const onEnterInteriorRef  = useRef(onEnterInterior)
  onEnterInteriorRef.current = onEnterInterior
  const onExitInteriorRef   = useRef(onExitInterior)
  onExitInteriorRef.current = onExitInterior
  const onTileTapRef        = useRef(onTileTap)
  onTileTapRef.current      = onTileTap
  const onItemPickupRef     = useRef(onItemPickup)
  onItemPickupRef.current   = onItemPickup
  const onDoorLockedRef     = useRef(onDoorLocked)
  onDoorLockedRef.current   = onDoorLocked
  const doorKeysRef         = useRef(doorKeys)
  doorKeysRef.current       = doorKeys
  // Tracks picked-up IDs imperatively within PixiJS context
  const pickedUpRef           = useRef<Set<string>>(pickedUpIds ?? new Set())
  const collectedTreasureRef  = useRef<Set<string>>(new Set(collectedTreasureIds))
  const onTreasureStepRef     = useRef(onTreasureStep)
  onTreasureStepRef.current   = onTreasureStep
  const onInteractableTapRef     = useRef(onInteractableTap)
  onInteractableTapRef.current   = onInteractableTap
  const isNightRef            = useRef(isNight ?? false)
  isNightRef.current          = isNight ?? false
  const gameHourRef           = useRef(gameHour ?? 12)
  gameHourRef.current         = gameHour ?? 12
  // Tracks the last hour that triggered NPC schedule walks — owned by the ticker, not updated per-render
  const lastScheduleHourRef   = useRef(gameHour ?? 12)

  usePixiApp(containerRef, MAP_W, MAP_H, (app) => {
    // The camera follows the avatar; user drags must never pan the viewport,
    // so suppress all browser touch gestures on the canvas. Taps still fire
    // as pointer events.
    app.canvas.style.touchAction = 'none'

    // ── Camera ─────────────────────────────────────────────────────────────────
    // All world content lives in worldRoot so the canvas can stay viewport-sized
    // while the parent scroll container provides the camera position (#1570).
    // Without viewportRef the canvas spans the whole map and the camera is fixed.
    const worldRoot = new PIXI.Container()
    app.stage.addChild(worldRoot)
    const syncCamera = () => {
      const vp = viewportRef?.current
      if (vp) worldRoot.position.set(-vp.scrollLeft, -vp.scrollTop)
    }

    // ── Layer hierarchy ────────────────────────────────────────────────────────
    const groundLayer   = new PIXI.Container()
    const streetLayer   = new PIXI.Container()
    const pondLayer     = new PIXI.Container()
    const aboveAvatarLayer = new PIXI.Container()  // fixed decor always above sprites (e.g. bridges)
    const belowAvatarLayer = new PIXI.Container()  // fixed decor always below sprites (e.g. stairs)
    const pickupLayer   = new PIXI.Container()  // ground-level collectible items
    const spriteLayer   = new PIXI.Container()  // avatar + NPCs + decor, Y-sorted
    const buildingLayer = new PIXI.Container()
    const windowLayer   = new PIXI.Container()
    const nodeLayer     = new PIXI.Container()
    const worldLayer    = new PIXI.Container()
    const interiorLayer = new PIXI.Container()  // top-most; hidden except when in a building
    const bubbleLayer   = new PIXI.Container()  // speech bubbles — above everything
    spriteLayer.sortableChildren = true
    worldLayer.sortableChildren  = true
    interiorLayer.visible = false
    const highlightGfx  = new PIXI.Graphics()
    // Night-dimming overlay — canvas 2D with destination-out pokes transparent holes
    // through a dark rect; PIXI scales the low-res canvas up via bilinear filtering
    const NIGHT_CANVAS_SCALE = 8
    const nightCanvas  = document.createElement('canvas')
    nightCanvas.width  = Math.ceil(MAP_W / NIGHT_CANVAS_SCALE)
    nightCanvas.height = Math.ceil(MAP_H / NIGHT_CANVAS_SCALE)
    const nightCtx     = nightCanvas.getContext('2d')!
    const nightTexture = PIXI.Texture.from(nightCanvas)
    const nightSprite  = new PIXI.Sprite(nightTexture)
    nightSprite.width     = MAP_W
    nightSprite.height    = MAP_H
    nightSprite.visible   = false
    nightSprite.eventMode = 'none'  // overlay must not block pointer events on game objects
    // Keep legacy aliases so existing code below compiles unchanged
    const npcLayer    = spriteLayer
    const avatarLayer = spriteLayer
    const exteriorDecorLayer = spriteLayer
    worldRoot.addChild(groundLayer, streetLayer, pondLayer, buildingLayer, windowLayer, belowAvatarLayer, spriteLayer, pickupLayer, aboveAvatarLayer, nodeLayer, worldLayer, nightSprite, interiorLayer, bubbleLayer, highlightGfx)

    // Keyed by pickupId; used to imperatively show/hide sprites when items are collected
    const pickupSprites  = new Map<string, PIXI.Sprite>()
    // Supplementary visual-only tiles (pickup.extraTiles) — hidden/shown together with the primary sprite above.
    const pickupExtraSprites = new Map<string, PIXI.Sprite[]>()
    const pickupQuestIds = new Map<string, string>()  // pickupId → questId, for ticker gating

    // Night-glow sources flagged on decor / quest items (carved by the night overlay).
    const decorGlows:  GlowSource[] = []                                       // static world positions
    const pickupGlows: { id: string; radius: number; pulse: boolean }[] = []   // looked up live (skip collected)

    // Animated flame overlays flagged on decor (§ flame effect). Collected inline
    // alongside decorGlows in the same two decor-building loops below, then spawned
    // once texture loading settles (see spawnFlame).
    interface FlameSource { parent: PIXI.Container; x: number; y: number; type: FlameType; color: FlameColor; sortY?: number }
    const FLAME_PARAMS: Record<FlameType, { scale: number; glowRadius: number; speed: number }> = {
      flicker: { scale: 0.45, glowRadius: 1,   speed: 0.10 },
      low:     { scale: 0.65, glowRadius: 1.5, speed: 0.12 },
      medium:  { scale: 0.9,  glowRadius: 2.5, speed: 0.14 },
      strong:  { scale: 1.3,  glowRadius: 4,   speed: 0.20 },
    }
    const FLAME_TINTS: Record<FlameColor, number> = {
      normal:       0xff9a3c,
      supernatural: 0xbfffea,
      blue:         0x4fc3ff,
      green:        0x66ff66,
      purple:       0xc060ff,
    }
    // Pushes both the animated flame sprite request — positioned in parentX/parentY,
    // local to `parent` — and (unless the entry already sets its own glow) a matching
    // night-glow entry derived from flameType, positioned in world-space worldX/worldY
    // (glows are always plotted in world coordinates, regardless of which container the
    // flame sprite itself lives in), so "flame: true" lights the surrounding dark by default.
    function collectFlame(target: FlameSource[], glows: GlowSource[], hasExplicitGlow: boolean,
      parent: PIXI.Container, parentX: number, parentY: number, worldX: number, worldY: number,
      type: FlameType | undefined, color: FlameColor | undefined, sortY?: number): void {
      const t = type ?? 'medium'
      target.push({ parent, x: parentX, y: parentY, type: t, color: color ?? 'normal', sortY })
      if (!hasExplicitGlow) glows.push({ x: worldX, y: worldY - T / 2, radius: FLAME_PARAMS[t].glowRadius * T, pulse: true })
    }
    function spawnFlames(sources: FlameSource[]): void {
      if (sources.length === 0) return
      loadAnimFrames('flame', 3).then(frames => {
        if (app.renderer == null) return
        for (const src of sources) {
          const params = FLAME_PARAMS[src.type]
          const anim = new PIXI.AnimatedSprite(frames)
          anim.animationSpeed = params.speed
          anim.play()
          anim.anchor.set(0.5, 1)
          anim.width = anim.height = T * params.scale
          anim.tint = FLAME_TINTS[src.color]
          anim.position.set(src.x, src.y)
          if (src.sortY != null) anim.zIndex = src.sortY * T + T + 1.5
          src.parent.addChild(anim)
        }
      }).catch(() => {})
    }

    const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL

    // ── Terrain ────────────────────────────────────────────────────────────────
    const baseContainer  = new PIXI.Container()
    const riverContainer = new PIXI.Container()
    const decorContainer = new PIXI.Container()
    groundLayer.addChild(baseContainer, riverContainer, decorContainer)

    buildTerrainGfx(baseContainer, riverContainer, worldLayer,
      { environment: HUB_ENV, id: 'hubworld', terrainItems: [] }, MAP_W, MAP_H)
    buildBgTileGfx(baseContainer, { environment: HUB_ENV }, MAP_W, MAP_H)
      .catch(e => rollbar.error('[HubTownCanvas] bg tiles failed', { error: String(e) }))
    buildDecorGfx(decorContainer, { environment: HUB_ENV, id: 'hubworld' }, MAP_W, MAP_H)
      .catch(e => rollbar.error('[HubTownCanvas] decor tiles failed', { error: String(e) }))

    // Cull off-screen chunks of the static tile layers each frame (#1570 Phase
    // B). Dynamic layers (sprites, pickups, bubbles, interior) stay unculled.
    const chunkCuller = createChunkCuller([
      baseContainer, riverContainer, decorContainer,
      streetLayer, pondLayer, buildingLayer, windowLayer,
      belowAvatarLayer, aboveAvatarLayer, nodeLayer,
    ])

    // ── Pond (Greyfish Pond) — water path tiles ───────────────────────────────
    {
      const pondSet = new Set(HUB_POND_TILES.map(([tx, ty]) => `${tx},${ty}`))
      renderPathTiles(pondLayer, pondSet, undefined, PATH_TILE.water1, true)
        .catch(e => rollbar.error('[HubTownCanvas] pond tiles failed', { error: String(e) }))
    }

    // ── Streets ────────────────────────────────────────────────────────────────
    const pathSet = new Set(HUB_STREET_TILES.map(([tx, ty]) => `${tx},${ty}`))

    // Solid exterior decor blocks routing. Exterior uses an explicit
    // zlayer:'solid' tag (untagged decor like flowers is intentionally
    // walkable), unlike interiors where missing zlayer means solid. Removing
    // these tiles from pathSet here fixes every consumer that clones it: player
    // tap routing, named/ambient NPC pathing, and street-walking animals.
    const _solidFestival = getActiveFestival()
    const _solidFestivalDecor = _solidFestival
      ? (HUB_FESTIVAL_DECOR.find(g => g.festivalId === _solidFestival.id)?.decor ?? [])
      : []
    const solidDecorSet = new Set<string>()
    for (const d of [...EXTERIOR_DECOR, ..._solidFestivalDecor])
      if (d.zlayer === 'solid') solidDecorSet.add(`${d.tx},${d.ty}`)
    for (const k of solidDecorSet) pathSet.delete(k)

    // Bridge tiles are walkable regardless of any solid decor on top (e.g. the
    // bridge sprite itself is tagged solid so it blocks ground-level routing).
    // Add them after the solid-decor sweep so they can't be deleted by it.
    for (const [tx, ty] of HUB_BRIDGE_TILES) pathSet.add(`${tx},${ty}`)

    // Currently-visible blocked-path obstructions (quest-gated barrels + guard
    // NPCs). Dynamic: depends on quest completion, so it's refreshed each frame
    // (see refreshBlockedPathSolids) rather than baked into pathSet.
    const blockedPathSolidSet = new Set<string>()

    for (const group of HUB_STREET_GROUPS) {
      const groupSet = new Set(group.tiles.map(([tx, ty]) => `${tx},${ty}`))
      const tileOverride = group.pathType ? PATH_TILE[group.pathType as keyof typeof PATH_TILE] : undefined
      renderPathTiles(streetLayer, groupSet, tileOverride ? undefined : HUB_ENV, tileOverride)
        .catch(e => rollbar.error('[HubTownCanvas] street tiles failed', { error: String(e) }))
    }

    // Building tile set — derived from HUB_BUILDINGS, used for tap routing
    // Tap-routing footprint — union of every level's footprint so a building stays
    // tappable/enterable at any upgrade level (grown footprints are over-included).
    const buildingFootprints = (b: typeof HUB_BUILDINGS[number]): [number, number, number, number][] =>
      [b.rect, ...((b.levelVisuals ?? []).map(v => v.rect).filter(Boolean) as [number, number, number, number][])]
    const buildingSet = new Set<string>()
    for (const b of HUB_BUILDINGS)
      for (const [x1, y1, x2, y2] of buildingFootprints(b))
        for (let tx = x1; tx <= x2; tx++)
          for (let ty = y1; ty <= y2; ty++)
            buildingSet.add(`${tx},${ty}`)

    // ── Buildings ──────────────────────────────────────────────────────────────
    // Each building is drawn as one or more *visual variants* (a base variant plus
    // one per level threshold from `levelVisuals`). Tiles are added directly to
    // buildingLayer (NOT wrapped in a per-building container): buildingLayer is a
    // chunk-culled layer (utils/chunkCull.ts) that captures each child's bounds at
    // adoption and assumes they don't grow afterward — an async-filled container
    // would be adopted while empty and then culled. Multi-variant buildings instead
    // toggle each sprite's `visible` per frame (see the variant toggle in the ticker).
    const buildingVariantSprites: { buildingId: string; minLevel: number; nextLevel: number; sprite: PIXI.Sprite }[] = []
    {
      const fallbackPromises: Promise<void>[] = []

      const renderVariant = (
        rect: [number, number, number, number],
        wall: WallMaterial,
        roof: RoofMaterial,
        doors: { tx: number; ty: number; hideSprite?: boolean }[],
        track: { buildingId: string; minLevel: number; nextLevel: number } | null,
        initiallyVisible: boolean,
      ) => {
        const placements = placeBuildingTiles(rect, wall, roof, doors)
        for (const [tileId, positions] of placements) {
          loadTileRef(tileId).then(tex => {
            if (app.renderer == null) return
            for (const [tx, ty] of positions) {
              const s = new PIXI.Sprite(tex)
              s.position.set(tx * T, ty * T)
              s.width = T; s.height = T
              s.visible = initiallyVisible
              buildingLayer.addChild(s)
              if (track) buildingVariantSprites.push({ ...track, sprite: s })
            }
          }).catch(() => {})
        }
      }

      for (const building of HUB_BUILDINGS) {
        const [x1, y1, x2, y2] = building.rect

        if (!building.wall || !building.roof) {
          const buildingTileSet = new Set<string>()
          for (let tx = x1; tx <= x2; tx++)
            for (let ty = y1; ty <= y2; ty++)
              buildingTileSet.add(`${tx},${ty}`)
          fallbackPromises.push(renderPathTiles(buildingLayer, buildingTileSet, undefined, PATH_TILE.wall2))
          continue
        }

        // Pass every door; placeBuildingTiles matches them to a footprint by
        // position (south edge), mirroring the original renderer — door buildingId
        // does not always equal the building's id, so we must not filter by id.
        const doors = HUB_DOORS.map(d => ({ tx: d.tx, ty: d.ty, hideSprite: d.hideSprite }))

        // Distinct visual thresholds: base (0) plus each levelVisuals minLevel.
        const thresholds = [0, ...((building.levelVisuals ?? []).map(v => v.minLevel))]
          .filter((v, i, a) => a.indexOf(v) === i)
          .sort((a, b) => a - b)
        const multiVariant = thresholds.length > 1
        const currentLevel = building.id ? (buildingUpgradeLevelsRef?.current[building.id] ?? 0) : 0

        thresholds.forEach((minLevel, ti) => {
          const nextLevel = ti + 1 < thresholds.length ? thresholds[ti + 1] : Infinity
          const vis = resolveBuildingVisual(
            { rect: building.rect, wall: building.wall, roof: building.roof },
            building.levelVisuals, minLevel,
          )
          if (!vis.wall || !vis.roof) return
          // Single-variant buildings are always shown; multi-variant ones show only
          // the sprite set whose [minLevel, nextLevel) range holds the current level.
          const visible = !multiVariant || (currentLevel >= minLevel && currentLevel < nextLevel)
          const track = (multiVariant && building.id)
            ? { buildingId: building.id, minLevel, nextLevel }
            : null
          renderVariant(vis.rect, vis.wall, vis.roof, doors, track, visible)
        })
      }

      Promise.all(fallbackPromises).catch(e => rollbar.error('[HubTownCanvas] building tiles failed', { error: String(e) }))
    }

    // ── Door signs ─────────────────────────────────────────────────────────────
    {
      // Map each building to a thematic sign tile from the base chip sheet
      const DOOR_SIGN_TILE: Record<string, number> = {
        'card-shop':         667,  // bookSign
        'augment-shop':      662,  // magicSign
        'supply-shop':       658,  // bagSign
        'scholars-hall':     667,  // bookSign
        'scholars-north-w':  667,  // bookSign
        'scholars-north-e':  667,  // bookSign
        'scholars-hall-w':   667,  // bookSign
        'home':              671,  // blankSign
        'trader-den':        668,  // goldSign
        'inn-building':     664,  // innSign
        'traders-building':  668,  // goldSign
        'market-building':   658,  // bagSign
        'arcade-building-e': 668,  // goldSign
        'arcade-building-w': 660,  // drinkSign
        'barracks-north':    657,  // armourSign
        'barracks-south':    656,  // weaponsSign
      }


      // Group doors by sign tileId so we only load each texture once
      const byTile = new Map<number, { door: typeof HUB_DOORS[0]; name: string }[]>()
      for (const door of HUB_DOORS) {
        const name = HUB_INTERIORS[door.buildingId]?.name
        if (!name) continue
        const tileId = DOOR_SIGN_TILE[door.buildingId] ?? 234  // smallSign fallback
        const list = byTile.get(tileId) ?? []
        list.push({ door, name })
        byTile.set(tileId, list)
      }

      for (const [tileId, entries] of byTile) {
        loadTileRef(tileId).then(tex => {
          if (app.renderer == null) return
          for (const { door, name } of entries) {
            // Sign tile sits at the door arch row (door.ty - 2)
            const signTx = door.tx * T
            const signTy = (door.ty - 3) * T
            const sprite = new PIXI.Sprite(tex)
            if (!door.hideSign){
              sprite.position.set(signTx, signTy)
              sprite.width = T; sprite.height = T
              nodeLayer.addChild(sprite)
            }

            // Small name label floats just above the sign tile
            if (!door.hideLabel) {
              const label = new PIXI.Text({
                text: name,
                style: { fontSize: 12, fill: '#f0e8c8', fontFamily: 'monospace', fontWeight: 'bold' },
              })
              label.anchor.set(0.5, 1)
              label.position.set(door.tx * T + T / 2, signTy - 1)

              const pad = 4
              const lbg = new PIXI.Graphics()
              lbg.roundRect(-label.width / 2 - pad, -label.height - pad, label.width + pad * 2, label.height + pad * 2, 2)
                .fill({ color: 0x1a1a2a, alpha: 0.8 })
              lbg.position.copyFrom(label.position)

              nodeLayer.addChild(lbg, label)
            }
          }
        }).catch(() => {})
      }
    }

    // ── Exterior decor (tile sprites over streets/ground) ─────────────────────
    {
      // Festival decor for the currently-active festival is layered in with the
      // base exterior decor (festival is date-stable for the session).
      const _festival = getActiveFestival()
      const _festivalDecor = _festival
        ? (HUB_FESTIVAL_DECOR.find(g => g.festivalId === _festival.id)?.decor ?? [])
        : []
      const effectiveDecor = [...EXTERIOR_DECOR, ..._festivalDecor]
      const extNormal      = new Map<number, [number, number][]>()
      const extBelowAvatar = new Map<number, [number, number][]>()
      const extAboveAvatar = new Map<number, [number, number][]>()
      const flames: FlameSource[] = []
      for (const d of effectiveDecor) {
        if (d.tileId === 666) continue
        const map  = d.zlayer === 'below' ? extBelowAvatar : d.zlayer === 'above' ? extAboveAvatar : extNormal
        const list = map.get(d.tileId) ?? []
        list.push([d.tx, d.ty])
        map.set(d.tileId, list)
        if (d.glow) decorGlows.push({ x: d.tx * T + T / 2, y: d.ty * T + T / 2, radius: (d.glowRadius ?? 2) * T, pulse: !!d.pulse })
        if (d.flame) {
          const flameParent = d.zlayer === 'below' ? belowAvatarLayer : d.zlayer === 'above' ? aboveAvatarLayer : exteriorDecorLayer
          const fx = d.tx * T + T / 2, fy = d.ty * T + T * 0.85
          collectFlame(flames, decorGlows, !!d.glow, flameParent, fx, fy, fx, fy, d.flameType, d.flameColor, d.ty)
        }
      }
      spawnFlames(flames)
      for (const [tileId, positions] of extNormal) {
        loadTileRef(tileId).then(tex => {
          if (app.renderer == null) return
          for (const [tx, ty] of positions) {
            const s = new PIXI.Sprite(tex)
            s.position.set(tx * T, ty * T)
            s.width = T; s.height = T
            s.zIndex = ty * T + T + 1
            exteriorDecorLayer.addChild(s)
          }
        }).catch(() => {})
      }
      for (const [tileId, positions] of extBelowAvatar) {
        loadTileRef(tileId).then(tex => {
          if (app.renderer == null) return
          for (const [tx, ty] of positions) {
            const s = new PIXI.Sprite(tex)
            s.position.set(tx * T, ty * T)
            s.width = T; s.height = T
            belowAvatarLayer.addChild(s)
          }
        }).catch(() => {})
      }
      for (const [tileId, positions] of extAboveAvatar) {
        loadTileRef(tileId).then(tex => {
          if (app.renderer == null) return
          for (const [tx, ty] of positions) {
            const s = new PIXI.Sprite(tex)
            s.position.set(tx * T, ty * T)
            s.width = T; s.height = T
            aboveAvatarLayer.addChild(s)
          }
        }).catch(() => {})
      }
    }

    // ── Interactables (tap-reactive decor / scenery) ───────────────────────────
    // Each interactable is a tappable container that either renders its own
    // decor tiles (movable as a unit) or is an invisible hit area over static
    // decor. Containers live in spriteLayer / interiorLayer — never in chunk-
    // culled layers, whose children must not move after adoption.
    interface InteractableEntry {
      def:            HubInteractable
      root:           PIXI.Container
      above:          PIXI.Container | null   // paired container for 'above' zlayer tiles
      indicator:      PIXI.Text | null
      indicatorBaseY: number
      soldBadge:      PIXI.Text | null
      aura:           PIXI.Graphics | null   // faint affordance halo, see INTERACTABLE_AURA_* config
    }
    const exteriorInteractables = new Map<string, InteractableEntry>()
    const interiorInteractables = new Map<string, InteractableEntry>()

    // Live "Sold" badge — mutates an already-built interactable in place so a
    // purchase shows immediately without requiring the player to leave and
    // re-enter the interior (buildInteractable only reruns on re-entry).
    function addSoldBadge(entry: InteractableEntry): void {
      if (entry.soldBadge) return
      const badge = new PIXI.Text({
        text: 'SOLD',
        style: { fontSize: 9, fill: '#ff6666', fontWeight: 'bold', fontFamily: 'monospace', stroke: { color: '#1a1a1a', width: 2 } },
      })
      badge.anchor.set(0.5, 0.5)
      badge.position.set((entry.def.hitRect.w * T) / 2, (entry.def.hitRect.h * T) / 2)
      entry.root.addChild(badge)
      entry.soldBadge = badge
    }

    function interactableZIndex(def: HubInteractable, ty: number): number {
      // y-sort on the bottom tile row, like decor — but +1.5 (not +1) so ties against
      // same-row solid/default decor (zIndex ty*T+T+1) resolve deterministically in the
      // interactable's favor instead of depending on async texture-load insertion order
      // (e.g. the tackle-stall bucket/rod/bait sitting on the market-stall counter).
      return (ty + def.hitRect.h - 1) * T + T + 1.5
    }

    function interactableIndicatorPos(def: HubInteractable, tx: number, ty: number): { x: number; y: number } {
      const ind = def.indicator!
      return { x: tx * T + (def.hitRect.w * T) / 2 + ind.dx * T, y: ty * T - 6 + ind.dy * T }
    }

    function interactableWantsAura(def: HubInteractable): boolean {
      return def.reactions.some(r =>
        r.type === 'dig' ? r.weatherOnly != null : AURA_REACTION_TYPES.has(r.type)
      )
    }

    function buildInteractableAura(footprintW: number, footprintH: number, color: number): PIXI.Graphics {
      const cx = (footprintW * T) / 2
      const cy = (footprintH * T) / 2
      const baseR = (Math.max(footprintW, footprintH) * T) / 2 + INTERACTABLE_AURA_RADIUS_PAD
      const aura = new PIXI.Graphics()
      // Three concentric soft fills (decreasing radius, mildly increasing alpha toward the
      // center) fake a gentle bloom with no distinct edge — deliberately no stroke/outline,
      // which read as UI chrome rather than ambient light.
      aura.circle(cx, cy, baseR).fill({ color, alpha: INTERACTABLE_AURA_OUTER_ALPHA })
      aura.circle(cx, cy, baseR * 0.7).fill({ color, alpha: INTERACTABLE_AURA_MID_ALPHA })
      aura.circle(cx, cy, baseR * 0.4).fill({ color, alpha: INTERACTABLE_AURA_INNER_ALPHA })
      aura.eventMode = 'none'   // purely decorative — never steals taps from the real hit area
      return aura
    }

    function buildInteractable(
      def: HubInteractable,
      target: PIXI.Container,
      aboveTarget: PIXI.Container,
      indicatorTarget: PIXI.Container,
      registry: Map<string, InteractableEntry>,
      stillCurrent: () => boolean,
    ): void {
      // One-shot pickups/secrets authored with hideOnceGranted disappear entirely
      // once their giveItem reaction has been granted — same idea as collected
      // HubTreasure entries, so re-tapping isn't a dead end that looks unfinished.
      if (def.hideOnceGranted && isInteractableGranted(interactableStoreKey(locationKey, def.id))) return

      const pos = interactableMovesRef?.current.get(def.id) ?? { tx: def.tx, ty: def.ty }
      const decor = (def.decor ?? []).filter(d => d.tileId !== 666)

      // Aura is a standalone sibling of root (not its child) added to target *before* root,
      // so it paints behind root/static decor via plain insertion order — needed because
      // interiorLayer (unlike spriteLayer) isn't sortableChildren, so zIndex alone wouldn't
      // order it there. eventMode 'none' (set in buildInteractableAura) keeps it out of
      // hit-testing entirely, so it can never itself intercept a tap.
      let aura: PIXI.Graphics | null = null
      if (INTERACTABLE_AURA_ENABLED && interactableWantsAura(def)) {
        const auraColor = def.building ? INTERACTABLE_AURA_COLOR_INTERIOR : INTERACTABLE_AURA_COLOR_EXTERIOR
        aura = buildInteractableAura(def.hitRect.w, def.hitRect.h, auraColor)
        aura.position.set(pos.tx * T, pos.ty * T)
        aura.zIndex = interactableZIndex(def, pos.ty) - 2   // behind root and same-row static decor when zIndex-sorted
        target.addChild(aura)
      }

      const root = new PIXI.Container()
      root.position.set(pos.tx * T, pos.ty * T)
      // Tap hit-testing depends on this zIndex on layers that are sortableChildren (spriteLayer
      // is; interiorLayer isn't) — always use the tie-winning value, never lower it for aura-only
      // objects, or overlapping objects can start winning taps instead.
      root.zIndex = interactableZIndex(def, pos.ty)
      root.eventMode = 'static'
      root.cursor    = 'pointer'
      root.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation()
        onInteractableTapRef.current?.(def.id)
      })
      target.addChild(root)

      let above: PIXI.Container | null = null
      if (decor.length > 0) {
        if (decor.some(d => d.zlayer === 'above')) {
          above = new PIXI.Container()
          above.position.set(pos.tx * T, pos.ty * T)
          above.zIndex = MAP_H * 2 + pos.ty * T  // above all y-sorted sprites
          aboveTarget.addChild(above)
        }
        const flames: FlameSource[] = []
        for (const d of decor) {
          const parent = d.zlayer === 'above' ? above! : root
          if (d.glow) decorGlows.push({ x: (pos.tx + d.dx) * T + T / 2, y: (pos.ty + d.dy) * T + T / 2, radius: (d.glowRadius ?? 2) * T, pulse: !!d.pulse })
          if (d.flame) {
            collectFlame(flames, decorGlows, !!d.glow, parent,
              d.dx * T + T / 2, d.dy * T + T * 0.85,
              (pos.tx + d.dx) * T + T / 2, (pos.ty + d.dy) * T + T * 0.85,
              d.flameType, d.flameColor, pos.ty + d.dy)
          }
          if (d.spriteId) {
            loadTextureUrl(`${base}sprites/${d.spriteId}.svg`).then(tex => {
              if (app.renderer == null || !stillCurrent()) return
              const s = new PIXI.Sprite(tex)
              s.position.set(d.dx * T, d.dy * T)
              s.width = T; s.height = T
              parent.addChild(s)
            }).catch(() => {})
            continue
          }
          if (d.shopArtSlot != null && def.building) {
            const items = getTodaysShopItems(def.building)
            const item  = items[d.shopArtSlot]

            // White card/tile backing, drawn regardless of whether art loads —
            // shared visual base for all 3 stock kinds.
            const cardW = T - 6, cardH = T - 2
            const bg = new PIXI.Graphics()
            bg.roundRect(d.dx * T + 3, d.dy * T + 1, cardW, cardH, 2).fill({ color: 0xffffff })
            bg.roundRect(d.dx * T + 3, d.dy * T + 1, cardW, cardH, 2).stroke({ color: 0xbbbbbb, width: 1 })
            parent.addChild(bg)

            if (item) {
              const loadArt = (spriteName: string) =>
                loadTextureUrl(`${base}sprites/${spriteName}.svg`).then(tex => {
                  if (app.renderer == null || !stillCurrent()) return
                  const s = new PIXI.Sprite(tex)
                  const artSize = cardW * 0.8
                  s.width = artSize; s.height = artSize
                  s.anchor.set(0.5, 1)
                  s.position.set(d.dx * T + T / 2, d.dy * T + cardH - 2)
                  parent.addChild(s)
                }).catch(() => {})

              switch (item.grant.kind) {
                case 'card':
                  loadArt(spriteSlug(item.grant.cardName))
                  break
                case 'augment': {
                  const augSlot = getAugmentCard(item.grant.augmentName)?.augmentSlot
                  loadArt((augSlot && AUGMENT_SPRITE[augSlot]) ?? 'augment-amulet')
                  break
                }
                case 'consumable': {
                  const consumableId = item.grant.id
                  const consumable = ALL_CONSUMABLES.find(c => c.id === consumableId)
                  const badge = new PIXI.Text({
                    text: consumable?.icon ?? '❔',
                    style: { fontSize: Math.round(cardH * 0.6), fontFamily: 'monospace' },
                  })
                  badge.anchor.set(0.5, 0.5)
                  badge.position.set(d.dx * T + T / 2, d.dy * T + cardH / 2 + 1)
                  parent.addChild(badge)
                  break
                }
                case 'accessory':
                  loadArt(`pet-accessory-${item.grant.id}`)
                  break
              }
            }
            continue
          }
          loadTileRef(d.tileId!).then(tex => {
            if (app.renderer == null || !stillCurrent()) return
            const s = new PIXI.Sprite(tex)
            s.position.set(d.dx * T, d.dy * T)
            s.width = T; s.height = T
            parent.addChild(s)
          }).catch(() => {})
        }
        spawnFlames(flames)
      } else {
        // Pure hit area over independently-rendered decor
        root.hitArea = new PIXI.Rectangle(0, 0, def.hitRect.w * T, def.hitRect.h * T)
      }

      let indicator: PIXI.Text | null = null
      let indicatorBaseY = 0
      if (def.indicator) {
        const { x, y } = interactableIndicatorPos(def, pos.tx, pos.ty)
        indicator = new PIXI.Text({ text: '!', style: { fontSize: 16, fill: '#ffdd44', fontWeight: 'bold', fontFamily: 'monospace', stroke: { color: '#1a1a1a', width: 3 } } })
        indicator.anchor.set(0.5, 1)
        indicator.position.set(x, y)
        indicator.visible = false
        indicatorTarget.addChild(indicator)
        indicatorBaseY = y
      }

      const entry: InteractableEntry = { def, root, above, indicator, indicatorBaseY, soldBadge: null, aura }
      registry.set(def.id, entry)

      // Seed the "Sold" badge on cold build (e.g. entering the shop after a
      // purchase made via the NPC dialogue, or in an earlier visit).
      const buyReaction = def.reactions.find(r => r.type === 'buy') as { type: 'buy'; slotIndex: number } | undefined
      if (buyReaction && def.building) {
        const items = getTodaysShopItems(def.building)
        const item  = items[buyReaction.slotIndex]
        if (item && item.grant.kind !== 'consumable' && isShopItemSold(loadDailyShopState(), def.building, item.grant)) {
          addSoldBadge(entry)
        }
      }
    }

    for (const def of HUB_INTERACTABLES.filter(i => !i.building)) {
      buildInteractable(def, spriteLayer, spriteLayer, bubbleLayer, exteriorInteractables, () => true)
    }

    // Live repositioning (move reactions) — registered into moveInteractableRef below
    const doMoveInteractable = (id: string, tx: number, ty: number): void => {
      try {
        const entry = interiorInteractables.get(id) ?? exteriorInteractables.get(id)
        if (!entry) return
        const { def, root } = entry
        const isInteriorEntry = interiorInteractables.has(id)
        // Re-carve interior walkability: free the old footprint, block the new
        if (isInteriorEntry) {
          const oldTx = Math.round(root.x / T)
          const oldTy = Math.round(root.y / T)
          for (const d of def.decor ?? []) {
            if (!d.zlayer || d.zlayer === 'solid') interiorWalkable.add(`${oldTx + d.dx},${oldTy + d.dy}`)
          }
          for (const d of def.decor ?? []) {
            if (!d.zlayer || d.zlayer === 'solid') interiorWalkable.delete(`${tx + d.dx},${ty + d.dy}`)
          }
        }
        root.position.set(tx * T, ty * T)
        root.zIndex = interactableZIndex(def, ty)
        if (entry.above) {
          entry.above.position.set(tx * T, ty * T)
          if (!isInteriorEntry) entry.above.zIndex = MAP_H * 2 + ty * T
        }
        if (entry.indicator && def.indicator) {
          const { x, y } = interactableIndicatorPos(def, tx, ty)
          entry.indicator.position.x = x
          entry.indicatorBaseY = y
        }
      } catch (e) {
        rollbar.error('[HubTownCanvas] moveInteractable failed', { id, error: String(e) })
      }
    }
    if (moveInteractableRef) moveInteractableRef.current = doMoveInteractable

    // Live "Sold" badge — see addSoldBadge above; registered into markInteractableSoldRef.
    const doMarkInteractableSold = (id: string): void => {
      try {
        const entry = interiorInteractables.get(id) ?? exteriorInteractables.get(id)
        if (!entry) return
        addSoldBadge(entry)
      } catch (e) {
        rollbar.error('[HubTownCanvas] markInteractableSold failed', { id, error: String(e) })
      }
    }
    if (markInteractableSoldRef) markInteractableSoldRef.current = doMarkInteractableSold

    // ── Blocked paths (quest-gated obstructions) ──────────────────────────────
    interface BlockedNpcEntry {
      root: PIXI.Container
      tx: number
      ty: number
      proximityDialogue: { atDistance: number; text: string }[]
      bubble: PIXI.Container | null
      lastBubbleText: string | null
    }
    interface BlockedPathEntry {
      questId?: string
      unlockedByInteractable?: string
      blockedDecor: PIXI.Sprite[]
      clearedDecor: PIXI.Sprite[]
      blockedNpcs: BlockedNpcEntry[]
      clearedNpcs: { root: PIXI.Container }[]
    }
    // A blocked path clears either when its quest completes, or (for hidden
    // areas revealed by finding a secret) when the paired interactable's
    // one-time reward has been granted — see interactables.ts.
    function isBlockedPathCleared(bp: { questId?: string; unlockedByInteractable?: string }): boolean {
      if (bp.unlockedByInteractable) return isInteractableGranted(interactableStoreKey(locationKey, bp.unlockedByInteractable))
      return bp.questId ? (completedQuestIdsRef?.current.has(bp.questId) ?? false) : false
    }
    const blockedPathEntries = new Map<string, BlockedPathEntry>()
    {
      for (const bp of HUB_BLOCKED_PATHS) {
        const isCleared = isBlockedPathCleared(bp)
        const entry: BlockedPathEntry = { questId: bp.questId, unlockedByInteractable: bp.unlockedByInteractable, blockedDecor: [], clearedDecor: [], blockedNpcs: [], clearedNpcs: [] }

        for (const d of bp.blocked.decor ?? []) {
          if (d.tileId === 666) continue
          loadTileRef(d.tileId).then(tex => {
            if (app.renderer == null) return
            const s = new PIXI.Sprite(tex)
            s.position.set(d.tx * T, d.ty * T)
            s.width = T; s.height = T
            s.visible = !isCleared
            belowAvatarLayer.addChild(s)
            entry.blockedDecor.push(s)
          }).catch(() => {})
        }

        for (const d of bp.cleared.decor ?? []) {
          if (d.tileId === 666) continue
          loadTileRef(d.tileId).then(tex => {
            if (app.renderer == null) return
            const s = new PIXI.Sprite(tex)
            s.position.set(d.tx * T, d.ty * T)
            s.width = T; s.height = T
            s.visible = isCleared
            belowAvatarLayer.addChild(s)
            entry.clearedDecor.push(s)
          }).catch(() => {})
        }

        for (const npc of bp.blocked.npcs ?? []) {
          const cx = npc.tx * T + T / 2
          const cy = npc.ty * T + T
          const npcContainer = new PIXI.Container()
          npcContainer.zIndex = cy
          npcContainer.visible = !isCleared
          npcContainer.eventMode = 'static'
          npcContainer.cursor = 'pointer'
          npcContainer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
            e.stopPropagation()
            if (npc.tapDialogue) onNpcTapRef.current?.(npc.tapDialogue, npc.id)
          })
          loadTextureUrl(`${base}sprites/${resolveNpcSprite(npc.sprite)}.svg`).then(tex => {
            if (app.renderer == null) return
            const s = new PIXI.Sprite(tex)
            s.width = SPRITE_SIZE; s.height = SPRITE_SIZE
            s.anchor.set(0.5, 1)
            s.position.set(cx, cy)
            npcContainer.addChild(s)
          }).catch(() => {})
          npcLayer.addChild(npcContainer)
          entry.blockedNpcs.push({ root: npcContainer, tx: npc.tx, ty: npc.ty, proximityDialogue: (npc.proximityDialogue ?? []).slice().sort((a, b) => a.atDistance - b.atDistance), bubble: null, lastBubbleText: null })
        }

        for (const npc of bp.cleared.npcs ?? []) {
          const cx = npc.tx * T + T / 2
          const cy = npc.ty * T + T
          const npcContainer = new PIXI.Container()
          npcContainer.zIndex = cy
          npcContainer.visible = isCleared
          npcContainer.eventMode = 'static'
          npcContainer.cursor = 'pointer'
          npcContainer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
            e.stopPropagation()
            if (npc.tapDialogue) onNpcTapRef.current?.(npc.tapDialogue, npc.id)
          })
          loadTextureUrl(`${base}sprites/${resolveNpcSprite(npc.sprite)}.svg`).then(tex => {
            if (app.renderer == null) return
            const s = new PIXI.Sprite(tex)
            s.width = SPRITE_SIZE; s.height = SPRITE_SIZE
            s.anchor.set(0.5, 1)
            s.position.set(cx, cy)
            npcContainer.addChild(s)
          }).catch(() => {})
          npcLayer.addChild(npcContainer)
          entry.clearedNpcs.push({ root: npcContainer })
        }

        blockedPathEntries.set(bp.id, entry)
      }
    }

    // Rebuild blockedPathSolidSet from live quest/secret state: the visible
    // side's decor + guard-NPC tiles (blocked while incomplete, cleared once done).
    function refreshBlockedPathSolids() {
      blockedPathSolidSet.clear()
      for (const bp of HUB_BLOCKED_PATHS) {
        const cleared = isBlockedPathCleared(bp)
        const state = cleared ? bp.cleared : bp.blocked
        for (const d of state.decor ?? []) blockedPathSolidSet.add(`${d.tx},${d.ty}`)
        for (const n of state.npcs ?? []) blockedPathSolidSet.add(`${n.tx},${n.ty}`)
      }
    }
    refreshBlockedPathSolids()  // valid before the first frame / first route

    // Streets minus quest-gated corridors and the visible blocked-path
    // obstructions — the single source of truth for every exterior router
    // (player tap, named/ambient NPCs, street-walking animals).
    function exteriorWalkable(): Set<string> {
      const s = new Set(pathSet)
      // Solid levelDecor items block paths only when the building has reached
      // their minLevel — they're walkable before the building is upgraded.
      const upgradeLevels = buildingUpgradeLevelsRef?.current ?? {}
      for (const b of HUB_BUILDINGS) {
        if (!b.id || !b.levelDecor?.length) continue
        const buildingLevel = upgradeLevels[b.id] ?? 0
        for (const d of b.levelDecor) {
          if (d.zlayer === 'solid' && isVisibleAtLevel(d, buildingLevel))
            s.delete(`${d.tx},${d.ty}`)
        }
      }
      for (const bp of HUB_BLOCKED_PATHS)
        if (!isBlockedPathCleared(bp))
          for (const [btx, bty] of bp.blockedTiles) s.delete(`${btx},${bty}`)
      for (const k of blockedPathSolidSet) s.delete(k)
      return s
    }

    // ── Building upgrade decor (revealed/retired as the player upgrades buildings) ─
    // Per-building level decor is authored in the map editor at absolute tile
    // positions. Each item carries a minLevel (and optional hideAtLevel) so it can
    // appear — and later be replaced — as the building is upgraded. Sprites are
    // created once and toggled each frame against buildingUpgradeLevelsRef.
    const upgradeDecorSprites: { buildingId: string; minLevel?: number; hideAtLevel?: number; sprite: PIXI.Sprite }[] = []
    {
      for (const b of HUB_BUILDINGS) {
        if (!b.id || !b.levelDecor?.length) continue
        const buildingLevel = buildingUpgradeLevelsRef?.current[b.id] ?? 0
        for (const d of b.levelDecor) {
          const layer = d.zlayer === 'above' ? aboveAvatarLayer : belowAvatarLayer
          loadTileRef(d.tileId).then(tex => {
            if (app.renderer == null) return
            const s = new PIXI.Sprite(tex)
            s.position.set(d.tx * T, d.ty * T)
            s.width = T; s.height = T
            s.visible = isVisibleAtLevel(d, buildingLevel)
            layer.addChild(s)
            upgradeDecorSprites.push({ buildingId: b.id as string, minLevel: d.minLevel, hideAtLevel: d.hideAtLevel, sprite: s })
          }).catch(() => {})
        }
      }
    }

    // ── Treasure chests (step-on collectibles, no quest required) ─────────────
    const treasureSprites     = new Map<string, PIXI.Sprite>()          // id → sprite
    const treasureCollectedTex = new Map<string, PIXI.Texture | null>() // id → collected texture (null = hide)
    const treasureByTile      = new Map<string, string>()               // "tx,ty" → id
    {
      for (const t of HUB_TREASURES.filter(tr => !tr.buildingId)) {
        if (collectedTreasureRef.current.has(t.id)) {
          // Already collected — show the collected tile or nothing
          if (t.collectedTileId) {
            loadTileRef(t.collectedTileId).then(tex => {
              if (app.renderer == null) return
              const s = new PIXI.Sprite(tex)
              s.position.set(t.tx * T, t.ty * T)
              s.width = T; s.height = T
              belowAvatarLayer.addChild(s)
            }).catch(() => {})
          }
          continue
        }
        treasureByTile.set(`${t.tx},${t.ty}`, t.id)
        // Pre-load both textures; store collected texture (or null = hide)
        const collectedTexPromise = t.collectedTileId
          ? loadTileRef(t.collectedTileId).catch(() => null)
          : Promise.resolve(null)
        loadTileRef(t.tileId).then(async tex => {
          if (app.renderer == null) return
          const collectedTex = await collectedTexPromise
          const s = new PIXI.Sprite(tex)
          s.position.set(t.tx * T, t.ty * T)
          s.width = T; s.height = T
          belowAvatarLayer.addChild(s)
          treasureSprites.set(t.id, s)
          treasureCollectedTex.set(t.id, collectedTex)
        }).catch(() => {})
      }
    }

    // ── Exterior pickup items ──────────────────────────────────────────────────
    {
      const exteriorPickups = HUB_PICKUP_ITEMS.filter(p => !p.building)
      const byTile = new Map<number, typeof exteriorPickups>()
      for (const p of exteriorPickups) {
        if (p.tileId === 666) continue
        const list = byTile.get(p.tileId) ?? []
        list.push(p)
        byTile.set(p.tileId, list)
      }
      for (const [tileId, pickups] of byTile) {
        loadTileRef(tileId).then(tex => {
          if (app.renderer == null) return
          for (const pickup of pickups) {
            // Skip already-collected items; also skip chain items whose prerequisite isn't done
            if (pickedUpRef.current.has(pickup.id)) continue
            if (pickup.chain && !pickedUpRef.current.has(pickup.chain)) continue
            const initiallyVisible = !pickup.questId || (activeQuestIdsRef?.current.has(pickup.questId) ?? true)
            const s = new PIXI.Sprite(tex)
            s.position.set(pickup.tx * T, pickup.ty * T)
            s.width = T; s.height = T
            s.visible = initiallyVisible
            if (pickup.questId) pickupQuestIds.set(pickup.id, pickup.questId)
            if (!pickup.requireTouch) {
              s.eventMode = 'static'
              s.cursor    = 'pointer'
              s.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
                e.stopPropagation()
                s.visible = false
                for (const extra of pickupExtraSprites.get(pickup.id) ?? []) extra.visible = false
                pickedUpRef.current.add(pickup.id)
                // Reveal any chained item now that this one is collected
                for (const [pid, sprite] of pickupSprites) {
                  const def = HUB_PICKUP_ITEMS.find(p => p.id === pid)
                  if (def?.chain === pickup.id) {
                    sprite.visible = true
                    for (const extra of pickupExtraSprites.get(pid) ?? []) extra.visible = true
                  }
                }
                onItemPickupRef.current?.(pickup.id, pickup.questId)
              })
            }
            pickupLayer.addChild(s)
            pickupSprites.set(pickup.id, s)
            if (pickup.glow) pickupGlows.push({ id: pickup.id, radius: (pickup.glowRadius ?? 2) * T, pulse: !!pickup.pulse })
            for (const extra of pickup.extraTiles ?? []) {
              loadTileRef(extra.tileId).then(extraTex => {
                if (app.renderer == null) return
                const es = new PIXI.Sprite(extraTex)
                es.position.set((pickup.tx + extra.dx) * T, (pickup.ty + extra.dy) * T)
                es.width = T; es.height = T
                es.visible = initiallyVisible && !pickedUpRef.current.has(pickup.id)
                pickupLayer.addChild(es)
                const list = pickupExtraSprites.get(pickup.id) ?? []
                list.push(es)
                pickupExtraSprites.set(pickup.id, list)
              }).catch(() => {})
            }
          }
        }).catch(() => {})
      }
    }

    // ── Windows (transparent tile overlays on building walls) ─────────────────
    {
      const byTile = new Map<number, [number, number][]>()
      for (const w of HUB_WINDOWS) {
        const list = byTile.get(w.tileId) ?? []
        list.push([w.tx, w.ty + 1])
        byTile.set(w.tileId, list)
      }
      for (const [tileId, positions] of byTile) {
        loadTileRef(tileId).then(tex => {
          if (app.renderer == null) return
          for (const [tx, ty] of positions) {
            const s = new PIXI.Sprite(tex)
            s.position.set(tx * T, ty * T)
            s.width = T; s.height = T
            windowLayer.addChild(s)
          }
        }).catch(() => {})
      }
    }

    // ── Avatar ─────────────────────────────────────────────────────────────────
    let avatar: PIXI.Sprite | null = null
    let avatarFrames: PIXI.Texture[] = []
    let avatarBaseTexture: PIXI.Texture | null = null
    let avatarAnimTimer = 0
    let avatarAnimFrame = 0
    let avatarInInterior = false
    const avatarSlug = loadPlayerAvatar()
    Promise.all([
      loadTextureUrl(`${base}sprites/${avatarSlug}.svg`),
      loadAnimFrames(avatarSlug, 3).catch(() => [] as PIXI.Texture[]),
    ]).then(([baseTex, frames]) => {
      if (app.renderer == null) return
      avatarBaseTexture = baseTex
      avatarFrames = frames
      const s = new PIXI.Sprite(baseTex)
      s.width = SPRITE_SIZE; s.height = SPRITE_SIZE
      s.anchor.set(0.5, 1)
      if (interiorActive) {
        s.position.set(interiorCurrentTile[0] * T + T / 2, interiorCurrentTile[1] * T + T)
        interiorLayer.addChild(s)
        avatarInInterior = true
      } else {
        const startTile: [number, number] = _savedTiles.has(locationKey) ? [..._savedTiles.get(locationKey)!] : [AVATAR_START.tx,AVATAR_START.ty]
        currentTile = startTile
        s.position.set(startTile[0] * T + T / 2, startTile[1] * T + T)
        avatarLayer.addChild(s)
      }
      avatar = s
    }).catch(e => rollbar.error('[HubTownCanvas] avatar load failed', { error: String(e) }))

    // ── NPC dialogue index (shared across exterior and interior NPCs) ──────────
    const npcDialogueIndex = new Map<string, number>()

    // ── Exterior NPCs ─────────────────────────────────────────────────────────
    // Quest indicators: keyed by npcId, updated imperatively in the ticker
    const questIndicators     = new Map<string, PIXI.Text>()
    const questIndicatorBaseY = new Map<string, number>()
    // Named NPC containers: keyed by npcId for schedule-driven visibility
    const namedNpcContainers  = new Map<string, PIXI.Container>()
    // Exterior NPCs gated by a building's upgrade level — force-hidden until the
    // building reaches minLevel (and again past hideAtLevel). Toggled in the ticker.
    const levelGatedNpcs: { buildingId: string; minLevel?: number; hideAtLevel?: number; container: PIXI.Container }[] = []
    // Walk state for named NPCs — tracks current tile and in-progress walk queue
    interface NamedNpcWalkState {
      currentTx: number
      currentTy: number
      walkQueue: [number, number][]
      isWalking: boolean
      isInside: boolean
      currentBuildingId: string | null
      animFrame: number
      animTimer: number
    }
    const namedNpcWalkStates = new Map<string, NamedNpcWalkState>()
    // Proximity bubbles for named NPCs driven by npcProximityDialogue ref
    const namedNpcProximityBubbles = new Map<string, { bubble: PIXI.Container | null; lastText: string | null }>()
    // Schedule-driven activities: current activity + pose textures (swap sprite while active)
    const namedNpcActivity       = new Map<string, ReturnType<typeof getNpcActivity>>()
    const namedNpcBaseTex        = new Map<string, PIXI.Texture>()
    const namedNpcPoseTex        = new Map<string, PIXI.Texture>()  // keyed `${npcId}:${activity}`
    const namedNpcAnimFrames     = new Map<string, PIXI.Texture[]>()  // 3-frame walk cycle, if authored
    // Interior quest indicators: rebuilt each time we enter a building
    const interiorQuestIndicators     = new Map<string, PIXI.Text>()
    const interiorIndicatorBaseY      = new Map<string, number>()

    const npcBubbleTargets: { npc: HubNpc; cx: number; cy: number }[] = []
    for (const npc of EXTERIOR_NPCS) {
      // Start NPC at their scheduled position so they appear in the right place on load
      const initLoc = npc.schedule ? getNpcLocation(npc, gameHourRef.current) : null
      const startTx = initLoc?.type === 'exterior' ? initLoc.tx : npc.tx
      const startTy = initLoc?.type === 'exterior' ? initLoc.ty : npc.ty
      const cx = startTx * T + T / 2
      const cy = startTy * T + T
      const walkState: NamedNpcWalkState = {
        currentTx: startTx,
        currentTy: startTy,
        walkQueue: [],
        isWalking: false,
        isInside: initLoc?.type === 'interior',
        currentBuildingId: initLoc?.type === 'interior' ? initLoc.buildingId : null,
        animFrame: 0,
        animTimer: 0,
      }
      namedNpcWalkStates.set(npc.id, walkState)
      if (npc.schedule) namedNpcActivity.set(npc.id, getNpcActivity(npc, gameHourRef.current))
      const isCommanderNpc = npc.id === 'commander-post'

      const npcContainer = new PIXI.Container()
      npcContainer.zIndex = cy
      npcContainer.eventMode = 'static'
      npcContainer.cursor    = 'pointer'
      npcContainer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation()
        if (npc.dialogue.length > 0 || npc.screen || npc.questGive || npc.questReceive || npc.dialogueTree) {
          const idx = npcDialogueIndex.get(npc.id) ?? 0
          const pool = getNpcDialoguePool(npc, gameHourRef.current)
          onNpcTapRef.current?.(pool[idx % pool.length] ?? '', npc.id)
          npcDialogueIndex.set(npc.id, idx + 1)
        }
      })
      npcLayer.addChild(npcContainer)
      namedNpcContainers.set(npc.id, npcContainer)
      if (walkState.isInside) npcContainer.visible = false
      // Gate exterior NPCs that only appear once an associated building is upgraded.
      if (npc.levelBuildingId) {
        const min = npc.minLevel ?? 1
        const gateLevel = buildingUpgradeLevelsRef?.current[npc.levelBuildingId] ?? 0
        if (!isVisibleAtLevel({ minLevel: min, hideAtLevel: npc.hideAtLevel }, gateLevel))
          npcContainer.visible = false
        levelGatedNpcs.push({ buildingId: npc.levelBuildingId, minLevel: min, hideAtLevel: npc.hideAtLevel, container: npcContainer })
      }
      if (npc.dialogue.length > 0) npcBubbleTargets.push({ npc, cx, cy })

      if (npc.questGive || npc.questReceive) {
        const indBaseY = cy - SPRITE_SIZE - 22
        const ind = new PIXI.Text({ text: '!', style: { fontSize: 16, fill: '#ffdd44', fontWeight: 'bold', fontFamily: 'monospace', stroke: { color: '#1a1a1a', width: 3 } } })
        ind.anchor.set(0.5, 1)
        ind.position.set(cx, indBaseY)
        ind.visible = false
        bubbleLayer.addChild(ind)
        questIndicators.set(npc.id, ind)
        questIndicatorBaseY.set(npc.id, indBaseY)
      }

      const npcSpriteSlug = isCommanderNpc ? (commander !== undefined ? commander.cardName : avatarSlug) : resolveNpcSprite(npc.sprite)

      // Commander slug is a card name (e.g. "Jarv Knight") — must go through
      // loadSpriteTexture so spriteSlug() converts it to a valid filename.
      // Hub NPC sprites are already filename slugs so loadTextureUrl is fine.
      const texLoader = isCommanderNpc
        ? loadSpriteTexture(npcSpriteSlug).catch(() => loadTextureUrl(`${base}sprites/hub-avatar.svg`))
        : loadTextureUrl(`${base}sprites/${npcSpriteSlug}.svg`)

      texLoader.then(tex => {
        if (app.renderer == null) return
        const s = new PIXI.Sprite(tex)
        s.width = SPRITE_SIZE; s.height = SPRITE_SIZE
        s.anchor.set(0.5, 1)
        s.position.set(cx, cy)
        npcContainer.addChild(s)

        // Cache base texture + load activity pose sprites (`{sprite}-{activity}.svg`).
        // Missing files fall back to the base sprite — only authored poses need art.
        if (!isCommanderNpc && npc.schedule) {
          namedNpcBaseTex.set(npc.id, tex)
          const activities = new Set(npc.schedule.map(e => e.activity).filter(Boolean) as string[])
          for (const activity of activities) {
            loadTextureUrl(`${base}sprites/${resolveNpcSprite(npc.sprite)}-${activity}.svg`)
              .then(poseTex => { namedNpcPoseTex.set(`${npc.id}:${activity}`, poseTex) })
              .catch(() => { /* no pose art — keep base sprite */ })
          }
        }

        // Load a 3-frame walk cycle (`{sprite}-1/2/3.svg`), if authored — cycled
        // in the ticker below while the NPC is walking. Missing frames just
        // mean no walk animation, same fallback discipline as pose art.
        if (!isCommanderNpc) {
          loadAnimFrames(npcSpriteSlug, 3)
            .then(frames => { namedNpcAnimFrames.set(npc.id, frames) })
            .catch(() => {})
        }

        if (isCommanderNpc) {
          loadAnimFrames(npcSpriteSlug, 3).then(frames => {
            if (!frames.length || app.renderer == null) return
            let cmdAnimTimer = 0
            let cmdAnimFrame = 0
            app.ticker.add((ticker: PIXI.Ticker) => {
              cmdAnimTimer -= ticker.deltaMS
              if (cmdAnimTimer <= 0) {
                cmdAnimTimer = 250
                cmdAnimFrame = (cmdAnimFrame + 1) % frames.length
                s.texture = frames[cmdAnimFrame]
              }
            })
          }).catch(() => {})
        }
      }).catch(e => rollbar.error('[HubTownCanvas] NPC sprite failed', { sprite: npcSpriteSlug, error: String(e) }))
    }

    // ── Friendship reactions (❤️/💔 floated above a named exterior NPC) ────────
    // One-shot: rises + fades over REACTION_MS, tracking the NPC's live sprite
    // position each tick (mirrors the name-tag's `children[0]` read) so it
    // stays put above them even mid-walk-step.
    const REACTION_MS = 1100
    interface ReactionSlot { text: PIXI.Text; npcId: string; elapsed: number }
    const activeReactions: ReactionSlot[] = []

    const doShowFriendshipReaction = (npcId: string, kind: 'up' | 'down'): void => {
      try {
        const npcContainer = namedNpcContainers.get(npcId)
        const sprite = npcContainer?.children[0] as PIXI.Sprite | undefined
        if (!npcContainer || npcContainer.visible === false || !sprite) return
        const text = new PIXI.Text({ text: kind === 'up' ? '❤️' : '💔', style: { fontSize: 20 } })
        text.anchor.set(0.5, 1)
        text.position.set(sprite.x, sprite.y - SPRITE_SIZE - 4)
        bubbleLayer.addChild(text)
        activeReactions.push({ text, npcId, elapsed: 0 })
      } catch (e) {
        rollbar.error('[HubTownCanvas] showFriendshipReaction failed', { npcId, kind, error: String(e) })
      }
    }
    if (showFriendshipReactionRef) showFriendshipReactionRef.current = doShowFriendshipReaction

    // ── NPC name tags (show within 5 tiles of avatar) ─────────────────────────
    // Name tags play a 4s-show / 500ms-fade intro each time the player enters
    // range; speech bubbles for that NPC are suppressed until the intro ends,
    // so the two never render on top of each other.
    interface NpcNameTagState {
      npcId:       string
      tag:         PIXI.Container
      phase:       'hidden' | 'showing' | 'fading'
      timer:       number
      wasInRange:  boolean
      bubbleReady: boolean
    }
    const NAME_TAG_SHOW_MS = 4000
    const NAME_TAG_FADE_MS = 500
    const npcNameTags: NpcNameTagState[] = []
    for (const { npc, cx, cy } of npcBubbleTargets) {
      const tag = createNameTag(npc.name, cx, cy)
      tag.visible = false
      bubbleLayer.addChild(tag)
      npcNameTags.push({ npcId: npc.id, tag, phase: 'hidden', timer: 0, wasInRange: false, bubbleReady: false })
    }
    const npcTagStateById = new Map(npcNameTags.map(s => [s.npcId, s]))
    function isNameTagBlockingBubble(npcId: string): boolean {
      const s = npcTagStateById.get(npcId)
      return !!s && s.wasInRange && !s.bubbleReady
    }

    // ── Card-unit NPCs ─────────────────────────────────────────────────────────
    const SCARED_PHRASES = [
      'Did you see that?!', 'Is someone there…?', 'Something is wrong…',
      'A ghost!! A ghost!!', "Did it just get cold?", 'Please no please no',
      "What was THAT?!", "I can't feel my legs…", 'Run!! RUN!!',
    ]

    interface UnitNpcState {
      sprite:             PIXI.Sprite
      currentTile:        [number, number]
      walkQueue:          [number, number][]
      isWalking:          boolean
      isGhost:            boolean
      wanderTimer:        number
      animFrames:         PIXI.Texture[]
      animTimer:          number
      animFrame:          number
      scaredBubble:       PIXI.Container | null
      scaredBubbleTimer:  number
      scaredBubbleCooldown: number
    }

    const unitNpcs: UnitNpcState[] = []
    const cards = unitCardsRef.current ?? []

    const effectiveCards = cards.length > 0
      ? cards
      : AMBIENT_NPC_SPRITES.length > 0 ? AMBIENT_NPC_SPRITES : ['hub-avatar']
    const spawnCount = Math.min(NPC_SPAWN_TILES.length, Math.max(effectiveCards.length * 3, 4))
    const slots = NPC_SPAWN_TILES.slice(0, spawnCount)

    slots.forEach(([tx, ty], i) => {
      const slug = effectiveCards[i % effectiveCards.length]
      const cx = tx * T + T / 2
      const cy = ty * T + T

      const texPromise = cards.length > 0
        ? loadSpriteTexture(slug).catch(() => loadTextureUrl(`${base}sprites/hub-avatar.svg`))
        : loadTextureUrl(`${base}sprites/${slug}.svg`).catch(() => loadTextureUrl(`${base}sprites/hub-avatar.svg`))

      texPromise.then(tex => {
        if (app.renderer == null) return
        const isGhost = Math.random() < (isNightRef.current ? 0.10 : 0.01)
        const s = new PIXI.Sprite(tex)
        s.width = SPRITE_SIZE; s.height = SPRITE_SIZE
        s.anchor.set(0.5, 1)
        s.position.set(cx, cy)
        s.zIndex = cy
        s.alpha = isGhost ? 0.4 : 1.0
        if (isGhost) s.tint = 0xaaccff
        npcLayer.addChild(s)

        const state: UnitNpcState = {
          sprite:               s,
          currentTile:          [tx, ty],
          walkQueue:            [],
          isWalking:            false,
          wanderTimer:          500 + Math.random() * 500,
          animFrames:           [],
          animTimer:            0,
          animFrame:            0,
          isGhost:              isGhost,
          scaredBubble:         null,
          scaredBubbleTimer:    0,
          scaredBubbleCooldown: 0,
        }
        unitNpcs.push(state)

        loadAnimFrames(slug, 3)
          .then(frames => { state.animFrames = frames })
          .catch(() => {})
      })
    })

    // Door tiles — NPCs that arrive here despawn (simulate entering a building)
    const doorTileSet = new Set(HUB_DOORS.map(d => `${d.tx},${d.ty}`))
    // Spawn tiles that aren't doors — used for respawning so NPCs don't immediately despawn
    const nonDoorSpawnTiles = NPC_SPAWN_TILES.filter(([tx, ty]) => !doorTileSet.has(`${tx},${ty}`))
    const TARGET_NPC_COUNT = 12
    let respawnTimer = 2000

    async function processNpcWalkQueue(npc: UnitNpcState) {
      try {
        if (npc.walkQueue.length === 0) { npc.isWalking = false; return }
        npc.isWalking = true
        const [tx, ty] = npc.walkQueue.shift()!
        const targetX  = tx * T + T / 2
        const targetY  = ty * T + T
        const dist     = Math.hypot(targetX - npc.sprite.x, targetY - npc.sprite.y)
        const duration = (dist / NPC_WALK_PX_PER_S) * 1000
        if (targetX < npc.sprite.x - 1) npc.sprite.scale.x = -Math.abs(npc.sprite.scale.x)
        else if (targetX > npc.sprite.x + 1) npc.sprite.scale.x = Math.abs(npc.sprite.scale.x)
        await tweenLinear(npc.sprite, targetX, targetY, duration)
        npc.currentTile = [tx, ty]
        // Despawn NPCs that reach a building door — they "go inside"
        if (doorTileSet.has(`${tx},${ty}`)) {
          if (npc.scaredBubble) {
            bubbleLayer.removeChild(npc.scaredBubble)
            npc.scaredBubble = null
            npc.scaredBubbleTimer = 0
          }
          npc.sprite.parent?.removeChild(npc.sprite)
          const idx = unitNpcs.indexOf(npc)
          if (idx !== -1) unitNpcs.splice(idx, 1)
          return
        }
        processNpcWalkQueue(npc)
      } catch (e) {
        npc.isWalking = false
        rollbar.error('[HubTownCanvas] processNpcWalkQueue error', { error: String(e) })
      }
    }

    async function processNamedNpcWalkQueue(
      ws: NamedNpcWalkState,
      container: PIXI.Container,
    ) {
      const sprite = container.children[0] as PIXI.Sprite | undefined
      if (!sprite) return
      while (ws.walkQueue.length > 0) {
        const [tx, ty] = ws.walkQueue.shift()!
        const targetX = tx * T + T / 2
        const targetY = ty * T + T
        const dist = Math.hypot(targetX - sprite.x, targetY - sprite.y)
        const duration = (dist / NPC_WALK_PX_PER_S) * 1000
        if (targetX < sprite.x - 1) sprite.scale.x = -Math.abs(sprite.scale.x)
        else if (targetX > sprite.x + 1) sprite.scale.x = Math.abs(sprite.scale.x)
        await tweenLinear(sprite, targetX, targetY, duration)
        ws.currentTx = tx
        ws.currentTy = ty
        container.zIndex = sprite.y
      }
    }

    // Tiles occupied (or imminently targeted) by NPCs other than `self` — their
    // current tile plus their next queued tile. Subtracted from a routing set so
    // NPCs plan paths around one another instead of walking straight through.
    function npcOccupiedTiles(self?: UnitNpcState | NamedNpcWalkState): Set<string> {
      const occ = new Set<string>()
      for (const n of unitNpcs) {
        if (n === self) continue
        occ.add(`${n.currentTile[0]},${n.currentTile[1]}`)
        if (n.walkQueue[0]) occ.add(`${n.walkQueue[0][0]},${n.walkQueue[0][1]}`)
      }
      for (const ws of namedNpcWalkStates.values()) {
        if (ws === self || ws.isInside) continue
        occ.add(`${ws.currentTx},${ws.currentTy}`)
        if (ws.walkQueue[0]) occ.add(`${ws.walkQueue[0][0]},${ws.walkQueue[0][1]}`)
      }
      return occ
    }

    async function walkNamedNpc(
      npc: HubNpc,
      ws: NamedNpcWalkState,
      container: PIXI.Container,
      newLoc: NpcScheduleEntry['location'] | null,
    ) {
      if (ws.isWalking) return
      ws.isWalking = true
      try {
        const sprite = container.children[0] as PIXI.Sprite | undefined
        if (!sprite) return

        const effectiveSet = exteriorWalkable()
        // Route around other NPCs (the destination is re-added below so a
        // transiently-occupied fixed target can't abort an otherwise-valid path).
        for (const k of npcOccupiedTiles(ws)) effectiveSet.delete(k)

        if (!newLoc || newLoc.type === 'exterior') {
          const destTx = newLoc?.tx ?? npc.tx
          const destTy = newLoc?.ty ?? npc.ty

          if (ws.isInside) {
            // Emerge at door of the building they were in
            const door = HUB_DOORS.find(d => d.buildingId === ws.currentBuildingId)
            if (door) {
              sprite.x = door.tx * T + T / 2
              sprite.y = door.ty * T + T
              ws.currentTx = door.tx
              ws.currentTy = door.ty
              container.zIndex = sprite.y
            }
            container.visible = true
            ws.isInside = false
            ws.currentBuildingId = null
          }

          effectiveSet.add(`${destTx},${destTy}`)
          const path = findPath([ws.currentTx, ws.currentTy], [destTx, destTy], effectiveSet)
          ws.walkQueue = path.length > 1 ? path.slice(1) : []
          await processNamedNpcWalkQueue(ws, container)
        } else {
          // Going inside a building — walk to door then hide
          const door = HUB_DOORS.find(d => d.buildingId === newLoc.buildingId)
          if (door) {
            effectiveSet.add(`${door.tx},${door.ty}`)
            const path = findPath([ws.currentTx, ws.currentTy], [door.tx, door.ty], effectiveSet)
            ws.walkQueue = path.length > 1 ? path.slice(1) : []
            await processNamedNpcWalkQueue(ws, container)
          }
          container.visible = false
          ws.isInside = true
          ws.currentBuildingId = newLoc.buildingId
        }
      } finally {
        ws.isWalking = false
      }
    }

    function wanderNpc(npc: UnitNpcState) {
      const effectivePathSet = exteriorWalkable()
      // Route around other NPCs.
      const occupied = npcOccupiedTiles(npc)
      for (const k of occupied) effectivePathSet.delete(k)
      const ghosts = npc.isGhost ? [] : unitNpcs.filter(n => n.isGhost)
      const allOptions = NPC_SPAWN_TILES.filter(
        ([tx, ty]) => tx !== npc.currentTile[0] || ty !== npc.currentTile[1],
      ) as [number, number][]
      if (allOptions.length === 0) return
      // Non-ghost NPCs avoid tiles within 5 tiles of any ghost
      const options = ghosts.length === 0 ? allOptions : (
        allOptions.filter(([tx, ty]) =>
          ghosts.every(g => Math.max(Math.abs(tx - g.currentTile[0]), Math.abs(ty - g.currentTile[1])) > 5)
        ).length > 0
          ? allOptions.filter(([tx, ty]) =>
              ghosts.every(g => Math.max(Math.abs(tx - g.currentTile[0]), Math.abs(ty - g.currentTile[1])) > 5)
            )
          : allOptions
      )
      // Prefer wander targets not currently occupied by another NPC.
      const freeOptions = options.filter(([tx, ty]) => !occupied.has(`${tx},${ty}`))
      const pool = freeOptions.length > 0 ? freeOptions : options
      const target = pool[Math.floor(Math.random() * pool.length)]
      effectivePathSet.add(`${target[0]},${target[1]}`)  // keep the chosen target reachable
      const path   = findPath(npc.currentTile, target, effectivePathSet)
      npc.walkQueue = path.slice(1)
      if (!npc.isWalking) processNpcWalkQueue(npc)
    }

    function spawnAmbientNpc() {
      if (nonDoorSpawnTiles.length === 0) return
      const [tx, ty] = nonDoorSpawnTiles[Math.floor(Math.random() * nonDoorSpawnTiles.length)]
      const cx = tx * T + T / 2
      const cy = ty * T + T
      const slug = effectiveCards[Math.floor(Math.random() * effectiveCards.length)]
      const texPromise = cards.length > 0
        ? loadSpriteTexture(slug).catch(() => loadTextureUrl(`${base}sprites/hub-avatar.svg`))
        : loadTextureUrl(`${base}sprites/${slug}.svg`).catch(() => loadTextureUrl(`${base}sprites/hub-avatar.svg`))
      texPromise.then(tex => {
        if (app.renderer == null) return
        const isGhost = Math.random() < (isNightRef.current ? 0.10 : 0.01)
        const s = new PIXI.Sprite(tex)
        s.width = SPRITE_SIZE; s.height = SPRITE_SIZE
        s.anchor.set(0.5, 1)
        s.position.set(cx, cy)
        s.zIndex = cy
        s.alpha = isGhost ? 0.4 : 1.0
        if (isGhost) s.tint = 0xaaccff
        npcLayer.addChild(s)
        const state: UnitNpcState = {
          sprite:               s,
          currentTile:          [tx, ty],
          walkQueue:            [],
          isWalking:            false,
          wanderTimer:          1000 + Math.random() * 2000,
          animFrames:           [],
          animTimer:            0,
          animFrame:            0,
          isGhost:              isGhost,
          scaredBubble:         null,
          scaredBubbleTimer:    0,
          scaredBubbleCooldown: 0,
        }
        unitNpcs.push(state)
        loadAnimFrames(slug, 3).then(frames => { state.animFrames = frames }).catch(() => {})
      }).catch(() => {})
    }

    // ── Exterior walk state ────────────────────────────────────────────────────
    let currentTile: [number, number] = [AVATAR_START.tx, AVATAR_START.ty]
    let walkQueue:   [number, number][] = []
    let isWalking    = false
    let pendingScreen: string | null = null

    // ── Interior state ─────────────────────────────────────────────────────────
    let interiorActive      = false
    let currentInteriorId: string | null = null
    // The resolved interior for currentInteriorId — may be a synthesized room-slot
    // interior (houseRooms.ts) that doesn't exist in the static HUB_INTERIORS map,
    // so anything needing "the interior currently being stood in" must read this,
    // not re-derive it via HUB_INTERIORS[currentInteriorId].
    let currentInteriorObj: HubInterior | null = null
    let interiorCurrentTile: [number, number] = [0, 0]
    let interiorWalkable    = new Set<string>()
    let interiorWalkQueue:  [number, number][] = []
    let interiorIsWalking   = false
    let interiorExitTile:   [number, number] = [0, 0]
    let exitByTile = new Map<string, HubInteriorExit>()
    let intOffX = 0
    let intOffY = 0

    // Denned cats/dogs that wander the interior room while the player is inside.
    interface InteriorAnimal {
      type: 'cat' | 'dog'
      sprite: PIXI.Sprite
      tx: number; ty: number
      targetX: number; targetY: number
      moving: boolean
      timer: number
      frames: PIXI.Texture[]
      staticTex: PIXI.Texture
      sleepTex: PIXI.Texture | null
      frameIdx: number
      frameTimer: number
      baseScale: number
      bubble: PIXI.Container | null
      bubbleTimer: number
    }
    const interiorAnimals: InteriorAnimal[] = []

    // ── Tween (shared by exterior and interior walk) ───────────────────────────
    function tweenLinear(
      obj: PIXI.Container,
      targetX: number,
      targetY: number,
      durationMs: number,
    ): Promise<void> {
      return new Promise(resolve => {
        if (durationMs <= 0) { obj.x = targetX; obj.y = targetY; resolve(); return }
        const sx = obj.x, sy = obj.y
        let elapsed = 0
        const tick = (ticker: PIXI.Ticker) => {
          elapsed += ticker.deltaMS
          const t = Math.min(elapsed / durationMs, 1)
          obj.x = sx + (targetX - sx) * t
          obj.y = sy + (targetY - sy) * t
          if (t >= 1) { app.ticker.remove(tick); resolve() }
        }
        app.ticker.add(tick)
      })
    }

    // ── Interior exit ──────────────────────────────────────────────────────────
    const doExitInterior = () => {
      try {
        if (!interiorActive) return
        interiorActive = false
        interiorIsWalking = false
        interiorWalkQueue = []

        // Restore exterior
        groundLayer.visible   = true
        streetLayer.visible   = true
        buildingLayer.visible = true
        nodeLayer.visible     = true
        npcLayer.visible      = true
        bubbleLayer.visible   = true

        // Move avatar back to exterior door position
        if (avatar && avatarInInterior) {
          interiorLayer.removeChild(avatar)
          avatarLayer.addChild(avatar)
          avatarInInterior = false
          // A purchased room slot (or any hand-authored sub-room) has no
          // exterior door of its own — its id is `<mainBuildingId>-<slotId>`,
          // so fall back to the door of the building whose id prefixes it.
          const door = HUB_DOORS.find(d => d.buildingId === currentInteriorId)
            ?? HUB_DOORS.find(d => !!currentInteriorId && currentInteriorId.startsWith(`${d.buildingId}-`))
          if (door) {
            avatar.x = door.tx * T + T / 2
            avatar.y = door.ty * T + T
            currentTile = [door.tx, door.ty]
          }
          onAvatarMoveRef.current(avatar.x, avatar.y)
        }

        interiorLayer.visible = false
        interiorLayer.removeChildren()
        interiorAnimals.length = 0
        currentInteriorId  = null
        currentInteriorObj = null
        highlightGfx.clear()
        stopInteriorAudio()  // resume town theme + drop ambiance
        onExitInteriorRef.current?.()
      } catch (e) {
        rollbar.error('[HubTownCanvas] doExitInterior error', { error: String(e) })
      }
    }

    // Provider set once the animal system is created (below). Lets the interior
    // renderer show cats/dogs that are denned inside the building being entered.
    let getAnimalsInBuildingFn: (buildingId: string) => { type: string; tint: number }[] = () => []

    // ── Interior enter ─────────────────────────────────────────────────────────
    const doEnterInterior = (buildingId: string, entryTx?: number, entryTy?: number) => {
      try {
      // Locked door check — block entry if key not in inventory
      const lock = HUB_LOCKED_DOORS.find(l => l.buildingId === buildingId)
      if (lock && !doorKeysRef.current?.has(lock.lockedBy)) {
        onDoorLockedRef.current?.(buildingId, lock.lockedBy)
        return
      }

      // Ownership check — buildings tagged requiresOwnership (e.g. a player
      // house) stay locked until the player has purchased at least level 1
      // of their upgrade track (purchaseUpgrade in reputation.ts).
      const ownedBuilding = HUB_BUILDINGS.find(b => b.id === buildingId)
      if (ownedBuilding?.requiresOwnership && (buildingUpgradeLevelsRef?.current[buildingId] ?? 0) < 1) {
        onDoorLockedRef.current?.(buildingId, 'unpurchased')
        return
      }

      // Player-owned room slots (basement/first-floor/left/right/rear, see
      // houseRooms.ts) aren't authored in config.json — if the static lookup
      // misses, check whether buildingId is `<mainHouseId>-<slotId>` for a
      // slot the player has actually purchased, and synthesize its interior
      // from the shared catalog template.
      let interior = HUB_INTERIORS[buildingId]
      if (!interior) {
        const mainHouse = HUB_BUILDINGS.find(b => b.id && b.upgradeKind === 'playerHouse' && buildingId.startsWith(`${b.id}-`))
        const slot = mainHouse?.id ? parseSlotBuildingId(buildingId, mainHouse.id) : undefined
        if (mainHouse?.id && slot && getPurchasedSlotIds(`${locationKey}:${mainHouse.id}`).includes(slot.id)) {
          const mainName = HUB_INTERIORS[mainHouse.id]?.name ?? mainHouse.id
          interior = synthesizeSlotInterior(mainHouse.id, mainName, slot)
        }
      }
      if (!interior) return

      // ── Upgrade-level gating ───────────────────────────────────────────────
      // Interior decor, rooms (exits) and NPCs can be tagged with a minLevel so
      // they only appear once the building has been upgraded that far. Sub-rooms
      // (no exterior door) inherit the level of the parent building whose id
      // prefixes this interior's id.
      const levelKey = HUB_BUILDINGS.find(b => b.id && buildingId.startsWith(b.id) && b.upgradeKind)?.id ?? buildingId
      const currentLevel = buildingUpgradeLevelsRef?.current[levelKey] ?? 0
      const visibleDecor = interior.decor.filter(d => isVisibleAtLevel(d, currentLevel))
      const staticExits  = (interior.exits ?? []).filter(e => (e.minLevel ?? 0) <= currentLevel)
      // A player-house main room also exposes one exit per purchased room
      // slot — these are synthesized from houseRooms.ts, not authored here.
      const isPlayerHouseMain = HUB_BUILDINGS.some(b => b.id === buildingId && b.upgradeKind === 'playerHouse')
      const dynamicExits = isPlayerHouseMain
        ? getPurchasedSlotIds(`${locationKey}:${buildingId}`)
            .map(id => getRoomSlotDef(id))
            .filter((s): s is NonNullable<typeof s> => !!s)
            .map(slot => buildMainRoomExit(slot, `${buildingId}-${slot.id}`))
        : []
      const availableExits = [...staticExits, ...dynamicExits]

      // playerDecor interiors ship unfurnished (decor: []) — everything
      // visible is rendered from the player's placed furniture (homeLayout.ts)
      // at runtime, not upgrade-gated. They can also carry a player-chosen
      // floor/wall material (roomStyle.ts), overriding the template default —
      // spread onto a new object since `interior` may be a direct reference
      // into the shared, module-level HUB_INTERIORS record for the main room.
      if (interior.playerDecor) {
        const houseKey = `${locationKey}:${buildingId}`
        const style = getResolvedRoomStyle(houseKey)
        if (style.floorTileId !== undefined || style.wallMaterial !== undefined) {
          interior = {
            ...interior,
            ...(style.floorTileId !== undefined && { floorTileId: style.floorTileId }),
            ...(style.wallMaterial !== undefined && { wallMaterial: style.wallMaterial }),
          }
        }
        for (const piece of loadHomeLayout(houseKey)) {
          for (const offset of getFurnitureTileOffsets(piece.itemId)) {
            // DECORATE grid coords are 0-indexed within the walkable floor, which
            // itself starts at (1,1) inside the room's 1-tile wall border.
            visibleDecor.push({ tx: piece.x + 1 + offset.dx, ty: piece.y + 1 + offset.dy, tileId: offset.tileId })
          }
        }
      }

      // Building hours check — block entry if closed
      if (!isBuildingOpen(interior, gameHourRef.current)) {
        const openHour = interior.hours !== 'always' && interior.hours ? interior.hours.open : null
        onDoorLockedRef.current?.(buildingId, openHour !== null ? `closed:${openHour}` : 'closed')
        return
      }

      const intW = interior.width * T
      const intH = interior.height * T
      intOffX = Math.floor((MAP_W - intW) / 2)
      intOffY = Math.floor((MAP_H - intH) / 2)

      // Notify HubWorld that entry succeeded (must happen after all guard returns)
      onEnterInteriorRef.current?.(buildingId)

      // Per-building audio: swap to the interior's music / ambiance (if authored)
      startInteriorAudio(interior.musicId, interior.ambianceId)

      // Hide exterior layers
      groundLayer.visible   = false
      streetLayer.visible   = false
      buildingLayer.visible = false
      nodeLayer.visible     = false
      npcLayer.visible      = false
      bubbleLayer.visible   = false

      // Clean up any exterior bubbles/scared-bubbles/reactions before entering
      for (const slot of activeBubbles) bubbleLayer.removeChild(slot.container)
      activeBubbles.length = 0
      for (const r of activeReactions) bubbleLayer.removeChild(r.text)
      activeReactions.length = 0
      for (const npc of unitNpcs) {
        if (npc.scaredBubble) {
          bubbleLayer.removeChild(npc.scaredBubble)
          npc.scaredBubble = null
          npc.scaredBubbleTimer = 0
        }
      }

      // Prepare interior layer
      interiorLayer.removeChildren()
      interiorAnimals.length = 0
      interiorLayer.position.set(intOffX, intOffY)
      interiorLayer.visible = true

      // Dark background covering the full map (masks transparent canvas outside room)
      const bg = new PIXI.Graphics()
      bg.rect(-intOffX, -intOffY, MAP_W, MAP_H).fill({ color: 0x0a0a18, alpha: 1 })
      interiorLayer.addChild(bg)

      // Set interior state
      const exitTx: number = Math.floor(interior.width / 2)
      // isSubRoom: no exterior door exists for this interior (upstairs rooms, passages, etc.)
      const isSubRoom = !HUB_DOORS.some(d => d.buildingId === buildingId)
      const defaultEntryTile: [number, number] = [entryTx ?? exitTx, entryTy ?? (interior.height - 2)]
      interiorCurrentTile = defaultEntryTile
      currentInteriorId   = buildingId
      currentInteriorObj  = interior
      interiorExitTile    = isSubRoom ? [-1, -1] : [exitTx, interior.height - 1]
      interiorActive      = true
      interiorIsWalking   = false
      interiorWalkQueue   = []
      exitByTile          = new Map<string, HubInteriorExit>()

      // Hide exterior overlays so they don't bleed into the interior view
      for (const ind of questIndicators.values()) ind.visible = false
      for (const entry of exteriorInteractables.values()) { if (entry.indicator) entry.indicator.visible = false }
      for (const s of npcNameTags) { s.tag.visible = false; s.phase = 'hidden'; s.wasInRange = false; s.bubbleReady = false }

      // Build walkable set
      interiorWalkable = new Set<string>()
      for (let tx = 1; tx < interior.width - 1; tx++)
        for (let ty = 1; ty < interior.height - 1; ty++)
          interiorWalkable.add(`${tx},${ty}`)
      if (!isSubRoom) interiorWalkable.add(`${exitTx},${interior.height - 1}`)
      for (const d of visibleDecor) {
        if (!d.zlayer || d.zlayer === 'solid') interiorWalkable.delete(`${d.tx},${d.ty}`)
      }
      // Interactables' owned solid decor blocks walking (at moved position if persisted)
      for (const i of HUB_INTERACTABLES.filter(i => i.building === buildingId)) {
        const pos = interactableMovesRef?.current.get(i.id) ?? { tx: i.tx, ty: i.ty }
        for (const d of i.decor ?? []) {
          if (!d.zlayer || d.zlayer === 'solid') interiorWalkable.delete(`${pos.tx + d.dx},${pos.ty + d.dy}`)
        }
      }
      // Register inter-room exit tiles
      for (const exit of availableExits) {
        interiorWalkable.add(`${exit.tx},${exit.ty}`)
        exitByTile.set(`${exit.tx},${exit.ty}`, exit)
      }

      // Floor tile set (all inner tiles + exit door tiles)
      const floorSet = new Set<string>()
      for (let tx = 1; tx < interior.width - 1; tx++)
        for (let ty = 1; ty < interior.height - 1; ty++)
          floorSet.add(`${tx},${ty}`)
      if (!isSubRoom) floorSet.add(`${exitTx},${interior.height - 1}`)  // exit door opening
      for (const exit of availableExits) {
        if (exit.direction === 'left' || exit.direction === 'right' ||
            exit.direction === 'front' || exit.direction === 'back') floorSet.add(`${exit.tx},${exit.ty}`)
      }

      // Wall tile set (border, minus exit door openings)
      const wallSet = new Set<string>()
      for (let tx = 0; tx < interior.width; tx++) {
        wallSet.add(`${tx},0`)
        wallSet.add(`${tx},${interior.height - 1}`)
      }
      for (let ty = 1; ty < interior.height - 1; ty++) {
        wallSet.add(`0,${ty}`)
        wallSet.add(`${interior.width - 1},${ty}`)
      }
      if (!isSubRoom) wallSet.delete(`${exitTx},${interior.height - 1}`)  // open bottom door gap
      for (const exit of availableExits) {
        if (exit.direction === 'left' || exit.direction === 'right' ||
            exit.direction === 'front' || exit.direction === 'back') wallSet.delete(`${exit.tx},${exit.ty}`)
      }

      // Render tile layers (async — tiles appear as they load)
      const floorContainer = new PIXI.Container()
      const wallContainer  = new PIXI.Container()
      interiorLayer.addChild(floorContainer, wallContainer)

      // Floor: proper interior tile from base chip sheet (wood, stone, parquet, etc.)
      const floorTileId  = interior.floorTileId ?? 288
      loadTileRef(floorTileId).then(floorTex => {
        if (!interiorActive || currentInteriorId !== buildingId) return
        for (let tx = 1; tx < interior.width - 1; tx++) {
          for (let ty = 1; ty < interior.height - 1; ty++) {
            const s = new PIXI.Sprite(floorTex)
            s.position.set(tx * T, ty * T)
            floorContainer.addChild(s)
          }
        }
        // Exit door tile also gets floor (only for ground-level rooms with a bottom door)
        if (!isSubRoom) {
          const exitFloor = new PIXI.Sprite(floorTex)
          exitFloor.position.set(exitTx * T, (interior.height - 1) * T)
          floorContainer.addChild(exitFloor)
        }
        // Wall-gap exits need explicit floor tiles (they're outside the inner loop)
        for (const exit of availableExits) {
          if (exit.direction === 'left' || exit.direction === 'right' ||
              exit.direction === 'front' || exit.direction === 'back') {
            const s = new PIXI.Sprite(floorTex)
            s.position.set(exit.tx * T, exit.ty * T)
            floorContainer.addChild(s)
          }
        }
      }).catch(() => {
        renderPathTiles(floorContainer, floorSet, undefined, PATH_TILE.dirt1).catch(() => {})
      })

      // Walls: side columns use default path tiles; top/bottom rows use wallMaterial if set
      const sideWallSet       = new Set<string>()
      const horizontalWallSet = new Set<string>()
      for (const key of wallSet) {
        const [wx, wy] = key.split(',').map(Number)
        if (wx > 0 && wx < interior.width - 1 && (wy === 0 || wy === interior.height - 1)) horizontalWallSet.add(key)
        else {sideWallSet.add(`${wx},${wy-1}`); sideWallSet.add(`${wx},${wy}`)}
      }
      // The tile below a left/right exit contributes the exit position to sideWallSet; remove it explicitly
      for (const exit of availableExits) {
        if (exit.direction === 'left' || exit.direction === 'right') sideWallSet.delete(`${exit.tx},${exit.ty}`)
        // back exits are at ty=0; the sideWallSet formula adds (wx, -1) and (wx, 0) for ty=0 wall tiles,
        // but since we deleted (tx, 0) from wallSet before building sideWallSet, nothing to clean up here.
      }
      renderPathTiles(wallContainer, sideWallSet, undefined, PATH_TILE.wall2).catch(() => {})

      if (interior.wallMaterial) {
        // Bottom row keeps default tile; top row uses middleBottom; a visual-only row above (ty=-1) uses middleTop
        renderPathTiles(wallContainer, new Set([...horizontalWallSet].filter(k => parseInt(k.split(',')[1]) !== 0)), undefined, PATH_TILE.wall2).catch(() => {})
        const wTiles = WALL_TILES[interior.wallMaterial]
        // ty=0 row → middleBottom; ty=-1 (above room, visual only) → middleTop
        const byTileId = new Map<number, [number, number][]>()
        for (const key of horizontalWallSet) {
          const [wx, wy] = key.split(',').map(Number)
          if (wy !== 0) continue
          const list = byTileId.get(wTiles.middleBottom) ?? []; list.push([wx, 0]); byTileId.set(wTiles.middleBottom, list)
          const topList = byTileId.get(wTiles.middleTop) ?? []; topList.push([wx, -1]); byTileId.set(wTiles.middleTop, topList)
        }
        for (const [tileId, positions] of byTileId) {
          loadTileRef(tileId).then(tex => {
            if (!interiorActive || currentInteriorId !== buildingId) return
            for (const [wx, wy] of positions) {
              const s = new PIXI.Sprite(tex)
              s.position.set(wx * T, wy * T)
              s.width = T; s.height = T
              wallContainer.addChild(s)
            }
          }).catch(() => {})
        }
      } else {
        renderPathTiles(wallContainer, horizontalWallSet, undefined, PATH_TILE.wall2).catch(() => {})
      }

      // Decor — split into below (solid/below) and above containers
      const decorBelowContainer = new PIXI.Container()
      const decorAboveContainer = new PIXI.Container()  // added to interiorLayer after avatar
      interiorLayer.addChild(decorBelowContainer)

      function renderDecorItems(items: typeof interior.decor, target: PIXI.Container) {
        const byTileId = new Map<number, [number, number][]>()
        for (const d of items) {
          if (d.tileId === 666) continue
          const list = byTileId.get(d.tileId) ?? []
          list.push([d.tx, d.ty])
          byTileId.set(d.tileId, list)
        }
        for (const [tileId, positions] of byTileId) {
          loadTileRef(tileId).then(tex => {
            if (!interiorActive || currentInteriorId !== buildingId) return
            for (const [dtx, dty] of positions) {
              const s = new PIXI.Sprite(tex)
              s.width = T; s.height = T
              s.position.set(dtx * T, dty * T)
              target.addChild(s)
            }
          }).catch(() => {})
        }
      }

      renderDecorItems(visibleDecor.filter(d => d.zlayer !== 'above'), decorBelowContainer)
      // above decor rendered after avatar is added (below)

      // Interior pickup items — rendered in room, disappear when tapped
      {
        const intPickups = HUB_PICKUP_ITEMS.filter(p => p.building === buildingId)
        const intByTile = new Map<number, typeof intPickups>()
        for (const p of intPickups) {
          if (p.tileId === 666) continue
          const list = intByTile.get(p.tileId) ?? []
          list.push(p)
          intByTile.set(p.tileId, list)
        }
        for (const [tileId, pickups] of intByTile) {
          loadTileRef(tileId).then(tex => {
            if (!interiorActive || currentInteriorId !== buildingId) return
            for (const pickup of pickups) {
              if (pickedUpRef.current.has(pickup.id)) continue
              if (pickup.chain && !pickedUpRef.current.has(pickup.chain)) continue
              const initiallyVisible = !pickup.questId || (activeQuestIdsRef?.current.has(pickup.questId) ?? true)
              const s = new PIXI.Sprite(tex)
              s.position.set(pickup.tx * T, pickup.ty * T)
              s.width = T; s.height = T
              s.visible = initiallyVisible
              if (pickup.questId) pickupQuestIds.set(pickup.id, pickup.questId)
              if (!pickup.requireTouch) {
                s.eventMode = 'static'
                s.cursor    = 'pointer'
                s.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
                  e.stopPropagation()
                  s.visible = false
                  for (const extra of pickupExtraSprites.get(pickup.id) ?? []) extra.visible = false
                  pickedUpRef.current.add(pickup.id)
                  // Reveal chained exterior pickups if applicable
                  for (const [pid, sprite] of pickupSprites) {
                    const def = HUB_PICKUP_ITEMS.find(p => p.id === pid)
                    if (def?.chain === pickup.id) {
                      sprite.visible = true
                      for (const extra of pickupExtraSprites.get(pid) ?? []) extra.visible = true
                    }
                  }
                  onItemPickupRef.current?.(pickup.id, pickup.questId)
                })
              }
              decorBelowContainer.addChild(s)
              pickupSprites.set(pickup.id, s)
              for (const extra of pickup.extraTiles ?? []) {
                loadTileRef(extra.tileId).then(extraTex => {
                  if (!interiorActive || currentInteriorId !== buildingId) return
                  const es = new PIXI.Sprite(extraTex)
                  es.position.set((pickup.tx + extra.dx) * T, (pickup.ty + extra.dy) * T)
                  es.width = T; es.height = T
                  es.visible = initiallyVisible && !pickedUpRef.current.has(pickup.id)
                  decorBelowContainer.addChild(es)
                  const list = pickupExtraSprites.get(pickup.id) ?? []
                  list.push(es)
                  pickupExtraSprites.set(pickup.id, list)
                }).catch(() => {})
              }
            }
          }).catch(() => {})
        }
      }

      // Interior interactables — tappable decor / hit areas inside the room
      interiorInteractables.clear()
      for (const def of HUB_INTERACTABLES.filter(i => i.building === buildingId)) {
        buildInteractable(
          def, interiorLayer, decorAboveContainer, interiorLayer, interiorInteractables,
          () => interiorActive && currentInteriorId === buildingId,
        )
      }

      // Interior NPCs — rendered inside the room, tappable
      const interiorNpcList: HubNpc[] = (INTERIOR_NPCS[buildingId] ?? []).filter(n => isVisibleAtLevel(n, currentLevel))
      for (const npc of interiorNpcList) {
        // Activity pose swap, mirroring the exterior ticker logic — resolved once
        // here since this block only reruns when the player re-enters the room.
        const interiorSpriteSlug = resolveNpcSprite(npc.sprite)
        const interiorBaseTexUrl = `${base}sprites/${interiorSpriteSlug}.svg`
        const interiorActivity = npc.schedule ? getNpcActivity(npc, gameHourRef.current) : null
        const interiorTexLoader = interiorActivity
          ? loadTextureUrl(`${base}sprites/${interiorSpriteSlug}-${interiorActivity}.svg`).catch(() => loadTextureUrl(interiorBaseTexUrl))
          : loadTextureUrl(interiorBaseTexUrl)
        interiorTexLoader.then(tex => {
          if (!interiorActive || currentInteriorId !== buildingId) return
          const s = new PIXI.Sprite(tex)
          s.width = SPRITE_SIZE; s.height = SPRITE_SIZE
          s.anchor.set(0.5, 1)
          s.position.set(npc.tx * T + T / 2, npc.ty * T + T)
          s.eventMode = 'static'
          s.cursor    = 'pointer'
          s.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
            e.stopPropagation()
            if (npc.dialogue.length > 0 || npc.screen || npc.questGive || npc.questReceive || npc.dialogueTree) {
              const idx = npcDialogueIndex.get(npc.id) ?? 0
              const pool = getNpcDialoguePool(npc, gameHourRef.current)
              onNpcTapRef.current?.(pool[idx % pool.length] ?? '', npc.id)
              npcDialogueIndex.set(npc.id, idx + 1)
            }
          })
          interiorLayer.addChild(s)
        }).catch(() => {})
      }

      // Scheduled exterior NPCs — render inside this building when their schedule says so
      const scheduledVisitors = EXTERIOR_NPCS.filter(npc => {
        if (!npc.schedule) return false
        const loc = getNpcLocation(npc, gameHourRef.current)
        return loc?.type === 'interior' && loc.buildingId === buildingId
      })
      for (const npc of scheduledVisitors) {
        const loc = getNpcLocation(npc, gameHourRef.current) as { type: 'interior'; buildingId: string; tx: number; ty: number }
        // Activity pose swap, mirroring the exterior ticker logic — resolved once
        // here since this block only reruns when the player re-enters the room.
        const visitorSpriteSlug = resolveNpcSprite(npc.sprite)
        const visitorBaseTexUrl = `${base}sprites/${visitorSpriteSlug}.svg`
        const visitorActivity = getNpcActivity(npc, gameHourRef.current)
        const visitorTexLoader = visitorActivity
          ? loadTextureUrl(`${base}sprites/${visitorSpriteSlug}-${visitorActivity}.svg`).catch(() => loadTextureUrl(visitorBaseTexUrl))
          : loadTextureUrl(visitorBaseTexUrl)
        visitorTexLoader.then(tex => {
          if (!interiorActive || currentInteriorId !== buildingId) return
          const s = new PIXI.Sprite(tex)
          s.width = SPRITE_SIZE; s.height = SPRITE_SIZE
          s.anchor.set(0.5, 1)
          s.position.set(loc.tx * T + T / 2, loc.ty * T + T)
          s.eventMode = 'static'
          s.cursor    = 'pointer'
          s.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
            e.stopPropagation()
            if (npc.dialogue.length > 0 || npc.questGive || npc.questReceive || npc.dialogueTree) {
              const idx = npcDialogueIndex.get(npc.id) ?? 0
              const pool = getNpcDialoguePool(npc, gameHourRef.current)
              onNpcTapRef.current?.(pool[idx % pool.length] ?? '', npc.id)
              npcDialogueIndex.set(npc.id, idx + 1)
            }
          })
          interiorLayer.addChild(s)
        }).catch(() => {})
      }

      // Denned animals — cats/dogs that are home inside this building wander
      // the room while the player is in it (#1592).
      {
        const denned = getAnimalsInBuildingFn(buildingId)
        const freeTiles = Array.from(interiorWalkable).map(k => k.split(',').map(Number) as [number, number])
        denned.forEach((da, i) => {
          if (da.type !== 'cat' && da.type !== 'dog') return
          const spot = freeTiles[(i * 7 + 3) % Math.max(1, freeTiles.length)] ?? [1, 1]
          const baseSlug = `animal-${da.type}`
          loadTextureUrl(`${base}sprites/${baseSlug}.svg`).then(tex => {
            if (!interiorActive || currentInteriorId !== buildingId) return
            const s = new PIXI.Sprite(tex)
            const px = SPRITE_SIZE * (da.type === 'cat' ? 0.62 : 0.72)
            s.width = px; s.height = px
            s.anchor.set(0.5, 1)
            s.tint = da.tint
            s.position.set(spot[0] * T + T / 2, spot[1] * T + T)
            interiorLayer.addChild(s)
            const ia: InteriorAnimal = {
              type: da.type as 'cat' | 'dog', sprite: s, tx: spot[0], ty: spot[1],
              targetX: s.x, targetY: s.y, moving: false, timer: 1000 + Math.random() * 2500,
              frames: [], staticTex: tex, sleepTex: null, frameIdx: 0, frameTimer: 160, baseScale: s.scale.x,
              bubble: null, bubbleTimer: 0,
            }
            // Tappable indoors too — show a flavour bubble (#1592).
            s.eventMode = 'static'
            s.cursor = 'pointer'
            s.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
              e.stopPropagation()
              if (ia.bubble) interiorLayer.removeChild(ia.bubble)
              const b = createSpeechBubble(ia.type === 'cat' ? 'Meow' : 'Woof!', ia.sprite.x, ia.sprite.y)
              interiorLayer.addChild(b)
              ia.bubble = b
              ia.bubbleTimer = 1500
            })
            interiorAnimals.push(ia)
            loadAnimFrames(baseSlug, 3).then(f => { ia.frames = f }).catch(() => {})
            if (da.type === 'cat') loadTextureUrl(`${base}sprites/animal-cat-sleep.svg`).then(t => { ia.sleepTex = t }).catch(() => {})
          }).catch(() => {})
        })
      }

      // Quest indicators for interior NPCs
      interiorQuestIndicators.clear()
      interiorIndicatorBaseY.clear()
      for (const npc of interiorNpcList) {
        if (!npc.questGive && !npc.questReceive) continue
        const indBaseY = npc.ty * T + T - SPRITE_SIZE - 8
        const ind = new PIXI.Text({ text: '!', style: { fontSize: 16, fill: '#ffdd44', fontWeight: 'bold', fontFamily: 'monospace', stroke: { color: '#1a1a1a', width: 3 } } })
        ind.anchor.set(0.5, 1)
        ind.position.set(npc.tx * T + T / 2, indBaseY)
        ind.visible = false
        interiorLayer.addChild(ind)
        interiorQuestIndicators.set(npc.id, ind)
        interiorIndicatorBaseY.set(npc.id, indBaseY)
      }

      // Room name label — sits above the top wall row (ty=0 occupies y=0..T)
      const nameLabel = new PIXI.Text({
        text: interior.name,
        style: { fontSize: 10, fill: '#c8e8c8', fontFamily: 'monospace' },
      })
      nameLabel.position.set(T + 4, -48)
      interiorLayer.addChild(nameLabel)

      // Exit marker (standard "leave building" exit, only for ground-level rooms)
      if (!isSubRoom) {
        const exitMarker = new PIXI.Text({
          text: '▼ EXIT',
          style: { fontSize: 8, fill: '#88ff88', fontFamily: 'monospace', fontWeight: 'bold' },
        })
        exitMarker.anchor.set(0.5, 0)
        exitMarker.position.set(exitTx * T + T / 2, (interior.height - 1) * T + 2)
        interiorLayer.addChild(exitMarker)
      }
      // Room-exit direction markers (stairs, passages)
      for (const exit of availableExits) {
        const arrow = exit.direction === 'up' ? '▲' : exit.direction === 'down' ? '▼' : exit.direction === 'left' ? '◄' : exit.direction === 'back' ? '▲' : exit.direction === 'front' ? '▼' : '►'
        const marker = new PIXI.Text({
          text: arrow,
          style: { fontSize: 10, fill: '#aaddff', fontFamily: 'monospace', fontWeight: 'bold' },
        })
        marker.anchor.set(0.5, 1)
        marker.position.set(exit.tx * T + T / 2, exit.ty * T)
        interiorLayer.addChild(marker)
      }

      // Interior treasures — chests defined in the treasures array with a matching buildingId.
      // Added to decorBelowContainer (not interiorLayer directly) so above-tagged decor
      // still renders on top regardless of texture-load timing.
      for (const t of HUB_TREASURES.filter(tr => tr.buildingId === buildingId)) {
        const isCollected = collectedTreasureRef.current.has(t.id)
        const displayTileId = isCollected && t.collectedTileId != null ? t.collectedTileId : t.tileId
        const collectedTexPromise = t.collectedTileId
          ? loadTileRef(t.collectedTileId).catch(() => null)
          : Promise.resolve(null)
        loadTileRef(displayTileId).then(async tex => {
          if (!interiorActive || currentInteriorId !== buildingId) return
          const collectedTex = await collectedTexPromise
          const s = new PIXI.Sprite(tex)
          s.position.set(t.tx * T, t.ty * T)
          s.width = T; s.height = T
          if (!isCollected) {
            s.eventMode = 'static'
            s.cursor    = 'pointer'
            s.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
              e.stopPropagation()
              collectedTreasureRef.current.add(t.id)
              if (collectedTex) s.texture = collectedTex
              else              s.visible = false
              s.eventMode = 'none'
              onTreasureStepRef.current?.(t.id)
            })
          }
          decorBelowContainer.addChild(s)
        }).catch(() => {})
      }

      // Move avatar into interior (on top of solid/below decor)
      if (avatar) {
        if (!avatarInInterior) avatarLayer.removeChild(avatar)
        avatar.x = defaultEntryTile[0] * T + T / 2
        avatar.y = defaultEntryTile[1] * T + T
        interiorLayer.addChild(avatar)
        avatarInInterior = true
      }

      // above decor — added after avatar so it renders on top
      interiorLayer.addChild(decorAboveContainer)
      renderDecorItems(visibleDecor.filter(d => d.zlayer === 'above'), decorAboveContainer)

      // Scroll viewport to center on interior
      onAvatarMoveRef.current(intOffX + defaultEntryTile[0] * T + T / 2, intOffY + defaultEntryTile[1] * T + T / 2)
      } catch (e) {
        rollbar.error('[HubTownCanvas] doEnterInterior error', { buildingId, error: String(e) })
      }
    }

    if (interiorEnterRef) interiorEnterRef.current = doEnterInterior
    if (interiorExitRef)  interiorExitRef.current  = doExitInterior

    // ── Interior walk queue ────────────────────────────────────────────────────
    async function processInteriorWalkQueue() {
      try {
        if (interiorWalkQueue.length === 0) { interiorIsWalking = false; return }
        interiorIsWalking = true
        const [ntx, nty] = interiorWalkQueue.shift()!
        const px = ntx * T + T / 2
        const py = nty * T + T
        const av = avatar
        if (!av) { interiorCurrentTile = [ntx, nty]; processInteriorWalkQueue(); return }
        if (px < av.x - 1) av.scale.x = -Math.abs(av.scale.x)
        else if (px > av.x + 1) av.scale.x = Math.abs(av.scale.x)
        const dist = Math.hypot(px - av.x, py - av.y)
        await tweenLinear(av, px, py, (dist / WALK_PX_PER_S) * 1000)
        interiorCurrentTile = [ntx, nty]
        emitSound('hubFootstep')  // throttled internally — match the exterior walk

        // Touch-pickup: collect requireTouch interior items when avatar walks onto their tile
        for (const [pid, sprite] of pickupSprites) {
          if (!sprite.visible) continue
          const def = HUB_PICKUP_ITEMS.find(p => p.id === pid && p.building === currentInteriorId)
          if (def?.requireTouch && def.tx === ntx && def.ty === nty) {
            sprite.visible = false
            pickedUpRef.current.add(pid)
            for (const [cpid, csprite] of pickupSprites) {
              const cdef = HUB_PICKUP_ITEMS.find(p => p.id === cpid)
              if (cdef?.chain === pid) csprite.visible = true
            }
            onItemPickupRef.current?.(pid, def.questId)
          }
        }

        if (ntx === interiorExitTile[0] && nty === interiorExitTile[1]) {
          interiorIsWalking = false
          doExitInterior()
          return
        }
        const roomExit = exitByTile.get(`${ntx},${nty}`)
        if (roomExit) {
          interiorIsWalking = false
          // Lock checks
          if (roomExit.lockedBy && !doorKeysRef.current?.has(roomExit.lockedBy)) {
            onDoorLockedRef.current?.(roomExit.toInteriorId, roomExit.lockedBy)
            processInteriorWalkQueue()
            return
          }
          if (roomExit.requiredQuest && !completedQuestIdsRef?.current.has(roomExit.requiredQuest)) {
            onDoorLockedRef.current?.(roomExit.toInteriorId, `quest:${roomExit.requiredQuest}`)
            processInteriorWalkQueue()
            return
          }
          doEnterInterior(roomExit.toInteriorId, roomExit.entryTx, roomExit.entryTy)
          return
        }
        processInteriorWalkQueue()
      } catch (e) {
        interiorIsWalking = false
        rollbar.error('[HubTownCanvas] processInteriorWalkQueue error', { error: String(e) })
      }
    }

    // ── Idle speech bubble state ───────────────────────────────────────────────
    const IDLE_THRESHOLD_MS = 5000
    const BUBBLE_SHOW_MS    = 10_000
    const BUBBLE_FADE_MS    = 500
    const SLOT_STAGGER_MS   = 4_000
    const MAX_BUBBLES       = 3

    interface BubbleSlot { container: PIXI.Container; timer: number; phase: 'showing' | 'fading'; npcId: string }
    const activeBubbles: BubbleSlot[] = []
    let lastMovedMs    = performance.now()
    let nextSpawnTimer = 0
    let lastBubbleIdx  = -1

    function createSpeechBubble(text: string, cx: number, cy: number): PIXI.Container {
      const c   = new PIXI.Container()
      const lbl = new PIXI.Text({
        text,
        style: { fontSize: 11, fill: '#111111', fontFamily: 'monospace', wordWrap: true, wordWrapWidth: 160 },
      })
      lbl.anchor.set(0.5, 0.5)
      const pad = 6
      const bw  = lbl.width  + pad * 2
      const bh  = lbl.height + pad * 2
      lbl.position.set(0, -bh / 2)
      const bg  = new PIXI.Graphics()
      bg.roundRect(-bw / 2, -bh, bw, bh, 6).fill({ color: 0xffffff, alpha: 1 })
      bg.roundRect(-bw / 2, -bh, bw, bh, 6).stroke({ color: 0x000000, width: 1.5 })
      bg.moveTo(-6, 0).lineTo(6, 0).lineTo(0, 8).closePath().fill({ color: 0xffffff })
      bg.moveTo(-6, 0).lineTo(6, 0).lineTo(0, 8).closePath().stroke({ color: 0x000000, width: 1.5 })
      c.addChild(bg, lbl)
      c.position.set(cx, cy - SPRITE_SIZE - 4)
      return c
    }

    function createNameTag(name: string, cx: number, cy: number): PIXI.Container {
      const c   = new PIXI.Container()
      const lbl = new PIXI.Text({
        text: name,
        style: { fontSize: 9, fill: '#111111', fontFamily: 'monospace', fontWeight: 'bold' },
      })
      lbl.anchor.set(0.5, 0.5)
      const pad = 3
      const bw  = lbl.width  + pad * 2
      const bh  = lbl.height + pad * 2
      const bg  = new PIXI.Graphics()
      bg.roundRect(-bw / 2, -bh / 2, bw, bh, 3).fill({ color: 0xffffff, alpha: 0.9 })
      bg.roundRect(-bw / 2, -bh / 2, bw, bh, 3).stroke({ color: 0x000000, width: 1 })
      c.addChild(bg, lbl)
      c.position.set(cx, cy - SPRITE_SIZE - 4)
      return c
    }

    // ── Exterior walk queue ────────────────────────────────────────────────────
    async function processWalkQueue() {
      try {
        if (walkQueue.length === 0) {
          isWalking = false
          if (pendingScreen) {
            const s = pendingScreen
            pendingScreen = null
            onNodeInteractRef.current(s)
          }
          return
        }
        isWalking = true
        const [tx, ty] = walkQueue.shift()!
        const av = avatar
        if (!av) { currentTile = [tx, ty]; processWalkQueue(); return }

        const targetX  = tx * T + T / 2
        const targetY  = ty * T + T
        const dist     = Math.hypot(targetX - av.x, targetY - av.y)
        const duration = (dist / WALK_PX_PER_S) * 1000

        if (targetX < av.x - 1) av.scale.x = -Math.abs(av.scale.x)
        else if (targetX > av.x + 1) av.scale.x = Math.abs(av.scale.x)

        await tweenLinear(av, targetX, targetY, duration)
        currentTile = [tx, ty]
        _savedTiles.set(locationKey, [tx, ty])
        emitSound('hubFootstep')  // throttled internally
        onAvatarStepRef.current?.()

        // Touch-pickup: collect requireTouch items when avatar walks onto their tile
        for (const [pid, sprite] of pickupSprites) {
          if (!sprite.visible) continue
          const def = HUB_PICKUP_ITEMS.find(p => p.id === pid)
          if (def?.requireTouch && def.tx === tx && def.ty === ty) {
            sprite.visible = false
            pickedUpRef.current.add(pid)
            for (const [cpid, csprite] of pickupSprites) {
              const cdef = HUB_PICKUP_ITEMS.find(p => p.id === cpid)
              if (cdef?.chain === pid) csprite.visible = true
            }
            onItemPickupRef.current?.(pid, def.questId)
          }
        }

        // Treasure step-on: collect chest when avatar walks onto its tile
        const treasureId = treasureByTile.get(`${tx},${ty}`)
        if (treasureId && !collectedTreasureRef.current.has(treasureId)) {
          collectedTreasureRef.current.add(treasureId)
          treasureByTile.delete(`${tx},${ty}`)
          const tSprite = treasureSprites.get(treasureId)
          if (tSprite) {
            const collectedTex = treasureCollectedTex.get(treasureId)
            if (collectedTex) tSprite.texture = collectedTex  // swap to open/empty tile
            else               tSprite.visible = false         // no collected tile — vanish
          }
          onTreasureStepRef.current?.(treasureId)
        }

        // Update area name on each tile step (works on mobile where pointermove doesn't fire)
        const tilePixX = tx * T + T / 2
        const tilePixY = ty * T + T / 2
        const walkedArea = HUB_AREAS.find(
          a => tilePixX >= a.x && tilePixX < a.x + a.w && tilePixY >= a.y && tilePixY < a.y + a.h
        )
        if (walkedArea) onAreaRef.current(walkedArea.name)

        // Door detection — entering a building triggers interior view
        const door = HUB_DOORS.find(d => d.tx === currentTile[0] && d.ty === currentTile[1])
        if (door) {
          isWalking     = false
          walkQueue     = []
          pendingScreen = null
          onNodeInteractRef.current(`interior:${door.buildingId}`)
          return
        }

        // Exit tile detection — walking onto an exit tile fires a screen transition
        const exitTile = exitTilesData.find(e => e.tx === currentTile[0] && e.ty === currentTile[1])
        if (exitTile) {
          isWalking     = false
          walkQueue     = []
          pendingScreen = null
          onNodeInteractRef.current(exitTile.screen)
          return
        }

        processWalkQueue()
      } catch (e) {
        isWalking = false
        rollbar.error('[HubTownCanvas] processWalkQueue error', { error: String(e) })
      }
    }

    function startWalk(target: [number, number], nodeScreen?: string) {
      for (const s of activeBubbles) bubbleLayer.removeChild(s.container)
      activeBubbles.length = 0
      for (const r of activeReactions) bubbleLayer.removeChild(r.text)
      activeReactions.length = 0
      nextSpawnTimer = 0
      lastMovedMs = performance.now()
      const effectivePathSet = exteriorWalkable()
      const path = findPath(currentTile, target, effectivePathSet)
      walkQueue = path.slice(1)
      pendingScreen = nodeScreen ?? null
      if (!isWalking) processWalkQueue()
    }

    // ── Input ──────────────────────────────────────────────────────────────────
    app.stage.eventMode = 'static'
    // Stage-local coords equal screen coords (the camera transform lives on
    // worldRoot), so the hit area is the screen rect — app.screen is updated
    // in place by renderer resizes.
    app.stage.hitArea   = app.screen

    function drawTileHighlight(stageX: number, stageY: number) {
      highlightGfx.clear()
      const bw = 2
      highlightGfx.rect(stageX, stageY, T, T).fill({ color: 0x00ff44, alpha: 0.18 })
      highlightGfx.rect(stageX, stageY, T, bw).fill({ color: 0x00ff44, alpha: 1 })
      highlightGfx.rect(stageX, stageY + T - bw, T, bw).fill({ color: 0x00ff44, alpha: 1 })
      highlightGfx.rect(stageX, stageY, bw, T).fill({ color: 0x00ff44, alpha: 1 })
      highlightGfx.rect(stageX + T - bw, stageY, bw, T).fill({ color: 0x00ff44, alpha: 1 })
    }

    app.stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      if (interiorActive) {
        const interior = currentInteriorObj
        if (!interior) return
        const { x, y } = e.getLocalPosition(interiorLayer)
        const tapTx = Math.max(0, Math.min(interior.width - 1, Math.floor(x / T)))
        const tapTy = Math.max(0, Math.min(interior.height - 1, Math.floor(y / T)))
        if (onTileTapRef.current) {
          onTileTapRef.current(tapTx, tapTy)
          drawTileHighlight(intOffX + tapTx * T, intOffY + tapTy * T)
        }
        const target: [number, number] = [tapTx, tapTy]
        if (!interiorWalkable.has(`${tapTx},${tapTy}`)) return
        const path = findInteriorPath(interiorCurrentTile, target, interiorWalkable)
        interiorWalkQueue = path.slice(1)
        if (!interiorIsWalking) processInteriorWalkQueue()
      } else {
        const { x, y } = e.getLocalPosition(worldRoot)
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return  // off the map edge
        const tapTx = Math.floor(x / T)
        const tapTy = Math.floor(y / T)
        if (onTileTapRef.current) {
          onTileTapRef.current(tapTx, tapTy)
          drawTileHighlight(tapTx * T, tapTy * T)
        }

        // If tap lands on a building tile, route to the nearest door
        if (buildingSet.has(`${tapTx},${tapTy}`)) {
          const nearestDoor = HUB_DOORS.reduce(
            (best, door) => {
              const d = Math.hypot(door.tx - tapTx, door.ty - tapTy)
              return d < best.d ? { door, d } : best
            },
            { door: HUB_DOORS[0], d: Infinity },
          ).door
          startWalk([nearestDoor.tx, nearestDoor.ty])
          return
        }

        const node   = EXTERIOR_NPCS.find(n => n.tx === tapTx && n.ty === tapTy && n.screen)
        const target = nearestWalkable(x, y, exteriorWalkable(), T)
        startWalk(target, node?.screen)
      }
    })

    app.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (interiorActive) return
      const { x, y } = e.getLocalPosition(worldRoot)
      const area = HUB_AREAS.find(
        a => x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h,
      )
      onAreaRef.current(area?.name ?? null)
    })
    app.stage.on('pointerleave', () => { onAreaRef.current(null) })

    // ── Return to courtyard ────────────────────────────────────────────────────
    if (returnRef) returnRef.current = () => {
      if (interiorActive) doExitInterior()
      walkQueue     = []
      pendingScreen = null
      isWalking     = false
      currentTile   = [AVATAR_START.tx, AVATAR_START.ty]
      _savedTiles.delete(locationKey)
      if (avatar) { avatar.x = COURTYARD_PX.x; avatar.y = COURTYARD_PX.y }
      onAvatarMoveRef.current(COURTYARD_PX.x, COURTYARD_PX.y)
    }

    // ── Per-frame ──────────────────────────────────────────────────────────────
    syncCamera()  // position the camera before the first rendered frame
    let _tickerErrorTs = 0
    let _lastNightAlpha = -1
    let _lastNightAvatarX = -Infinity, _lastNightAvatarY = -Infinity
    let _lastReportX = -Infinity, _lastReportY = -Infinity
    let _lastIsNight = isNightRef.current  // for the day↔night transition chime
    let _lastCrickets = false              // crickets-ambiance desired state (night && outdoors)
    // ── Animals (cats, dogs, birds, fish) ──────────────────────────────────────
    // Building roof ridges (top row of each building) are bird perch candidates.
    const animalRoofTiles: [number, number][] = []
    for (const b of HUB_BUILDINGS) {
      const [x1, y1, x2] = b.rect
      for (let tx = x1; tx <= x2; tx++) animalRoofTiles.push([tx, y1])
    }
    const animalGetWalkable = (): Set<string> => exteriorWalkable()
    // Tiles cats may not pad across when roaming off the paths. Bridge tiles are
    // excluded so animals can cross them just like street tiles.
    const bridgeSet = new Set(HUB_BRIDGE_TILES.map(([tx, ty]) => `${tx},${ty}`))
    const animalPondSet = new Set(HUB_POND_TILES.filter(([tx, ty]) => !bridgeSet.has(`${tx},${ty}`)).map(([tx, ty]) => `${tx},${ty}`))
    const animalIsSolid = (tx: number, ty: number): boolean =>
      tx < 0 || ty < 0 || tx >= MAP_W / T || ty >= MAP_H / T ||
      buildingSet.has(`${tx},${ty}`) || animalPondSet.has(`${tx},${ty}`) ||
      solidDecorSet.has(`${tx},${ty}`) || blockedPathSolidSet.has(`${tx},${ty}`)
    // Flower-decor tiles — butterflies route between them.
    const FLOWER_TILE_IDS = new Set([52, 53, 54, 55, 943])  // white/pink/blue/yellow flower, potOfFlowers
    const animalFlowerTiles: [number, number][] = EXTERIOR_DECOR
      .filter((d: { tileId: number }) => FLOWER_TILE_IDS.has(d.tileId))
      .map((d: { tx: number; ty: number }) => [d.tx, d.ty] as [number, number])
    const animalSystem: AnimalSystem = createAnimalSystem({
      app,
      spriteLayer,
      overlayLayer: aboveAvatarLayer,
      pondLayer,
      bubbleLayer,
      baseUrl: base,
      T,
      spriteSize: SPRITE_SIZE,
      mapW: MAP_W,
      mapH: MAP_H,
      getWalkable: animalGetWalkable,
      isSolidTile: animalIsSolid,
      getGameHour: () => gameHourRef.current,
      homes: HUB_DOORS.filter(d => d.buildingId).map(d => ({ buildingId: d.buildingId, tx: d.tx, ty: d.ty })),
      pondTiles: HUB_POND_TILES,
      roofTiles: animalRoofTiles,
      flowerTiles: animalFlowerTiles,
      chickenZones: HUB_CHICKEN_ZONES,
      placedAnimals: HUB_ANIMALS,
      buildingCount: HUB_BUILDINGS.length,
      npcCount: EXTERIOR_NPCS.length,
      getAvatarPx: () => ({ x: avatar?.x ?? COURTYARD_PX.x, y: avatar?.y ?? COURTYARD_PX.y }),
      getNpcPositions: () => {
        const out: { id?: string; x: number; y: number }[] = []
        out.push({ id: PLAYER_OWNER_ID, x: avatar?.x ?? COURTYARD_PX.x, y: avatar?.y ?? COURTYARD_PX.y })
        for (const [id, container] of namedNpcContainers) {
          if (!container.visible) continue
          const s = container.children[0] as PIXI.Sprite | undefined
          if (s) out.push({ id, x: s.x, y: s.y })
        }
        for (const n of unitNpcs) out.push({ x: n.sprite.x, y: n.sprite.y })
        return out
      },
      onAnimalTap: (id) => onAnimalTapRef.current?.(id),
      onAnimalSeen: (type, variant) => onAnimalSeenRef.current?.(type, variant),
      onAmbientAnimalTap: (type) => onAmbientAnimalTapRef.current?.(type) ?? false,
      getQuestIndicator: (id) => questNpcState?.current.get(id) ?? null,
      isInteriorActive: () => interiorActive,
      isOnScreen: (x, y) => {
        const vp = viewportRef?.current
        if (!vp) return true  // no camera ⇒ the whole map is on screen
        const sx = x - vp.scrollLeft, sy = y - vp.scrollTop
        const m = T * 2       // small margin so edge animals still count
        return sx >= -m && sx <= app.screen.width + m && sy >= -m && sy <= app.screen.height + m
      },
      getViewportRect: () => {
        const vp = viewportRef?.current
        if (!vp) return null
        return { x: vp.scrollLeft, y: vp.scrollTop, w: app.screen.width, h: app.screen.height }
      },
    })
    getAnimalsInBuildingFn = animalSystem.getAnimalsInBuilding
    if (petActionRef) petActionRef.current = { sendPetFetching: animalSystem.sendPetFetching, givePetAffection: animalSystem.givePetAffection, setPetAccessory: animalSystem.setPetAccessory }

    // Spawn the player's adopted follower pet (if any) near their spawn tile.
    const activePet = getActivePet()
    if (activePet) {
      let [ptx, pty] = [AVATAR_START.tx, AVATAR_START.ty + 1]
      if (animalIsSolid(ptx, pty)) [ptx, pty] = [AVATAR_START.tx + 1, AVATAR_START.ty]
      if (animalIsSolid(ptx, pty)) [ptx, pty] = [AVATAR_START.tx, AVATAR_START.ty]
      animalSystem.spawnFollowerPet(activePet.type as AnimalType, activePet.variant, activePet.pattern, ptx, pty)
    }

    // ── Weather overlay (screen-space, above the world incl. night dimming) ────
    const weatherLayer = new PIXI.Container()
    weatherLayer.eventMode = 'none'   // never block pointer events
    app.stage.addChild(weatherLayer)  // added after worldRoot ⇒ renders on top
    const weatherSystem = createWeatherSystem({
      layer: weatherLayer,
      getScreen: () => ({ width: app.screen.width, height: app.screen.height }),
      isPaused: () => interiorActive,
    })
    weatherSystem.setWeather(resolveWeather(HUB_WEATHER, HUB_ENV))

    app.ticker.add((ticker) => {
      try {
      animalSystem.tick(ticker.deltaMS)
      weatherSystem.tick(ticker.deltaMS)

      // Denned cats/dogs wandering the interior room (random 1-tile hops).
      if (interiorActive && interiorAnimals.length > 0) {
        const adt = Math.min(ticker.deltaMS, 50)
        for (const ia of interiorAnimals) {
          if (ia.bubble) {
            ia.bubble.position.set(ia.sprite.x, ia.sprite.y - SPRITE_SIZE * ia.baseScale - 4)
            ia.bubbleTimer -= adt
            if (ia.bubbleTimer <= 0) { interiorLayer.removeChild(ia.bubble); ia.bubble = null }
          }
          if (ia.moving) {
            const dx = ia.targetX - ia.sprite.x, dy = ia.targetY - ia.sprite.y
            const dist = Math.hypot(dx, dy), step = 40 * (adt / 1000)
            if (dx < -0.5) ia.sprite.scale.x = -ia.baseScale
            else if (dx > 0.5) ia.sprite.scale.x = ia.baseScale
            if (step >= dist || dist < 0.001) {
              ia.sprite.x = ia.targetX; ia.sprite.y = ia.targetY
              ia.moving = false; ia.timer = 1500 + Math.random() * 3500
              if (ia.staticTex) ia.sprite.texture = ia.staticTex
            } else {
              ia.sprite.x += (dx / dist) * step; ia.sprite.y += (dy / dist) * step
              if (ia.frames.length > 0) {
                ia.frameTimer -= adt
                if (ia.frameTimer <= 0) { ia.frameTimer = 160; ia.frameIdx = (ia.frameIdx + 1) % ia.frames.length; ia.sprite.texture = ia.frames[ia.frameIdx] }
              }
            }
          } else {
            ia.timer -= adt
            if (ia.type === 'cat' && ia.sleepTex && ia.sprite.texture !== ia.sleepTex && Math.random() < 0.004) ia.sprite.texture = ia.sleepTex
            if (ia.timer <= 0) {
              const opts: [number, number][] = []
              for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as [number, number][]) {
                const nx = ia.tx + dx, ny = ia.ty + dy
                if (interiorWalkable.has(`${nx},${ny}`)) opts.push([nx, ny])
              }
              if (opts.length > 0) {
                const [nx, ny] = opts[(Math.random() * opts.length) | 0]
                ia.tx = nx; ia.ty = ny
                ia.targetX = nx * T + T / 2; ia.targetY = ny * T + T
                ia.moving = true
                if (ia.staticTex) ia.sprite.texture = ia.staticTex
              } else ia.timer = 1200
            }
          }
        }
      }
      // Follow the scroll container every frame — scroll events are async on
      // iOS momentum scrolling, but only the camera is visible motion, so
      // reading the live scroll position here can never show a stale frame.
      syncCamera()
      // Hide static-layer chunks outside the camera view. Only in viewport
      // mode — the map-sized fallback canvas (Storybook) shows everything.
      const vp = viewportRef?.current
      if (vp) chunkCuller.update(ticker.deltaMS, vp.scrollLeft, vp.scrollTop, app.screen.width, app.screen.height)
      // Avatar animation + position report
      if (avatar) {
        // Report stage-space position (accounts for interior layer offset)
        const reportX = avatarInInterior ? intOffX + avatar.x : avatar.x
        const reportY = avatarInInterior ? intOffY + avatar.y : avatar.y
        if (Math.abs(reportX - _lastReportX) > 0.5 || Math.abs(reportY - _lastReportY) > 0.5) {
          onAvatarMoveRef.current(reportX, reportY)
          _lastReportX = reportX; _lastReportY = reportY
        }

        const walking = isWalking || interiorIsWalking
        if (walking && avatarFrames.length > 0) {
          avatarAnimTimer -= ticker.deltaMS
          if (avatarAnimTimer <= 0) {
            avatarAnimTimer = 200
            avatarAnimFrame = (avatarAnimFrame + 1) % avatarFrames.length
            avatar.texture = avatarFrames[avatarAnimFrame]
          }
        } else if (!walking && avatarBaseTexture && avatar.texture !== avatarBaseTexture) {
          avatar.texture = avatarBaseTexture
          avatarAnimTimer = 0
          avatarAnimFrame = 0
        }
      }

      let zDirty = false
      if (avatar && !avatarInInterior) {
        const nz = avatar.y
        if (nz !== avatar.zIndex) { avatar.zIndex = nz; zDirty = true }
      }
      for (const npc of unitNpcs) {
        const nz = npc.sprite.y
        if (nz !== npc.sprite.zIndex) { npc.sprite.zIndex = nz; zDirty = true }
      }
      if (zDirty) { spriteLayer.sortChildren(); worldLayer.sortChildren() }

      // NPC name tag proximity (exterior only) — show/fade intro state machine
      if (!interiorActive) {
        const [atx, aty] = currentTile
        for (const state of npcNameTags) {
          const { tag } = state
          const container = namedNpcContainers.get(state.npcId)
          const npcOnExterior = container?.visible ?? true
          const ws = namedNpcWalkStates.get(state.npcId)
          const ntx = ws?.currentTx ?? 0
          const nty = ws?.currentTy ?? 0
          const inRange = npcOnExterior && Math.max(Math.abs(ntx - atx), Math.abs(nty - aty)) <= 5

          if (inRange && !state.wasInRange) {
            state.phase = 'showing'
            state.timer = NAME_TAG_SHOW_MS
            state.bubbleReady = false
            tag.alpha = 1
            tag.visible = true
          } else if (!inRange && state.wasInRange) {
            state.phase = 'hidden'
            state.bubbleReady = false
            tag.visible = false
          }
          state.wasInRange = inRange

          if (inRange && state.phase === 'showing') {
            state.timer -= ticker.deltaMS
            if (state.timer <= 0) { state.phase = 'fading'; state.timer = NAME_TAG_FADE_MS }
          } else if (inRange && state.phase === 'fading') {
            state.timer -= ticker.deltaMS
            tag.alpha = Math.max(0, state.timer / NAME_TAG_FADE_MS)
            if (state.timer <= 0) { state.phase = 'hidden'; state.bubbleReady = true; tag.visible = false }
          }

          if (npcOnExterior && container?.children.length) {
            const s = container.children[0] as PIXI.Sprite
            tag.position.set(s.x, s.y - SPRITE_SIZE - 4)
          }
        }

        // Activity pose swap — use the activity pose sprite while the NPC is at its
        // post (not walking/indoors), the base sprite otherwise. While walking,
        // cycle the 3-frame walk animation instead, if one was authored.
        for (const [npcId, baseTex] of namedNpcBaseTex) {
          const ws = namedNpcWalkStates.get(npcId)
          const container = namedNpcContainers.get(npcId)
          const s = container?.children[0] as PIXI.Sprite | undefined
          if (!s) continue
          const animFrames = namedNpcAnimFrames.get(npcId)
          if (ws && ws.isWalking && animFrames && animFrames.length > 0) {
            ws.animTimer -= ticker.deltaMS
            if (ws.animTimer <= 0) {
              ws.animTimer = 200
              ws.animFrame = (ws.animFrame + 1) % animFrames.length
              s.texture = animFrames[ws.animFrame]
            }
            continue
          }
          if (ws) { ws.animFrame = 0; ws.animTimer = 0 }
          const activity = (ws && !ws.isWalking && !ws.isInside) ? namedNpcActivity.get(npcId) ?? null : null
          const poseTex = activity ? namedNpcPoseTex.get(`${npcId}:${activity}`) : undefined
          const wantTex = poseTex ?? baseTex
          if (s.texture !== wantTex) s.texture = wantTex
        }

        // Blocked path visibility and proximity speech bubbles
        refreshBlockedPathSolids()  // keep solid tiles in sync as quests clear
        for (const [, entry] of blockedPathEntries) {
          const cleared = isBlockedPathCleared(entry)
          for (const s of entry.blockedDecor) s.visible = !cleared
          for (const s of entry.clearedDecor) s.visible = cleared
          for (const n of entry.clearedNpcs) n.root.visible = cleared
          for (const n of entry.blockedNpcs) {
            n.root.visible = !cleared
            const dist = Math.max(Math.abs(n.tx - atx), Math.abs(n.ty - aty))
            const match = n.proximityDialogue.find(p => dist <= p.atDistance)
            const newText = (!cleared && match) ? match.text : null
            if (newText !== n.lastBubbleText) {
              if (n.bubble) { bubbleLayer.removeChild(n.bubble); n.bubble = null }
              if (newText !== null) {
                const cx = n.tx * T + T / 2
                const cy = n.ty * T + T
                n.bubble = createSpeechBubble(newText, cx, cy)
                bubbleLayer.addChild(n.bubble)
              }
              n.lastBubbleText = newText
            }
          }
        }

        // Building upgrade decor visibility (reveals/retires on purchase)
        if (upgradeDecorSprites.length > 0) {
          const levels = buildingUpgradeLevelsRef?.current ?? {}
          for (const u of upgradeDecorSprites) {
            u.sprite.visible = isVisibleAtLevel(u, levels[u.buildingId] ?? 0)
          }
        }

        // Building visual variants — show the sprites of the variant whose
        // [minLevel, nextLevel) range holds the current upgrade level.
        if (buildingVariantSprites.length > 0) {
          const levels = buildingUpgradeLevelsRef?.current ?? {}
          for (const v of buildingVariantSprites) {
            const lvl = levels[v.buildingId] ?? 0
            v.sprite.visible = lvl >= v.minLevel && lvl < v.nextLevel
          }
        }

        // Level-gated exterior NPCs — hide until their building reaches the level
        // (and again once hideAtLevel passes). When visible the normal schedule /
        // walk logic governs the container, so only force-hide here.
        if (levelGatedNpcs.length > 0) {
          const levels = buildingUpgradeLevelsRef?.current ?? {}
          for (const g of levelGatedNpcs) {
            if (!isVisibleAtLevel(g, levels[g.buildingId] ?? 0)) g.container.visible = false
          }
        }
      }

      // Named NPC proximity bubbles (dynamic content from npcProximityDialogue ref)
      if (!interiorActive && npcProximityDialogue) {
        const [atx, aty] = currentTile
        for (const [npcId, dialogues] of npcProximityDialogue.current) {
          const ws = namedNpcWalkStates.get(npcId)
          if (!ws || ws.isInside) { continue }
          const dist = Math.max(Math.abs(ws.currentTx - atx), Math.abs(ws.currentTy - aty))
          dialogues.sort((a, b) => a.atDistance - b.atDistance)
          const match = dialogues.find(p => dist <= p.atDistance)
          const newText = (match && !isNameTagBlockingBubble(npcId)) ? match.text : null
          const entry = namedNpcProximityBubbles.get(npcId) ?? { bubble: null, lastText: null }
          if (newText !== entry.lastText) {
            if (entry.bubble) { bubbleLayer.removeChild(entry.bubble); entry.bubble = null }
            if (newText !== null) {
              const cx = ws.currentTx * T + T / 2
              const cy = ws.currentTy * T + T
              entry.bubble = createSpeechBubble(newText, cx, cy)
              bubbleLayer.addChild(entry.bubble)
            }
            entry.lastText = newText
            namedNpcProximityBubbles.set(npcId, entry)
          }
        }
      }

      // Quest indicators — update visibility + bounce animation from questNpcState ref
      const activeIndicators = interiorActive ? interiorQuestIndicators : questIndicators
      const activeBaseY      = interiorActive ? interiorIndicatorBaseY  : questIndicatorBaseY
      for (const [npcId, ind] of activeIndicators) {
        const state = questNpcState?.current.get(npcId) ?? null
        // Also hide the indicator when the NPC has moved inside a building
        const npcOnExterior = namedNpcContainers.get(npcId)?.visible ?? true
        ind.visible = state !== null && (interiorActive || npcOnExterior)
        ind.text    = state === 'ready' ? '?' : '!'
        if (state !== null) {
          const baseY = activeBaseY.get(npcId) ?? ind.y
          ind.y = baseY + Math.sin(performance.now() / 400) * 3
        }
      }

      // Interactable indicators — visibility driven by condition flags (e.g. unread news)
      const activeInteractables = interiorActive ? interiorInteractables : exteriorInteractables
      for (const entry of activeInteractables.values()) {
        if (!entry.indicator || !entry.def.indicator) continue
        const on = interactableIndicatorsRef?.current.get(entry.def.indicator.condition) ?? false
        entry.indicator.visible = on
        if (on) entry.indicator.y = entry.indicatorBaseY + Math.sin(performance.now() / 400) * 3
      }

      // Interactable aura — faint pulse flagging tap-reactive objects (INTERACTABLE_AURA_* config at top of file)
      if (INTERACTABLE_AURA_ENABLED) {
        const phase = (Math.sin((performance.now() / INTERACTABLE_AURA_PULSE_PERIOD) * Math.PI * 2) + 1) / 2
        const auraAlpha = INTERACTABLE_AURA_PULSE_MIN + phase * (INTERACTABLE_AURA_PULSE_MAX - INTERACTABLE_AURA_PULSE_MIN)
        for (const entry of activeInteractables.values()) {
          if (entry.aura) entry.aura.alpha = auraAlpha
        }
      }

      // Named NPC schedule walk — fire walks when game hour changes
      if (!interiorActive && gameHourRef.current !== lastScheduleHourRef.current) {
        lastScheduleHourRef.current = gameHourRef.current
        for (const [npcId, container] of namedNpcContainers) {
          const npc = EXTERIOR_NPCS.find(n => n.id === npcId)
          if (!npc?.schedule) continue
          const ws = namedNpcWalkStates.get(npcId)
          if (!ws) continue
          namedNpcActivity.set(npcId, getNpcActivity(npc, gameHourRef.current))
          const newLoc = getNpcLocation(npc, gameHourRef.current)
          walkNamedNpc(npc, ws, container, newLoc)
        }
      }

      // Day↔night transition chime — fires once when the day phase flips.
      if (isNightRef.current !== _lastIsNight) {
        _lastIsNight = isNightRef.current
        if (!interiorActive) emitSound('dayNightChime')
      }

      // Crickets: outdoor night bed. Tracks night + indoor/outdoor in one place.
      const _wantCrickets = isNightRef.current && !interiorActive
      if (_wantCrickets !== _lastCrickets) {
        _lastCrickets = _wantCrickets
        setNightAmbiance(_wantCrickets)
      }

      // Night dimming — canvas 2D destination-out digs transparent torch-light holes.
      // nightAlpha fades in over dusk (19:30→20:00) and out over dawn (05:30→06:00).
      const _nh = getGameHour()
      const _nm = getGameMinute()
      let nightAlpha: number
      if (_nh >= 20 || _nh < 5 || (_nh === 5 && _nm < 30)) {
        nightAlpha = 1.0
      } else if (_nh === 19 && _nm >= 30) {
        nightAlpha = (_nm - 30) / 30
      } else if (_nh === 5 && _nm >= 30) {
        nightAlpha = 1 - (_nm - 30) / 30
      } else {
        nightAlpha = 0.0
      }
      if (nightAlpha > 0 && !interiorActive && avatar) {
        nightSprite.visible = true
        const _anyNpcWalking = unitNpcs.some(n => n.isWalking)
        // Fireflies and pulsing decor/item glows animate, so they must force a
        // redraw every frame (fireflies also drift). Computed once, reused below.
        const _fireflyGlows = animalSystem.getGlowSources()
        const _hasDynamicGlow = _fireflyGlows.length > 0
          || decorGlows.some(g => g.pulse) || pickupGlows.some(p => p.pulse)
        const _nightDirty = nightAlpha !== _lastNightAlpha
          || Math.abs(avatar.x - _lastNightAvatarX) > 0.5
          || Math.abs(avatar.y - _lastNightAvatarY) > 0.5
          || _anyNpcWalking
          || _hasDynamicGlow
        if (!_nightDirty) { /* skip canvas redraw — nothing visible changed */ } else {
        _lastNightAlpha = nightAlpha
        _lastNightAvatarX = avatar.x
        _lastNightAvatarY = avatar.y
        const cw = nightCanvas.width
        const ch = nightCanvas.height
        const cs = 1 / NIGHT_CANVAS_SCALE
        nightCtx.clearRect(0, 0, cw, ch)
        nightCtx.fillStyle = `rgba(0,8,32,${(0.80 * nightAlpha).toFixed(3)})`
        nightCtx.fillRect(0, 0, cw, ch)
        nightCtx.globalCompositeOperation = 'destination-out'
        // Avatar torch: radial gradient from fully transparent (innerR) to no-erase (outerR)
        const ax = avatar.x * cs, ay = avatar.y * cs
        const innerR = NIGHT_LIGHT_INNER * cs, outerR = NIGHT_LIGHT_OUTER * cs
        const grad = nightCtx.createRadialGradient(ax, ay, innerR, ax, ay, outerR)
        grad.addColorStop(0, 'rgba(0,0,0,1)')
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        nightCtx.fillStyle = grad
        nightCtx.beginPath()
        nightCtx.arc(ax, ay, outerR, 0, Math.PI * 2)
        nightCtx.fill()
        // Named NPC glows
        nightCtx.fillStyle = 'rgba(0,0,0,0.85)'
        for (const [, container] of namedNpcContainers) {
          if (container.visible && container.children.length > 0) {
            const s = container.children[0] as PIXI.Sprite
            const grad = nightCtx.createRadialGradient(s.x * cs, s.y * cs, 0, s.x * cs, s.y * cs, 8)
            grad.addColorStop(0, 'rgba(0,0,0,1)')
            grad.addColorStop(1, 'rgba(0,0,0,0)')            
            nightCtx.fillStyle = grad
            nightCtx.beginPath()
            nightCtx.arc(s.x * cs, s.y * cs, NIGHT_NPC_LIGHT_R * cs, 0, Math.PI * 2)
            nightCtx.fill()
          }
        }
        // Ambient NPC glows
        for (const npc of unitNpcs) {
          const grad = nightCtx.createRadialGradient(npc.sprite.x * cs, npc.sprite.y * cs, 0, npc.sprite.x * cs, npc.sprite.y * cs, 8)
          grad.addColorStop(0, 'rgba(0,0,0,1)')
          grad.addColorStop(1, 'rgba(0,0,0,0)')          
          nightCtx.fillStyle = grad
          nightCtx.beginPath()
          nightCtx.arc(npc.sprite.x * cs, npc.sprite.y * cs, NIGHT_NPC_LIGHT_R * 0.6 * cs, 0, Math.PI * 2)
          nightCtx.fill()
        }
        // Extra night lights: fireflies + glow-flagged decor / quest items.
        const _glowMs = performance.now()
        const _pulse  = (seed: number) => 0.8 + 0.2 * Math.sin(_glowMs / 500 + seed)
        const _extraGlows: GlowSource[] = [..._fireflyGlows, ...decorGlows]
        for (const pg of pickupGlows) {
          const ps = pickupSprites.get(pg.id)
          if (ps && ps.visible) _extraGlows.push({ x: ps.x + T / 2, y: ps.y + T / 2, radius: pg.radius, pulse: pg.pulse })
        }
        for (const g of _extraGlows) {
          const gx = g.x * cs, gy = g.y * cs
          const gr = (g.pulse ? g.radius * _pulse(g.x + g.y) : g.radius) * cs
          const grad = nightCtx.createRadialGradient(gx, gy, 0, gx, gy, gr)
          grad.addColorStop(0, 'rgba(0,0,0,1)')
          grad.addColorStop(1, 'rgba(0,0,0,0)')
          nightCtx.fillStyle = grad
          nightCtx.beginPath()
          nightCtx.arc(gx, gy, gr, 0, Math.PI * 2)
          nightCtx.fill()
        }
        nightCtx.globalCompositeOperation = 'source-over'
        nightTexture.source.update()
        } // end _nightDirty
      } else {
        nightSprite.visible = false
      }

      // Quest pickup visibility — only show while the associated quest is active
      for (const [pickupId, sprite] of pickupSprites) {
        if (pickedUpRef.current.has(pickupId)) continue
        const questId = pickupQuestIds.get(pickupId)
        sprite.visible = !questId || (activeQuestIdsRef?.current.has(questId) ?? true)
      }

      const _ghostTiles = interiorActive ? [] : unitNpcs.filter(g => g.isGhost).map(g => g.currentTile)

      for (const npc of unitNpcs) {
        if (npc.isWalking && npc.animFrames.length > 0) {
          npc.animTimer -= ticker.deltaMS
          if (npc.animTimer <= 0) {
            npc.animTimer = 200
            npc.animFrame = (npc.animFrame + 1) % npc.animFrames.length
            npc.sprite.texture = npc.animFrames[npc.animFrame]
          }
        } else if (!npc.isWalking && npc.animFrames.length > 0 && npc.animFrame !== 0) {
          npc.sprite.texture = npc.animFrames[0]
          npc.animFrame = 0
          npc.animTimer = 0
        }
        // Ghost glow: pulse alpha
        if (npc.isGhost) {
          npc.sprite.alpha = 0.25 + 0.2 * Math.sin(performance.now() / 600 + npc.currentTile[0])
        }

        if (!npc.isWalking) {
          npc.wanderTimer -= ticker.deltaMS
          if (npc.wanderTimer <= 0) {
            npc.wanderTimer = 2000 + Math.random() * 3000
            wanderNpc(npc)
          }
        }

        // Scared bubble: non-ghost NPCs near a ghost
        if (!npc.isGhost && !interiorActive) {
          const hasNearbyGhost = _ghostTiles.some(([gx, gy]) =>
            Math.max(Math.abs(npc.currentTile[0] - gx), Math.abs(npc.currentTile[1] - gy)) <= 10
          )
          if (hasNearbyGhost) {
            if (npc.scaredBubbleCooldown > 0) npc.scaredBubbleCooldown -= ticker.deltaMS
            if (!npc.scaredBubble && npc.scaredBubbleCooldown <= 0) {
              const phrase = SCARED_PHRASES[Math.floor(Math.random() * SCARED_PHRASES.length)]
              const bubble = createSpeechBubble(phrase, npc.sprite.x, npc.sprite.y - SPRITE_SIZE)
              bubble.zIndex = npc.sprite.zIndex + 1
              bubbleLayer.addChild(bubble)
              npc.scaredBubble      = bubble
              npc.scaredBubbleTimer = 10_000
            }
          } else {
            // Ghost left — remove bubble immediately and reset cooldown
            if (npc.scaredBubble) {
              bubbleLayer.removeChild(npc.scaredBubble)
              npc.scaredBubble = null
            }
            npc.scaredBubbleCooldown = 0
          }
          if (npc.scaredBubble) {
            npc.scaredBubbleTimer -= ticker.deltaMS
            npc.scaredBubble.position.set(npc.sprite.x, npc.sprite.y - SPRITE_SIZE)
            if (npc.scaredBubbleTimer <= 0) {
              bubbleLayer.removeChild(npc.scaredBubble)
              npc.scaredBubble         = null
              npc.scaredBubbleTimer    = 0
              npc.scaredBubbleCooldown = 10_000  // don't re-spawn while ghost is still nearby
            }
          }
        }
      }

      // Respawn ambient NPCs to maintain population between TARGET_NPC_COUNT ± a few
      if (!interiorActive && unitNpcs.length < TARGET_NPC_COUNT) {
        respawnTimer -= ticker.deltaMS
        if (respawnTimer <= 0) {
          spawnAmbientNpc()
          respawnTimer = 1500 + Math.random() * 1500  // stagger spawns 1.5–3s apart
        }
      } else {
        respawnTimer = Math.min(respawnTimer, 3000)
      }

      // Idle speech bubble state machine (exterior only)
      if (!interiorActive && npcBubbleTargets.length > 0) {
        const now = performance.now()
        if (isWalking) lastMovedMs = now

        if (now - lastMovedMs >= IDLE_THRESHOLD_MS && activeBubbles.length < MAX_BUBBLES) {
          nextSpawnTimer -= ticker.deltaMS
          if (nextSpawnTimer <= 0) {
            lastBubbleIdx = (lastBubbleIdx + 1) % npcBubbleTargets.length
            const { npc, cx, cy } = npcBubbleTargets[lastBubbleIdx]
            // Don't show bubble for NPCs that have moved inside a building, or
            // whose name tag intro is currently playing
            if (!isNameTagBlockingBubble(npc.id) && namedNpcContainers.get(npc.id)?.visible !== false) {
              const didx = npcDialogueIndex.get(npc.id) ?? 0
              const pool = getNpcDialoguePool(npc, gameHourRef.current)
              const line = pool[didx % pool.length]
              const container = createSpeechBubble(line, cx, cy)
              bubbleLayer.addChild(container)
              activeBubbles.push({ container, timer: BUBBLE_SHOW_MS, phase: 'showing', npcId: npc.id })
            }
            nextSpawnTimer = SLOT_STAGGER_MS
          }
        }

        for (let i = activeBubbles.length - 1; i >= 0; i--) {
          const slot = activeBubbles[i]
          // Drop the bubble at once if its NPC has walked indoors (sprite hidden).
          if (namedNpcContainers.get(slot.npcId)?.visible === false) {
            bubbleLayer.removeChild(slot.container)
            activeBubbles.splice(i, 1)
            continue
          }
          slot.timer -= ticker.deltaMS
          if (slot.phase === 'showing' && slot.timer <= 0) {
            slot.phase = 'fading'; slot.timer = BUBBLE_FADE_MS
          } else if (slot.phase === 'fading') {
            slot.container.alpha = Math.max(0, slot.timer / BUBBLE_FADE_MS)
            if (slot.timer <= 0) {
              bubbleLayer.removeChild(slot.container)
              activeBubbles.splice(i, 1)
            }
          }
        }
      }

      // Friendship reactions — rise + fade, tracking the NPC's live sprite
      // position each tick; dropped at once if the NPC walks indoors mid-flight.
      for (let i = activeReactions.length - 1; i >= 0; i--) {
        const r = activeReactions[i]
        const npcContainer = namedNpcContainers.get(r.npcId)
        const sprite = npcContainer?.children[0] as PIXI.Sprite | undefined
        if (!npcContainer || npcContainer.visible === false || !sprite) {
          bubbleLayer.removeChild(r.text)
          activeReactions.splice(i, 1)
          continue
        }
        r.elapsed += ticker.deltaMS
        const t = r.elapsed / REACTION_MS
        if (t >= 1) {
          bubbleLayer.removeChild(r.text)
          activeReactions.splice(i, 1)
          continue
        }
        r.text.position.set(sprite.x, sprite.y - SPRITE_SIZE - 4 - t * 20)
        r.text.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4
      }
      } catch (e) {
        const now = Date.now()
        if (now - _tickerErrorTs > 5000) {
          _tickerErrorTs = now
          rollbar.error('[HubTownCanvas] ticker error', { error: String(e) })
        }
      }
    })
  }, { resizeTo: viewportRef })

  return (
    // The map-sized spacer preserves the parent scroll range; the sticky inner
    // div pins the viewport-sized canvas to the scrollport while scrolling
    // moves the camera. Without viewportRef the canvas is map-sized and fills
    // the spacer, matching the old layout.
    <div style={{ position: 'relative', flexShrink: 0, width: MAP_W, height: MAP_H }}>
      <div
        ref={containerRef}
        style={{ position: 'sticky', top: 0, left: 0, width: 'fit-content', height: 'fit-content' }}
      />
    </div>
  )
}
