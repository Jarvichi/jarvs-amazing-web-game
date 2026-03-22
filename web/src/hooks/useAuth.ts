import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { auth } from '../firebase'
import rollbar from '../rollbar'

export interface AuthState {
  user: User | null
  authLoading: boolean
}

export function useAuth(): AuthState {
  const [user, setUser]           = useState<User | null>(null)
  const [authLoading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        rollbar.info('useAuth: auth state changed — user present', { uid: u.uid, isAnonymous: u.isAnonymous })
        setUser(u)
        setLoading(false)
      } else {
        // No session — sign in anonymously so we always have a uid available.
        rollbar.info('useAuth: no session, signing in anonymously')
        try {
          await signInAnonymously(auth)
          rollbar.info('useAuth: anonymous sign-in succeeded')
        } catch (err) {
          rollbar.error('useAuth: anonymous sign-in failed', { err })
          setLoading(false)
        }
      }
    })
    return unsub
  }, [])

  return { user, authLoading }
}
