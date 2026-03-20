import { useEffect } from 'react'
import { GameState } from '../game/types'
import { RunState, ACTS } from '../game/questline'
import {
  startBattleMusic, stopBattleMusic,
  startTitleMusic, stopTitleMusic,
  startGameOverMusic, stopGameOverMusic,
  startMapMusic, stopMapMusic,
  setBattleIntensity, startMusicTrack, MUSIC_TRACKS,
} from '../game/sound'

type Screen = string

export function useMusic(screen: Screen, gameState: GameState | null, run: RunState | null): void {
  // Music router: exactly one track plays at a time; switching screen stops all others.
  // Acts can specify per-context music IDs in their JSON (mapMusicId, battleMusicId, bossMusicId).
  useEffect(() => {
    const phase = gameState?.phase
    stopBattleMusic()
    stopTitleMusic()
    stopGameOverMusic()
    stopMapMusic()

    const act = run ? ACTS[run.actId] : undefined

    if (screen === 'title' || screen === 'settings' || screen === 'deckbuilder' || screen === 'collection') {
      startTitleMusic()
    } else if (screen === 'nodemap') {
      const mapTrackId = act?.mapMusicId
      const mapTrack = mapTrackId ? MUSIC_TRACKS[mapTrackId] : undefined
      if (mapTrack) { startMusicTrack(mapTrack) } else { startMapMusic() }
    } else if (screen === 'playing') {
      if (phase?.type === 'playing') {
        const pendingNode = run?.pendingNodeId ? act?.nodes[run.pendingNodeId] : undefined
        const isBoss = pendingNode?.type === 'boss'
        const battleTrackId = isBoss ? act?.bossMusicId : act?.battleMusicId
        const battleTrack = battleTrackId ? MUSIC_TRACKS[battleTrackId] : undefined
        if (battleTrack) { startMusicTrack(battleTrack) } else { startBattleMusic() }
      } else if (phase?.type === 'gameOver') {
        startGameOverMusic(phase.winner)
      }
    }
    return () => { stopBattleMusic(); stopTitleMusic(); stopGameOverMusic(); stopMapMusic() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, gameState?.phase.type])

  // Adaptive battle music intensity: 0=calm(losing), 1=normal, 2=intense(winning/many units)
  useEffect(() => {
    if (screen !== 'playing' || !gameState || gameState.phase.type !== 'playing') return
    const scoreDiff = gameState.playerScore - gameState.opponentScore
    const unitCount = gameState.field.filter(u => u.owner === 'player' && u.moveSpeed > 0).length
    const hpFrac    = gameState.playerBase.hp / gameState.playerBase.maxHp
    let intensity: 0 | 1 | 2 = 1
    if (scoreDiff > 20 || unitCount >= 4 || hpFrac < 0.35) intensity = 2
    else if (scoreDiff < -10 || (hpFrac > 0.8 && unitCount <= 1)) intensity = 0
    setBattleIntensity(intensity)
  }, [screen, gameState?.playerScore, gameState?.opponentScore, gameState?.field.length, gameState?.playerBase.hp])
}
