import React from 'react'

interface Props {
  /** Left-hand primary text. Omit for a row that is only a control or message. */
  label?: React.ReactNode
  /** Secondary text under the label. */
  sublabel?: React.ReactNode
  /** The right-hand control (toggle, slider, button group). */
  children?: React.ReactNode
  /**
   * Stack the control under the text instead of beside it — for rows whose
   * control is a group of buttons too wide to sit on one line (the cloud-save
   * conflict prompt).
   */
  stacked?: boolean
}

/**
 * The label / sublabel / control row every settings section is built from.
 * Was 38 hand-repeated copies of the same
 * `settings-row u-flex u-items-c u-just-sb u-gap-7` markup before #2165's
 * settings pass.
 */
export function SettingsRow({ label, sublabel, children, stacked = false }: Props) {
  return (
    <div className={`settings-row u-flex u-gap-7${stacked ? ' settings-row--stacked' : ' u-items-c u-just-sb'}`}>
      {(label !== undefined || sublabel !== undefined) && (
        <div className="settings-row-text">
          {label !== undefined && <div className="settings-label">{label}</div>}
          {sublabel !== undefined && <div className="settings-sublabel">{sublabel}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
