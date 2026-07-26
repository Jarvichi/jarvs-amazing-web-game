import React from 'react'
import type { SelectedEntity, RoadDef, TerrainObstacle, TerrainType, EditTarget, BattlefieldDecorItem, TerrainPathDef } from './battlefieldEditorTypes'
import { WORLD_PATH_TILE, WORLD_DECOR, WORLD_DECOR_FILE } from '../../data/tiles/worldTileIndex'
import { getBattlefieldBundleById } from '../../data/bundles/battlefieldBundleLoader'

const TERRAIN_TYPES: TerrainType[] = ['rock', 'tree', 'water', 'ruin']
const ROAD_TILE_OPTIONS = Object.entries(WORLD_PATH_TILE)
const DECOR_TILE_OPTIONS = Object.entries(WORLD_DECOR) as Array<[string, number]>
const DECOR_COLS = 8

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: 'block', fontSize: 11, opacity: 0.7, marginBottom: 2 }}>{label}</label>
      {children}
    </div>
  )
}

function numInput(value: number, onChange: (v: number) => void) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) onChange(v) }}
      style={{ width: 70 }}
    />
  )
}

interface RoadInspectorProps {
  roadIndex: number
  road: RoadDef
  onUpdateRoad: (roadIndex: number, patch: Partial<Pick<RoadDef, 'width' | 'tileFile' | 'zIndex'>>) => void
  onMoveRoadPoint: (roadIndex: number, pointIndex: number, x: number, y: number) => void
  onDeleteRoad: (roadIndex: number) => void
  onDeleteRoadPoint: (roadIndex: number, pointIndex: number) => void
}

function RoadInspector({ roadIndex, road, onUpdateRoad, onMoveRoadPoint, onDeleteRoad, onDeleteRoadPoint }: RoadInspectorProps) {
  return (
    <div>
      <h4 style={{ margin: '0 0 8px' }}>Road #{roadIndex + 1}</h4>
      <Field label="Width (tiles)">
        {numInput(road.width ?? 2, v => onUpdateRoad(roadIndex, { width: Math.max(1, Math.round(v)) }))}
      </Field>
      <Field label="Tileset">
        <select
          value={road.tileFile ?? ''}
          onChange={e => onUpdateRoad(roadIndex, { tileFile: e.target.value || undefined })}
          style={{ width: '100%' }}
        >
          <option value="">(environment default)</option>
          {ROAD_TILE_OPTIONS.map(([key, file]) => <option key={key} value={file}>{key}</option>)}
        </select>
      </Field>
      <Field label="Z-order">
        {numInput(road.zIndex ?? 1, v => onUpdateRoad(roadIndex, { zIndex: Math.round(v) }))}
      </Field>
      <Field label={`Waypoints (${road.points.length})`}>
        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
          {road.points.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, opacity: 0.6, width: 14 }}>{i + 1}</span>
              {numInput(Math.round(p.x), v => onMoveRoadPoint(roadIndex, i, v, p.y))}
              {numInput(Math.round(p.y), v => onMoveRoadPoint(roadIndex, i, p.x, v))}
              <button onClick={() => onDeleteRoadPoint(roadIndex, i)} disabled={road.points.length <= 2} title="Delete waypoint">×</button>
            </div>
          ))}
        </div>
      </Field>
      <button onClick={() => onDeleteRoad(roadIndex)}>Delete Road</button>
    </div>
  )
}

interface ObstacleInspectorProps {
  index: number
  obstacle: TerrainObstacle
  onUpdateObstacle: (index: number, patch: Partial<Pick<TerrainObstacle, 'type' | 'radius' | 'zIndex'>>) => void
  onMoveObstacle: (index: number, x: number, y: number) => void
  onDeleteObstacle: (index: number) => void
}

function ObstacleInspector({ index, obstacle, onUpdateObstacle, onMoveObstacle, onDeleteObstacle }: ObstacleInspectorProps) {
  return (
    <div>
      <h4 style={{ margin: '0 0 8px' }}>Obstacle #{index + 1}</h4>
      <Field label="Type">
        <select
          value={obstacle.type}
          onChange={e => onUpdateObstacle(index, { type: e.target.value as TerrainType })}
          style={{ width: '100%' }}
        >
          {TERRAIN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Radius">
        {numInput(obstacle.radius, v => onUpdateObstacle(index, { radius: Math.max(1, v) }))}
      </Field>
      <Field label="Z-order">
        {numInput(obstacle.zIndex ?? 0, v => onUpdateObstacle(index, { zIndex: Math.round(v) }))}
      </Field>
      <Field label="Position (x, y)">
        <div style={{ display: 'flex', gap: 4 }}>
          {numInput(Math.round(obstacle.x), v => onMoveObstacle(index, v, obstacle.y))}
          {numInput(Math.round(obstacle.y), v => onMoveObstacle(index, obstacle.x, v))}
        </div>
      </Field>
      <button onClick={() => onDeleteObstacle(index)}>Delete Obstacle</button>
    </div>
  )
}

interface DecorInspectorProps {
  index: number
  item: BattlefieldDecorItem
  onUpdateDecor: (index: number, patch: Partial<Pick<BattlefieldDecorItem, 'tileId' | 'zIndex'>>) => void
  onMoveDecor: (index: number, x: number, y: number) => void
  onDeleteDecor: (index: number) => void
}

function DecorInspector({ index, item, onUpdateDecor, onMoveDecor, onDeleteDecor }: DecorInspectorProps) {
  if (item.bundleId) {
    const bundle = getBattlefieldBundleById(item.bundleId)
    return (
      <div>
        <h4 style={{ margin: '0 0 8px' }}>Decor #{index + 1} (bundle)</h4>
        <Field label="Bundle">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {(bundle?.tiles ?? []).map((t, i) => {
              const col = t.tileId % DECOR_COLS
              const row = Math.floor(t.tileId / DECOR_COLS)
              return (
                <div
                  key={i}
                  style={{
                    width: 24, height: 24,
                    backgroundImage: `url("${WORLD_DECOR_FILE}")`,
                    backgroundSize: `${DECOR_COLS * 24}px auto`,
                    backgroundPosition: `-${col * 24}px -${row * 24}px`,
                    backgroundRepeat: 'no-repeat',
                    imageRendering: 'pixelated',
                    border: '1px solid #444',
                  }}
                />
              )
            })}
          </div>
          <div style={{ marginTop: 4, opacity: 0.7 }}>{bundle?.label ?? item.bundleId}</div>
        </Field>
        <Field label="Z-order">
          {numInput(item.zIndex ?? 0, v => onUpdateDecor(index, { zIndex: Math.round(v) }))}
        </Field>
        <Field label="Position (x, y)">
          <div style={{ display: 'flex', gap: 4 }}>
            {numInput(Math.round(item.x), v => onMoveDecor(index, v, item.y))}
            {numInput(Math.round(item.y), v => onMoveDecor(index, item.x, v))}
          </div>
        </Field>
        <button onClick={() => onDeleteDecor(index)}>Delete Bundle</button>
      </div>
    )
  }

  const col = item.tileId % DECOR_COLS
  const row = Math.floor(item.tileId / DECOR_COLS)
  return (
    <div>
      <h4 style={{ margin: '0 0 8px' }}>Decor #{index + 1}</h4>
      <Field label="Preview">
        <div
          style={{
            width: 32, height: 32,
            backgroundImage: `url("${WORLD_DECOR_FILE}")`,
            backgroundPosition: `-${col * 32}px -${row * 32}px`,
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
            border: '1px solid #444',
          }}
        />
      </Field>
      <Field label="Type">
        <select
          value={item.tileId}
          onChange={e => onUpdateDecor(index, { tileId: parseInt(e.target.value, 10) })}
          style={{ width: '100%' }}
        >
          {DECOR_TILE_OPTIONS.map(([key, tileId]) => <option key={key} value={tileId}>{key}</option>)}
        </select>
      </Field>
      <Field label="Z-order">
        {numInput(item.zIndex ?? 0, v => onUpdateDecor(index, { zIndex: Math.round(v) }))}
      </Field>
      <Field label="Position (x, y)">
        <div style={{ display: 'flex', gap: 4 }}>
          {numInput(Math.round(item.x), v => onMoveDecor(index, v, item.y))}
          {numInput(Math.round(item.y), v => onMoveDecor(index, item.x, v))}
        </div>
      </Field>
      <button onClick={() => onDeleteDecor(index)}>Delete Decor</button>
    </div>
  )
}

interface TerrainPathInspectorProps {
  pathIndex: number
  path: TerrainPathDef
  onUpdatePath: (pathIndex: number, patch: Partial<Pick<TerrainPathDef, 'type' | 'radius'>>) => void
  onMovePathPoint: (pathIndex: number, pointIndex: number, x: number, y: number) => void
  onDeletePath: (pathIndex: number) => void
  onDeletePathPoint: (pathIndex: number, pointIndex: number) => void
}

function TerrainPathInspector({ pathIndex, path, onUpdatePath, onMovePathPoint, onDeletePath, onDeletePathPoint }: TerrainPathInspectorProps) {
  return (
    <div>
      <h4 style={{ margin: '0 0 8px' }}>Path #{pathIndex + 1}</h4>
      <Field label="Type">
        <select
          value={path.type}
          onChange={e => onUpdatePath(pathIndex, { type: e.target.value as TerrainType })}
          style={{ width: '100%' }}
        >
          {TERRAIN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Radius (chain spacing)">
        {numInput(path.radius ?? 20, v => onUpdatePath(pathIndex, { radius: Math.max(1, v) }))}
      </Field>
      <Field label={`Waypoints (${path.points.length})`}>
        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
          {path.points.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, opacity: 0.6, width: 14 }}>{i + 1}</span>
              {numInput(Math.round(p.x), v => onMovePathPoint(pathIndex, i, v, p.y))}
              {numInput(Math.round(p.y), v => onMovePathPoint(pathIndex, i, p.x, v))}
              <button onClick={() => onDeletePathPoint(pathIndex, i)} disabled={path.points.length <= 1} title="Delete waypoint">×</button>
            </div>
          ))}
        </div>
      </Field>
      <button onClick={() => onDeletePath(pathIndex)}>Delete Path</button>
    </div>
  )
}

export interface InspectorProps {
  selectedEntities: SelectedEntity[]
  roads: RoadDef[]
  terrain: TerrainObstacle[]
  decor: BattlefieldDecorItem[]
  terrainPaths: TerrainPathDef[]
  nodeId: EditTarget
  hasNodeRoadsOverride: boolean
  hasNodeTerrainOverride: boolean
  hasNodeDecorOverride: boolean
  hasNodeTerrainPathsOverride: boolean
  onUpdateRoad: RoadInspectorProps['onUpdateRoad']
  onMoveRoadPoint: RoadInspectorProps['onMoveRoadPoint']
  onDeleteRoad: RoadInspectorProps['onDeleteRoad']
  onDeleteRoadPoint: RoadInspectorProps['onDeleteRoadPoint']
  onUpdateObstacle: ObstacleInspectorProps['onUpdateObstacle']
  onMoveObstacle: ObstacleInspectorProps['onMoveObstacle']
  onDeleteObstacle: ObstacleInspectorProps['onDeleteObstacle']
  onUpdateDecor: DecorInspectorProps['onUpdateDecor']
  onMoveDecor: DecorInspectorProps['onMoveDecor']
  onDeleteDecor: DecorInspectorProps['onDeleteDecor']
  onUpdatePath: TerrainPathInspectorProps['onUpdatePath']
  onMovePathPoint: TerrainPathInspectorProps['onMovePathPoint']
  onDeletePath: TerrainPathInspectorProps['onDeletePath']
  onDeletePathPoint: TerrainPathInspectorProps['onDeletePathPoint']
  onRevertRoads: () => void
  onRevertTerrain: () => void
  onRevertDecor: () => void
  onRevertTerrainPaths: () => void
}

export function BattlefieldEditorInspector(props: InspectorProps) {
  const {
    selectedEntities, roads, terrain, decor, terrainPaths, nodeId,
    hasNodeRoadsOverride, hasNodeTerrainOverride, hasNodeDecorOverride, hasNodeTerrainPathsOverride,
    onRevertRoads, onRevertTerrain, onRevertDecor, onRevertTerrainPaths,
  } = props
  const sel = selectedEntities[0]

  let body: React.ReactNode = <p style={{ opacity: 0.6, fontSize: 12 }}>Select a road, obstacle, decor item, or path to edit it.</p>
  if (sel?.type === 'road' && roads[sel.index]) {
    body = <RoadInspector roadIndex={sel.index} road={roads[sel.index]} onUpdateRoad={props.onUpdateRoad} onMoveRoadPoint={props.onMoveRoadPoint} onDeleteRoad={props.onDeleteRoad} onDeleteRoadPoint={props.onDeleteRoadPoint} />
  } else if (sel?.type === 'roadPoint' && roads[sel.roadIndex]) {
    body = <RoadInspector roadIndex={sel.roadIndex} road={roads[sel.roadIndex]} onUpdateRoad={props.onUpdateRoad} onMoveRoadPoint={props.onMoveRoadPoint} onDeleteRoad={props.onDeleteRoad} onDeleteRoadPoint={props.onDeleteRoadPoint} />
  } else if (sel?.type === 'obstacle' && terrain[sel.index]) {
    body = <ObstacleInspector index={sel.index} obstacle={terrain[sel.index]} onUpdateObstacle={props.onUpdateObstacle} onMoveObstacle={props.onMoveObstacle} onDeleteObstacle={props.onDeleteObstacle} />
  } else if (sel?.type === 'decor' && decor[sel.index]) {
    body = <DecorInspector index={sel.index} item={decor[sel.index]} onUpdateDecor={props.onUpdateDecor} onMoveDecor={props.onMoveDecor} onDeleteDecor={props.onDeleteDecor} />
  } else if (sel?.type === 'terrainPath' && terrainPaths[sel.index]) {
    body = <TerrainPathInspector pathIndex={sel.index} path={terrainPaths[sel.index]} onUpdatePath={props.onUpdatePath} onMovePathPoint={props.onMovePathPoint} onDeletePath={props.onDeletePath} onDeletePathPoint={props.onDeletePathPoint} />
  } else if (sel?.type === 'terrainPathPoint' && terrainPaths[sel.pathIndex]) {
    body = <TerrainPathInspector pathIndex={sel.pathIndex} path={terrainPaths[sel.pathIndex]} onUpdatePath={props.onUpdatePath} onMovePathPoint={props.onMovePathPoint} onDeletePath={props.onDeletePath} onDeletePathPoint={props.onDeletePathPoint} />
  }

  return (
    <div style={{ width: 220, padding: 12, overflowY: 'auto', borderLeft: '1px solid #333', fontSize: 12 }}>
      {nodeId !== 'act-default' && (
        <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #333' }}>
          <div style={{ marginBottom: 4 }}>
            Roads: {hasNodeRoadsOverride ? 'node override' : 'inherited from act'}
            {hasNodeRoadsOverride && <button style={{ marginLeft: 6 }} onClick={onRevertRoads}>Clear</button>}
          </div>
          <div style={{ marginBottom: 4 }}>
            Terrain: {hasNodeTerrainOverride ? 'node override' : 'inherited / procedural'}
            {hasNodeTerrainOverride && <button style={{ marginLeft: 6 }} onClick={onRevertTerrain}>Clear</button>}
          </div>
          <div style={{ marginBottom: 4 }}>
            Decor: {hasNodeDecorOverride ? 'node override' : 'inherited from act'}
            {hasNodeDecorOverride && <button style={{ marginLeft: 6 }} onClick={onRevertDecor}>Clear</button>}
          </div>
          <div>
            Paths: {hasNodeTerrainPathsOverride ? 'node override' : 'inherited from act'}
            {hasNodeTerrainPathsOverride && <button style={{ marginLeft: 6 }} onClick={onRevertTerrainPaths}>Clear</button>}
          </div>
        </div>
      )}
      {body}
    </div>
  )
}
