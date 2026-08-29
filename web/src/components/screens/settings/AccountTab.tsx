import { useState } from 'react'
import { signOut as firebaseSignOut, type User } from 'firebase/auth'
import { auth } from '../../../firebase'
import { uploadSave, applySave, getLastSyncTime, type CloudSave } from '../../../game/cloudSave'
import { Button } from '../../ui/Button'
import { LoginModal } from '../../modals/LoginModal'
import { SettingsRow } from './SettingsRow'
import { SettingsMessage, type SettingsStatus } from './SettingsMessage'

interface Props {
  user: User | null
  authLoading: boolean
}

const SYNC_FAILED: SettingsStatus = {
  text: 'Sync failed. Check your connection.',
  kind: 'error',
}

/** Sign-in, cloud backup, and the local-vs-cloud save conflict prompt. */
export function AccountTab({ user, authLoading }: Props) {
  const [syncing,          setSyncing]          = useState(false)
  const [syncMsg,          setSyncMsg]          = useState<SettingsStatus | null>(null)
  const [pendingCloudSave, setPendingCloudSave] = useState<CloudSave | null>(null)
  const [lastSync,         setLastSync]         = useState<Date | null>(getLastSyncTime)
  const [showLoginModal,   setShowLoginModal]   = useState(false)

  async function handleSync() {
    if (!user || user.isAnonymous) return
    setSyncing(true)
    setSyncMsg(null)
    try {
      await uploadSave(user.uid)
      setLastSync(new Date())
      setSyncMsg({ text: 'Save synced.', kind: 'ok' })
    } catch {
      setSyncMsg(SYNC_FAILED)
    } finally {
      setSyncing(false)
    }
  }

  async function handleSignOut() {
    await firebaseSignOut(auth)
    setSyncMsg(null)
    setPendingCloudSave(null)
    setLastSync(null)
  }

  function handleLoadCloudSave() {
    if (!pendingCloudSave) return
    applySave(pendingCloudSave.data)
    setPendingCloudSave(null)
    setLastSync(new Date())
    setSyncMsg({ text: 'Cloud save loaded. Reload the page to apply all changes.', kind: 'ok' })
  }

  async function handleKeepLocal() {
    if (!user || user.isAnonymous) return
    setPendingCloudSave(null)
    try {
      await uploadSave(user.uid)
      setLastSync(new Date())
      setSyncMsg({ text: 'Local save pushed to cloud.', kind: 'ok' })
    } catch {
      setSyncMsg(SYNC_FAILED)
    }
  }

  return (
    <>
      {!user?.isAnonymous ? (
        <>
          <SettingsRow
            label={user?.displayName ?? user?.email ?? 'Google account'}
            sublabel={lastSync ? `Last synced: ${lastSync.toLocaleString()}` : 'Not yet synced'}
          >
            <div className="u-flex u-gap-4">
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? 'SYNCING...' : 'SYNC NOW'}
              </Button>
              <Button size="xs" onClick={handleSignOut}>SIGN OUT</Button>
            </div>
          </SettingsRow>

          {pendingCloudSave && (
            <SettingsRow
              stacked
              label={
                <span className="settings-label--warn">
                  Cloud save found ({pendingCloudSave.savedAt.toDate().toLocaleString()})
                </span>
              }
              sublabel="Load it? Your local progress will be replaced."
            >
              <div className="u-flex u-gap-4">
                <Button onClick={handleLoadCloudSave}>LOAD CLOUD SAVE</Button>
                <Button size="xs" onClick={handleKeepLocal}>KEEP LOCAL</Button>
              </div>
            </SettingsRow>
          )}
        </>
      ) : (
        <SettingsRow
          label="Sync save across devices"
          sublabel="Sign in to back up and restore your progress"
        >
          <Button onClick={() => setShowLoginModal(true)} disabled={authLoading}>
            SIGN IN
          </Button>
        </SettingsRow>
      )}

      {syncMsg && <SettingsMessage status={syncMsg} />}

      {showLoginModal && (
        <LoginModal
          user={user}
          authLoading={authLoading}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={({ pendingCloudSave: cloud, lastSync: newSync, status }) => {
            setShowLoginModal(false)
            if (cloud)   setPendingCloudSave(cloud)
            if (newSync) setLastSync(newSync)
            if (status)  setSyncMsg(status)
          }}
        />
      )}
    </>
  )
}
