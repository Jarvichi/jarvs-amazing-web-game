// A contact sheet of wandering-NPC looks, rendered through the same PIXI
// tinting path the hub town uses. Walking a town to judge the art is slow (you
// meet a dozen wanderers at a time, and only the ones near the camera), so this
// puts a whole crowd side by side: palette clashes, layer misalignment and
// missing art all show up at a glance.
import { useRef } from 'react'
import * as PIXI from 'pixi.js'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { usePixiApp } from '../../hooks/usePixiApp'
import { loadSpriteTexture, loadAnimFrames } from '../../utils/pixiHelpers'
import { createAmbientRoster } from '../../game/hub/ambientNpcIdentity'
import type { AmbientNpcLook } from '../../game/hub/ambientNpcIdentity'
import { townsfolkLayers } from '../../data/townsfolk'
import type { TownsfolkLayer } from '../../data/townsfolk'

const CELL = 72
const COLS = 8
const SPRITE = 56

function lookSpec(look: AmbientNpcLook): { base: TownsfolkLayer; overlays: TownsfolkLayer[] } {
  if (look.kind === 'townsfolk') return townsfolkLayers(look)
  return { base: { slug: look.slug, tint: 0xffffff, animated: true, z: 0 }, overlays: [] }
}

function Gallery({ count, seed, unitSlugs, walking }: {
  count: number
  seed: string
  unitSlugs: string[]
  walking: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const rows = Math.ceil(count / COLS)

  usePixiApp(hostRef, COLS * CELL, rows * (CELL + 16), app => {
    app.renderer.background.color = 0x6a8f5a
    const roster = createAmbientRoster({ seed, unitSlugs })

    for (let i = 0; i < count; i++) {
      const npc  = roster.mint()
      const spec = lookSpec(npc.look)
      const cx = (i % COLS) * CELL + CELL / 2
      const cy = Math.floor(i / COLS) * (CELL + 16) + CELL

      const label = new PIXI.Text({
        text: npc.name,
        style: { fontSize: 8, fill: '#ffffff', fontFamily: 'monospace' },
      })
      label.anchor.set(0.5, 0)
      label.position.set(cx, cy + 2)
      app.stage.addChild(label)

      for (const layer of [spec.base, ...spec.overlays].sort((a, b) => a.z - b.z)) {
        loadSpriteTexture(layer.slug).then(tex => {
          if (app.renderer == null) return
          const s = new PIXI.Sprite(tex)
          s.width = SPRITE; s.height = SPRITE
          s.anchor.set(0.5, 1)
          s.position.set(cx, cy)
          s.tint = layer.tint
          app.stage.addChild(s)
          if (!walking || !layer.animated) return
          // Cycle the walk frames so a mis-registered layer is obvious in motion.
          loadAnimFrames(layer.slug, 3).then(frames => {
            let frame = 0
            let elapsed = 0
            app.ticker.add(t => {
              elapsed += t.deltaMS
              if (elapsed < 200 || s.destroyed) return
              elapsed = 0
              frame = (frame + 1) % frames.length
              s.texture = frames[frame]
            })
          }).catch(() => {})
        }).catch(() => {})
      }
    }
  })

  return <div ref={hostRef} />
}

const meta = {
  component: Gallery,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Gallery>

export default meta
type Story = StoryObj<typeof meta>

/** Composite townsfolk only — the case the new art exists for. */
export const Townsfolk: Story = {
  args: { count: 32, seed: 'gallery', unitSlugs: [], walking: false },
}

/** Mid-stride, so a layer that drifts out of register with the body shows up. */
export const TownsfolkWalking: Story = {
  args: { count: 32, seed: 'gallery', unitSlugs: [], walking: true },
}

/** The mix a real town shows: composite townsfolk alongside card-unit sprites. */
export const MixedCrowd: Story = {
  args: {
    count: 32,
    seed: 'ravenwatch',
    unitSlugs: ['hub-npc-elder', 'hub-npc-merchant', 'hub-npc-scholar', 'knight', 'archer', 'farmer'],
    walking: false,
  },
}
