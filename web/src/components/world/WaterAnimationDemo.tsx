import React, { useEffect, useState } from 'react'
import { PATH, PATH_TILE, PATH_TILE_ANIM, TileAnim } from '../../data/tiles/tileIndex'

const TILE = 32
const SCALE = 4

// A handful of representative combo tiles (straight, turn, all-sides) so the
// animation is easy to see across different path shapes.
const DEMO_VARIANTS = [PATH.horizontal, PATH.vertical, PATH.turnBottomRight, PATH.allSides]

function WaterTile({ file, anim, variant, frame }: { file: string; anim: TileAnim; variant: number; frame: number }) {
  const w = TILE * SCALE
  const totalCols = anim.columns * anim.frameCount
  const row = Math.floor(variant / anim.columns)
  const col = (variant % anim.columns) + frame * anim.columns
  return (
    <div
      style={{
        width: w,
        height: w,
        backgroundImage: `url(${file})`,
        backgroundPosition: `-${col * w}px -${row * w}px`,
        backgroundSize: `${totalCols * w}px auto`,
        imageRendering: 'pixelated',
      }}
    />
  )
}

export function WaterAnimationDemo() {
  const [frame, setFrame] = useState(0)
  const files = [PATH_TILE.water1, PATH_TILE.water2, PATH_TILE.water3, PATH_TILE.water4, PATH_TILE.water5, PATH_TILE.water6, PATH_TILE.water7]

  useEffect(() => {
    const id = setInterval(() => setFrame(f => f + 1), 150)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ fontFamily: 'monospace', padding: 16, background: '#111' }}>
      {files.map(file => {
        const anim = PATH_TILE_ANIM[file]
        const currentFrame = frame % anim.frameCount
        return (
          <div key={file} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ color: '#888', fontSize: 11, width: 220 }}>{file.split('/').pop()}</span>
            <div style={{ display: 'flex', gap: 2 }}>
              {DEMO_VARIANTS.map(v => (
                <WaterTile key={v} file={file} anim={anim} variant={v} frame={currentFrame} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
