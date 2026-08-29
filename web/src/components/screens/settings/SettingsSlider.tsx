import React from 'react'

interface Props {
  value: number
  onChange: (val: number) => void
  min: number
  max: number
  step: number
  /** Accessible name for the range input. */
  label: string
  /** Right-hand readout, e.g. "75%" or "14px". */
  readout: string
  disabled?: boolean
}

/** Range input plus its value readout — the volume and text-size controls. */
export function SettingsSlider({
  value, onChange, min, max, step, label, readout, disabled = false,
}: Props) {
  return (
    <div className="u-flex u-items-c u-gap-4">
      <input
        type="range"
        className="settings-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <span className="settings-value">{readout}</span>
    </div>
  )
}
