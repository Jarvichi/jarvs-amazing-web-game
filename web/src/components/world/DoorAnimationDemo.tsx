import React, { useEffect, useState } from 'react'
import { resolveTileRef } from '../../data/tiles/tileIndex'
import { DOOR_STYLE_BY_MATERIAL, getDoorFrameTiles, DoorFrame, DoorRole } from '../../data/tiles/doorTiles'
import type { WallMaterial } from '../../data/tiles/buildingMaterials'

const TILE = 32
const SCALE = 3
// closed(0) hold, opening(1), open(2) hold, opening(1), back to closed — a full swing cycle
const FRAME_SEQUENCE: DoorFrame[] = [0, 0, 0, 1, 2, 2, 2, 2, 1]
const STEP_MS = 260

function TileImg({ globalId }: { globalId: number }) {
  const ref = resolveTileRef(globalId)
  const w = TILE * SCALE
  const h = TILE * SCALE
  return (
    <div
      style={{
        width: w,
        height: h,
        backgroundImage: `url(${ref.file})`,
        backgroundPosition: `-${ref.id % ref.columns * w}px -${Math.floor(ref.id / ref.columns) * h}px`,
        backgroundSize: `${ref.columns * w}px auto`,
        imageRendering: 'pixelated',
      }}
    />
  )
}

function DoorSprite({ material, frame }: { material: WallMaterial; frame: DoorFrame }) {
  const tiles = getDoorFrameTiles(material, frame)
  const doubleLeaf = DOOR_STYLE_BY_MATERIAL[material].doubleLeaf
  const roles: DoorRole[] = ['Above', 'Top', 'Bottom']
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {roles.map(role => (
        <div key={role} style={{ display: 'flex' }}>
          {tiles[role].map((gid, i) => <TileImg key={i} globalId={gid} />)}
        </div>
      ))}
      <div style={{ fontSize: 10, color: '#888', marginTop: 4, textAlign: 'center' }}>
        {material}{doubleLeaf ? ' (double-leaf)' : ''}
      </div>
    </div>
  )
}

export function DoorAnimationDemo() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setStep(s => (s + 1) % FRAME_SEQUENCE.length), STEP_MS)
    return () => clearInterval(id)
  }, [])
  const frame = FRAME_SEQUENCE[step]
  const materials = Object.keys(DOOR_STYLE_BY_MATERIAL) as WallMaterial[]

  return (
    <div style={{ fontFamily: 'monospace', padding: 16, display: 'flex', flexWrap: 'wrap', gap: 24, background: '#111' }}>
      {materials.map(material => (
        <DoorSprite key={material} material={material} frame={frame} />
      ))}
    </div>
  )
}
