import React from 'react'

interface Props {
  checked: boolean
  onChange: () => void
  /** Accessible name — required, so a new toggle cannot ship without one. */
  label: string
  disabled?: boolean
}

/**
 * The settings switch. Owns `role="switch"`, `aria-checked`, `aria-label`,
 * `tabIndex` and the Enter/Space handling in one place — the six copies this
 * replaced each re-declared all of it, and drifted.
 */
export function SettingsToggle({ checked, onChange, label, disabled = false }: Props) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!disabled) onChange()
    }
  }

  return (
    <div
      className={`form-toggle u-flex u-items-c u-gap-3 u-no-select${disabled ? '' : ' u-pointer'}`}
      onClick={() => { if (!disabled) onChange() }}
      onKeyDown={handleKeyDown}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
    >
      <div className={`form-toggle__track${checked ? ' form-toggle__track--on' : ''}`}>
        <div className="form-toggle__thumb" />
      </div>
    </div>
  )
}
