import React, { useState } from 'react'
import {
  EmailAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
  type User,
} from 'firebase/auth'
import { auth } from '../firebase'
import { uploadSave, downloadSave } from '../game/cloudSave'
import { type CloudSave } from '../game/cloudSave'
import rollbar from '../rollbar'

interface Props {
  user: User | null
  authLoading: boolean
  onClose: () => void
  onLoginSuccess: (opts: { pendingCloudSave?: CloudSave; lastSync?: Date; message: string }) => void
}

export function LoginModal({ user, authLoading, onClose, onLoginSuccess }: Props) {
  const [emailInput,    setEmailInput]    = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [emailBusy,     setEmailBusy]     = useState(false)
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null)

  async function finishSignIn(linkedUser: User) {
    rollbar.info('finishSignIn: checking for cloud save', { uid: linkedUser.uid })
    try {
      const cloud = await downloadSave(linkedUser.uid)
      if (cloud) {
        rollbar.info('finishSignIn: cloud save found, prompting user', { uid: linkedUser.uid })
        onLoginSuccess({ pendingCloudSave: cloud, message: '' })
      } else {
        rollbar.info('finishSignIn: no cloud save found, uploading local save', { uid: linkedUser.uid })
        await uploadSave(linkedUser.uid)
        const now = new Date()
        rollbar.info('finishSignIn: local save uploaded successfully', { uid: linkedUser.uid })
        onLoginSuccess({ lastSync: now, message: 'Save synced to cloud.' })
      }
    } catch (err) {
      rollbar.error('finishSignIn: cloud save check/upload failed', { err })
      onLoginSuccess({ message: 'Signed in, but sync failed. Try SYNC NOW.' })
    }
  }

  async function handleEmailSignIn() {
    if (!user || !emailInput || !passwordInput) return
    setEmailBusy(true)
    setErrorMsg(null)
    try {
      let linkedUser: User
      if (user.isAnonymous) {
        const credential = EmailAuthProvider.credential(emailInput, passwordInput)
        try {
          const result = await linkWithCredential(user, credential)
          linkedUser = result.user
        } catch (linkErr: unknown) {
          const err = linkErr as { code?: string }
          if (err.code === 'auth/credential-already-in-use' || err.code === 'auth/email-already-in-use') {
            const result = await signInWithEmailAndPassword(auth, emailInput, passwordInput)
            linkedUser = result.user
          } else {
            throw linkErr
          }
        }
      } else {
        const result = await signInWithEmailAndPassword(auth, emailInput, passwordInput)
        linkedUser = result.user
      }
      await finishSignIn(linkedUser)
    } catch (err: unknown) {
      const e = err as { code?: string }
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setErrorMsg('Incorrect password.')
      } else if (e.code === 'auth/user-not-found') {
        setErrorMsg('No account found. Use CREATE ACCOUNT.')
      } else if (e.code === 'auth/invalid-email') {
        setErrorMsg('Invalid email address.')
      } else {
        rollbar.error('Email sign-in failed', { code: e.code, err })
        setErrorMsg('Sign-in failed. Please try again.')
      }
    } finally {
      setEmailBusy(false)
    }
  }

  async function handleEmailCreate() {
    if (!user || !emailInput || !passwordInput) return
    setEmailBusy(true)
    setErrorMsg(null)
    try {
      let linkedUser: User
      if (user.isAnonymous) {
        const credential = EmailAuthProvider.credential(emailInput, passwordInput)
        const result = await linkWithCredential(user, credential)
        linkedUser = result.user
      } else {
        const result = await createUserWithEmailAndPassword(auth, emailInput, passwordInput)
        linkedUser = result.user
      }
      await finishSignIn(linkedUser)
    } catch (err: unknown) {
      const e = err as { code?: string }
      if (e.code === 'auth/email-already-in-use') {
        setErrorMsg('Account already exists. Use SIGN IN.')
      } else if (e.code === 'auth/weak-password') {
        setErrorMsg('Password must be at least 6 characters.')
      } else if (e.code === 'auth/invalid-email') {
        setErrorMsg('Invalid email address.')
      } else {
        rollbar.error('Email account creation failed', { code: e.code, err })
        setErrorMsg('Account creation failed. Please try again.')
      }
    } finally {
      setEmailBusy(false)
    }
  }

  async function handleForgotPassword() {
    if (!emailInput) { setErrorMsg('Enter your email first.'); return }
    try {
      await sendPasswordResetEmail(auth, emailInput)
      setErrorMsg('Password reset email sent.')
    } catch {
      setErrorMsg('Could not send reset email. Check the address.')
    }
  }

  const isError = errorMsg && !errorMsg.includes('sent')

  return (
    <div className="login-modal-backdrop" onClick={onClose}>
      <div className="login-modal" onClick={e => e.stopPropagation()}>
        <div className="login-modal-header">SIGN IN</div>
        <div className="login-modal-sub">Back up and sync your save across devices.</div>

        <div className="login-modal-fields">
          <input
            type="email"
            className="settings-slider"
            placeholder="Email"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            style={{ padding: '6px 10px', width: '100%', boxSizing: 'border-box' }}
          />
          <input
            type="password"
            className="settings-slider"
            placeholder="Password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleEmailSignIn() }}
            style={{ padding: '6px 10px', width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {errorMsg && (
          <div className="login-modal-msg" style={{ color: isError ? '#ff5555' : '#33ff33' }}>
            {errorMsg}
          </div>
        )}

        <div className="login-modal-buttons">
          <button className="action-btn" onClick={handleEmailSignIn} disabled={emailBusy || authLoading}>
            {emailBusy ? 'PLEASE WAIT...' : 'SIGN IN'}
          </button>
          <button className="action-btn" onClick={handleEmailCreate} disabled={emailBusy || authLoading} style={{ fontSize: '11px', padding: '6px 12px' }}>
            CREATE ACCOUNT
          </button>
          <button className="action-btn" onClick={handleForgotPassword} disabled={emailBusy} style={{ fontSize: '11px', padding: '6px 12px' }}>
            FORGOT PASSWORD
          </button>
          <button className="action-btn" onClick={onClose} style={{ fontSize: '11px', padding: '6px 12px' }}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}
