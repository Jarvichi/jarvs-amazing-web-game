import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { auth } from '../firebase'

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
        setUser(u)
        setLoading(false)
      } else {
        // No session — sign in anonymously so we always have a uid available.
        try {
          await signInAnonymously(auth)
        } catch {
          setLoading(false)
        }
      }
    })
    return unsub
  }, [])

  return { user, authLoading }
}
