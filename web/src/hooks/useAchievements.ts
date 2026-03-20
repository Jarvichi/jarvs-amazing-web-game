import { useState, useEffect } from 'react'
import { AchievementDef } from '../game/achievements'

export function useAchievements() {
  const [achievementToasts, setAchievementToasts] = useState<AchievementDef[]>([])

  // Auto-dismiss achievement toasts after 4 seconds
  useEffect(() => {
    if (achievementToasts.length === 0) return
    const id = setTimeout(() => setAchievementToasts(prev => prev.slice(1)), 4000)
    return () => clearTimeout(id)
  }, [achievementToasts])

  return { achievementToasts, setAchievementToasts }
}
