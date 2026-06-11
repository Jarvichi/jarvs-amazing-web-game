import React, { useState, useMemo } from 'react'
import { BASE_CHIP_TILES } from '../../data/tiles/baseChipIndex'
import { EXTENDED_TILE_REFS } from '../../data/tiles/tileIndex'
import { getAllBundles } from '../../data/bundles/bundleLoader'
import type { Zlayer } from './mapEditorTypes'

const SHEET_URL = '/world/SampleMap/[Base]BaseChip_pipo.png'
const COLS = 8
const T = 32

// Tile categories: ordered groups of tile keys shown in the palette
const TILE_CATEGORIES: Record<string, string[]> = {
  'Ground': [
    'lightGrass', 'mediumGrass', 'darkGrass', 'dyingGrass',
    'sand', 'lightDirt', 'mediumDirt', 'darkDirt',
  ],
  'Flooring': [
    'woodFloor', 'darkWoodFloor', 'parquetFloor', 'darkParquetFloor',
    'stoneFloor', 'cobblestoneFloor', 'smallStoneFloor', 'darkStoneFloor',
    'darkCobblestoneFloor', 'checkeredFloor', 'darkCheckeredFloor',
    'quarteredFloor', 'darkQuarteredFloor', 'diagonalFloor', 'darkDiagonalFloor',
    'fourByFourTileFloor', 'darkFourByFourTileFloor',
    'ornateFloor', 'blueOrnateFloor', 'meshFloor', 'lightMeshFloor',
    'goldSmallTileFloor', 'redCarpetFloor', 'yellowCarpetFloor',
    'fullLadderTop', 'halfLadderTop', 'ladderBottom', 'ladderIntoFloor',
    'stepsUpFromLeft', 'stepsUpFromRight',
  ],
  'Plants & Nature': [
    'lightBush', 'darkBush', 'autumnBush', 'deadBush',
    'grassTuft', 'smallGrass', 'deadGrassTuft', 'deadSmallGrass',
    'whiteFlower', 'pinkFlower', 'blueFlower', 'yellowFlower',
    'brownMushroom', 'purpleMushroom',
    'smallLilypad', 'largeLilypad',
    'lightPuddle', 'darkPuddle', 'greenPuddle',
    'tallBushTop', 'tallBushPot', 'spikyPlantTop', 'spikyPlantBottom',
    'potOfFlowers', 'emptyPotOfFlowers', 'flowerPotLeft',
  ],
  'Trees': [
    'lightTreeTopLeft', 'lightTreeTopRight',
    'lightTreeBottomLeft', 'lightTreeBottomRight',
    'lightTreeColumnLeft', 'lightTreeColumnRight',
    'darkTreeTopLeft', 'darkTreeTopRight',
    'darkTreeBottomLeft', 'darkTreeBottomRight',
    'autumnTreeTopLeft', 'autumnTreeTopRight',
    'autumnTreeBottomLeft', 'autumnTreeBottomRight',
    'deadTreeTopLeft', 'deadTreeTopRight',
    'deadTreeBottomLeft', 'deadTreeBottomRight',
    'smallStump', 'largeStump',
    'logLeft', 'logRight', 'logTop', 'logBottom',
  ],
  'Rocks & Natural': [
    'smallRock', 'largeRock', 'hole',
    'graveStone', 'graveWoodenCross',
    'campfireUnlit', 'summoningCircle',
    'goldenCross', 'stoneCross',
  ],
  'Fences': [
    'fenceIsolated', 'fenceLeft', 'fenceRight', 'fenceTop', 'fenceTopBottom',
    'fenceLeftRight', 'fenceTopRight', 'fenceLeftTop',
    'fenceTopRightBottom', 'fenceLeftTopBottom', 'fenceRightBottom', 'fenceLeftBottom',
    'fenceLeftRightTop', 'fenceLeftRightBottom', 'fenceLeftRightTopBottom',
    'ironFenceIsolated', 'ironFenceLeft', 'ironFenceRight', 'ironFenceTop',
    'ironFenceLeftRight', 'ironFenceTopRight', 'ironFenceLeftTop',
    'ironFenceTopRightBottom', 'ironFenceLeftTopBottom',

    'stoneWallTopBotton',
    'stoneWallBotton',
    'stoneWallRightBottom',
    'stoneWallLeftBottom',
    'stoneWallLeft',
    'stoneWallLeftRightTop',
    'stoneWallLeftRightBottom',
    'stoneWallLeftRightTopBottom',
    'stoneWallLeftRight',
    'stoneWallTop',
    'stoneWallTopRight',
    'stoneWallLeftTop',
    'stoneWallRight',
    'stoneWallTopRightBottom',
    'stoneWallLeftTopBottom',
    'stoneWallIsolated',

  ],
  'Furniture': [
    'roundTable', 'roundTableWithCloth', 'deskTop',
    'smallTableTopLeft', 'smallTableTopMiddle', 'smallTableTopRight',
    'smallTableMiddleLeft', 'smallTableMiddleMiddle', 'smallTableMiddleRight',
    'smallTableBottomLeft', 'smallTableBottomMiddle', 'smallTableBottomRight',
    'bookshelfTop', 'bookshelfBottom',
    'stool', 'stoolDark', 'stoolWithCover', 'stoolWithPurpleCushion',
    'rugTopLeft','rugTopMid', 'rugTopRight', 'rugBottomLeft', 'rugBottomRight',
    'simpleBedHead', 'simpleBedFoot', 'simpleBedHeadOverlay', 'simpleBedFootOverlay',
    'normalBedHead', 'normalBedFoot', 'normalBedHeadOverlay', 'normalBedFootOverlay',
    'royalBedTopLeft', 'royalBedTopRight', 'royalBedBottonLeft', 'royalBedBottomRight',
    'royalBedTopLeftOverlay', 'royalBedTopRightOverlay',
    'royalBedBottonLeftOverlay', 'royalBedBottomRightOverlay',
    'cauldren',
  ],
  'Storage & Items': [
    'barrel', 'crate', 'openCrate', 'sack', 'pileOfSacks',
    'chest', 'openChest', 'strongChest', 'openStrongChest', 'goldChest', 'openGoldChest',
    'lightPotWithLid', 'lightPotWithoutLid', 'darkPotWithLid', 'darkPotWithoutLid',
    'fullBucket', 'emptyBucket', 'logPile', 'choppingBlock',
    'hayStack', 'emptyBasket', 'appleBasket', 'leafBasket', 'mushroomBasket',
    'smallChest', 'gift', 'pileOfCoins',
    'mugOfCoffee', 'teapot', 'cupOfTea', 'rolledMap', 'note', 'pileOfPapers',
    'quilAndInk', 'smallSack', 'bunchOfHerbs',
    'closedBook', 'openBook', 'blueclosedBook', 'blueopenBook',
    'blackclosedBook', 'blackopenBook', 'greenclosedBook', 'greenopenBook',
    'plateEmpty', 'bottlesOfLiquor', 'potions', 'pendant',
    'sword', 'axe', 'skull', 'key', 'shieldMounted',
    'wallClock', 'wallClock2', 'mirrorTop', 'mirrorBottom', 'painting',
    'candlestickLitTop', 'candlestickLitBottom', 'candlestickUnlit',
    'wallNotes', 'wallNotesTop', 'wallNotesBottom', 'wantedPosterTop', 'wantedPosterBottom',
    'crownOfCushon', 'teddy', 'doll', 'toy',
  ],
  'Exterior Decor': [
    'stoneWell', 'bucketAndRope', 'mailBox',
    'roadSignTop', 'roadSignBottom', 'smallSign', 'mediumSign', 'largeSign',
    'messageBoardTopLeft', 'messageBoardTopRight',
    'messageBoardBottomLeft', 'messageBoardBottomRight',
    'lampPostTop', 'lampPostBottom',
    'benchLeft', 'benchMiddle', 'benchRight',
    'darkPillarTop', 'darkPillarMiddle', 'darkPillarBottom',
    'lightPillarTop', 'lightPillarMiddle', 'lightPillarBottom',
    'birdBathTop', 'birdBathMiddle', 'birdBathBottom',
    'brazierTop', 'brazierBottom',
    'knightTop', 'knightBottom',
    'angelStatueTop', 'angelStatueBottom',
    'gargoyleTop', 'gargoyleBottom',
    'memorialTopLeft', 'memorialTopRight', 'memorialBotLeft', 'memorialBotRight',
    'stripedShopAwningTop', 'stripedShopAwningMiddle', 'stripedShopAwningBottom',
    'stripedShopAwningWithSupport', 'stripedShopAwningSupportPillar', 'stripedShopAwningSupportPillarBot',
    'plainShowAwningTop', 'plainShowAwningMiddle', 'plainShowAwningBottom',
    'fountainTopLeft', 'fountainTopMiddle', 'fountainTopRight',
    'fountainMidLeft', 'fountainMidMiddle', 'fountainMidRight',
    'fountainBotLeft', 'fountainBotMiddle', 'fountainBotRight',
    'boardwalkVertical', 'boardwalkHorizontal',
    'boardwalkVerticalSupport', 'boardwalkHorizontalSupport',
    'chimneyTop', 'chimneyMiddle', 'chimneyBottom', 'chimneyShort',
    'portcullisTopLeft', 'portcullisTopRight', 'portcullisBottomLeft', 'portcullisBottomRight',
    'bellTowerTop', 'bellTowerBottom',
    'worldMapTopLeft', 'worldMapTopRight', 'worldMapBottomLeft', 'worldMapBottomRight',
  ],
  'Signs': [
    'weaponsSign', 'armourSign', 'bagSign', 'foodSign', 'drinkSign',
    'teaSign', 'magicSign', 'ringSign', 'innSign', 'healthSign',
    'appleSign', 'bookSign', 'goldSign', 'wolfSign', 'skullSign', 'blankSign',
  ],
  'Windows & Doors': [
    'windowTop', 'windowBottom', 'windowTop2', 'windowBottom2',
    'windowTop3', 'windowBottom3', 'windowTop4', 'windowBottom4',
    'doorTop', 'doorBottom',
    'strongDoorTopLeft', 'strongDoorTopRight',
    'strongDoorBottomLeft', 'strongDoorBottomRight',
  ],
  'Farming': [
    'topLeftPlough', 'topPlough', 'topRightPlough',
    'leftPlough', 'centerPlough', 'rightPlough',
    'bottomLeftPlough', 'bottomPlough', 'bottomRightPlough', 'isolatedPlough',
    'scarecrowTop', 'scarecrowBottom',
    'cropShoot', 'cropWheatTop', 'cropWheatMiddle', 'cropWheatBottom',
    'cropCarrot', 'cropSpinach', 'cropDead',
    'cropPumkin', 'cropLettuce', 'cropRose', 'cropBeans', 'cropBerries',
  ],
  'Washing & Misc': [
    'washingLineEmptyTopLeft', 'washingLineEmptyTopRight',
    'washingLineEmptyBottomLeft', 'washingLineEmptyBottomRight',
    'washingLineTopLeft', 'washingLineTopRight',
    'washingLineBottomLeft', 'washingLineBottomRight',
    'washingLineClothesTopLeft', 'washingLineClothesTopRight',
    'washingLineClothesBottomLeft', 'washingLineClothesBottomRight',
    'stoneStairsUpLeftTop', 'stoneStairsUpRightTop',
    'stoneStairsUpLeftMiddle', 'stoneStairsUpMiddleMiddle', 'stoneStairsUpRightMiddle',
    'stoneStairsUpLeftBottom', 'stoneStairsUpMiddleBottom', 'stoneStairsUpRightBottom',
  ],
  'Crystals': [
    'black_crystal1', 'black_crystal2', 'black_crystal3', 'black_crystal4',
    'blue_crystal1', 'blue_crystal2', 'blue_crystal3', 'blue_crystal4',
    'dark_red_crystal1', 'dark_red_crystal2', 'dark_red_crystal3', 'dark_red_crystal4',
    'green_crystal1', 'green_crystal2', 'green_crystal3', 'green_crystal4',
    'pink_crystal1', 'pink_crystal2', 'pink_crystal3', 'pink_crystal4',
    'red_crystal1', 'red_crystal2', 'red_crystal3', 'red_crystal4',
    'violet_crystal1', 'violet_crystal2', 'violet_crystal3', 'violet_crystal4',
    'white_crystal1', 'white_crystal2', 'white_crystal3', 'white_crystal4',
    'yellow_green_crystal1', 'yellow_green_crystal2', 'yellow_green_crystal3', 'yellow_green_crystal4',
    'yellow_crystal1', 'yellow_crystal2', 'yellow_crystal3', 'yellow_crystal4',
  ],
  'All': Object.keys(BASE_CHIP_TILES),
}

type PaletteTab = 'tiles' | 'bundles'

interface Props {
  activeTileId:   string | null
  activeBundleId: string | null
  activeZlayer:   Zlayer
  onSelectTile:   (tileId: string) => void
  onSelectBundle: (bundleId: string) => void
  onZlayerChange: (z: Zlayer) => void
}

function TileCell({
  tileKey,
  numericId,
  isSelected,
  onClick,
}: {
  tileKey: string
  numericId: number
  isSelected: boolean
  onClick: () => void
}) {
  let bgImage: string
  let bgPos: string
  let bgSize: string | undefined

  if (numericId >= 10000) {
    const ref = EXTENDED_TILE_REFS[numericId]
    if (ref) {
      const col = ref.id % ref.columns
      const row = Math.floor(ref.id / ref.columns)
      bgImage = `url("${ref.file}")`
      bgPos = ref.columns === 1 ? '0 0' : `-${col * T}px -${row * T}px`
      bgSize = ref.columns === 1 ? `${T}px ${T}px` : undefined
    } else {
      bgImage = 'none'
      bgPos = '0 0'
    }
  } else {
    const col = numericId % COLS
    const row = Math.floor(numericId / COLS)
    bgImage = `url("${SHEET_URL}")`
    bgPos = `-${col * T}px -${row * T}px`
  }

  return (
    <div
      title={tileKey}
      onClick={onClick}
      style={{
        width:              T,
        height:             T,
        backgroundImage:    bgImage,
        backgroundPosition: bgPos,
        backgroundRepeat:   'no-repeat',
        backgroundSize:     bgSize,
        imageRendering:     'pixelated',
        cursor:             'pointer',
        outline:            isSelected ? '2px solid #f0c040' : '1px solid transparent',
        outlineOffset:      '-1px',
        flexShrink:         0,
      }}
    />
  )
}

export function TilePalette({ activeTileId, activeBundleId, activeZlayer, onSelectTile, onSelectBundle, onZlayerChange }: Props) {
  const [tab, setTab]         = useState<PaletteTab>('tiles')
  const [search, setSearch]   = useState('')
  const [openCats, setOpenCats] = useState<Set<string>>(() => new Set(['Exterior Decor', 'Furniture', 'Storage & Items']))

  const bundles = useMemo(() => getAllBundles(), [])

  const toggleCat = (cat: string) => {
    setOpenCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return TILE_CATEGORIES
    const q = search.toLowerCase()
    const result: Record<string, string[]> = {}
    for (const [cat, keys] of Object.entries(TILE_CATEGORIES)) {
      const matched = keys.filter(k => k.toLowerCase().includes(q))
      if (matched.length > 0) result[cat] = matched
    }
    return result
  }, [search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1a1a2e', color: '#ccc', fontSize: 12 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
        {(['tiles', 'bundles'] as PaletteTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '6px 0', background: tab === t ? '#2a2a4e' : 'transparent',
              border: 'none', color: tab === t ? '#f0c040' : '#888', cursor: 'pointer',
              fontWeight: tab === t ? 'bold' : 'normal', fontSize: 12,
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'tiles' && (
        <>
          {/* Z-layer selector */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid #333', display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ color: '#888', marginRight: 4 }}>Z:</span>
            {(['solid', 'below', 'above'] as Zlayer[]).map(z => (
              <button
                key={z}
                onClick={() => onZlayerChange(z)}
                style={{
                  padding: '2px 6px', fontSize: 11, cursor: 'pointer',
                  background: activeZlayer === z ? '#f0c040' : '#333',
                  color: activeZlayer === z ? '#1a1a2e' : '#aaa',
                  border: 'none', borderRadius: 3,
                }}
              >
                {z}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid #333' }}>
            <input
              type="text"
              placeholder="Search tiles…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '4px 6px', background: '#111', border: '1px solid #444',
                color: '#ccc', borderRadius: 3, fontSize: 12, boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Tile categories */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {Object.entries(filteredCategories).map(([cat, keys]) => (
              <div key={cat}>
                <button
                  onClick={() => toggleCat(cat)}
                  style={{
                    width: '100%', padding: '5px 8px', background: '#252540',
                    border: 'none', borderBottom: '1px solid #333', color: '#bbb',
                    textAlign: 'left', cursor: 'pointer', fontSize: 11, fontWeight: 'bold',
                    display: 'flex', justifyContent: 'space-between',
                  }}
                >
                  <span>{cat}</span>
                  <span style={{ color: '#666' }}>{openCats.has(cat) || search ? '▼' : '▶'}</span>
                </button>
                {(openCats.has(cat) || !!search.trim()) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', padding: 4, gap: 2, background: '#111' }}>
                    {keys.map(key => {
                      const id = (BASE_CHIP_TILES as Record<string, number>)[key]
                      if (id === undefined) return null
                      return (
                        <TileCell
                          key={key}
                          tileKey={key}
                          numericId={id}
                          isSelected={activeTileId === key}
                          onClick={() => onSelectTile(key)}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'bundles' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {bundles.map(bundle => {
              const firstDecor = bundle.tiles.find(t => t.type === 'decor')
              const previewId = firstDecor?.tileId ?? 0
              const col = previewId % COLS
              const row = Math.floor(previewId / COLS)
              const isSelected = activeBundleId === bundle.bundleID
              return (
                <div
                  key={bundle.bundleID}
                  title={bundle.bundleID}
                  onClick={() => onSelectBundle(bundle.bundleID)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    cursor: 'pointer', padding: 4,
                    background: isSelected ? '#2a2a4e' : '#1a1a2e',
                    border: isSelected ? '1px solid #f0c040' : '1px solid #333',
                    borderRadius: 4, minWidth: 56,
                  }}
                >
                  <div
                    style={{
                      width: T, height: T,
                      backgroundImage: `url("${SHEET_URL}")`,
                      backgroundPosition: `-${col * T}px -${row * T}px`,
                      backgroundRepeat: 'no-repeat',
                      imageRendering: 'pixelated',
                    }}
                  />
                  <span style={{ fontSize: 10, color: '#aaa', textAlign: 'center', wordBreak: 'break-all', maxWidth: 64 }}>
                    {bundle.bundleID}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
