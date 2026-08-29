import React from 'react'

export type SettingsMessageKind = 'ok' | 'error' | 'warn'

export interface SettingsStatus {
  text: string
  kind: SettingsMessageKind
}

interface Props {
  status: SettingsStatus
}

/**
 * Status line under a settings action (sync result, import result, Rollbar
 * test). The kind picks the token — previously every call site inlined a raw
 * `#33ff33` / `#ff5555` / `#ffbb33`, and the sync row decided which by
 * substring-matching seven different phrases out of the message text.
 */
export function SettingsMessage({ status }: Props) {
  return (
    <div className={`settings-row settings-message settings-message--${status.kind}`} role="status">
      {status.text}
    </div>
  )
}
