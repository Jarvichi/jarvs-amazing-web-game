import React, { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

interface Props {
  /** Shown so the player can see which account they are about to destroy. */
  email: string
  busy: boolean
  error: string | null
  onConfirm: (password: string) => void
  onCancel: () => void
}

/**
 * Confirmation for deleting an account (#2090).
 *
 * Not ConfirmModal: Firebase requires a recent login before deleteUser, and
 * auth here is email/password only, so this has to collect the password.
 * ConfirmModal takes a plain string body and threading an input plus a busy
 * and error state through it would distort it for its other callers.
 */
export function DeleteAccountModal({ email, busy, error, onConfirm, onCancel }: Props) {
  const [password, setPassword] = useState('')

  function submit() {
    if (!password || busy) return
    onConfirm(password)
  }

  return (
    <Modal
      title="DELETE ACCOUNT"
      tone="danger"
      onClose={busy ? () => {} : onCancel}
      footer={
        <div className="u-flex u-gap-4 u-just-end">
          <Button onClick={onCancel} disabled={busy}>CANCEL</Button>
          <Button variant="danger" onClick={submit} disabled={busy || !password}>
            {busy ? 'DELETING...' : 'DELETE FOREVER'}
          </Button>
        </div>
      }
    >
      <div className="u-col u-gap-4">
        <p className="settings-confirm-msg">
          This permanently deletes your account and cannot be undone.
        </p>
        <p className="settings-sublabel">
          Your cloud save, player name and leaderboard entries will be removed,
          and <strong>{email}</strong> will be able to register again from
          scratch. Progress saved only on this device is cleared too.
        </p>
        <p className="settings-sublabel">
          Leaderboard entries recorded before this update may remain, as older
          scores were not stored in a way that can be traced back to an account.
        </p>

        <label className="settings-sublabel" htmlFor="delete-account-password">
          Enter your password to confirm
        </label>
        <input
          id="delete-account-password"
          type="password"
          className="settings-input"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          disabled={busy}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
        />

        {error && <div className="settings-message settings-message--error">{error}</div>}
      </div>
    </Modal>
  )
}
