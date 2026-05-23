import React from 'react';

export const ZOOM_STEPS = [1, 1.5, 2, 3, 4]

export interface Props {
  scale:    number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomTo: (scale: number) => void
}

export function ToolBarZoomControls({ scale, onZoomIn, onZoomOut, onZoomTo }: Props) {
  return (
    <div className="toolbar-zoom-controls" onPointerDown={e => e.stopPropagation()}>
      <button className="toolbar-zoom-btn" onClick={onZoomOut} title="Zoom out" disabled={scale <= 1}>−</button>
      <div className="toolbar-zoom-bar">
        {ZOOM_STEPS.map((z, i) => (
          <button
            key={z}
            className={`toolbar-zoom-tick${scale >= z - 0.01 ? ' toolbar-zoom-tick--active' : ''}`}
            onClick={() => onZoomTo(z)}
            title={`${z}×`}
          >
            {i === ZOOM_STEPS.length - 1 ? '|' : '·'}
          </button>
        ))}
      </div>
      <button className="toolbar-zoom-btn" onClick={onZoomIn} title="Zoom in" disabled={scale >= 4}>+</button>
    </div>
  );
}
