import { useApp } from '../AppContext'
import { useBattle } from '../BattleContext'
import {
  Battlefield, GameOver, VictoryPanel, FingerSmash, BossShockwave, BattleSummary, PostBattleReward,
  FakeCrashEvent, BlackjackEvent, WrongNumberEvent, NarratorEvent, LiarsDiceEvent,
  GamblerEvent, DevBuildEvent, GlitchedCardEvent, ConfusedTouristEvent,
} from '../lazyScreens'
import { getModifiersByCount } from '../../game/questline'
import { isAdminUser } from '../../game/admin'

/**
 * The two screens that render during and immediately after a battle.
 *
 * The `playing` branch dispatches on gameState.phase — celebration, fingerSmash,
 * waveReward, gameOver, or the live battlefield — rather than on `screen`.
 */
export function BattleRoutes() {
  const { screen, run, actData, handicap, user, handleStartWeeklyChallenge } = useApp()
  const {
    battle, gameState, dispatch, showBossSplash, actTheme, isCampaign,
    quickPlayRewardClaimed, activeRareEvent, handleRareEventDone,
    isCampaignRef, worldBattleNodeIdRef, isDailyChallengeRef, isWeeklyChallengeRef, isWandererBattleRef,
    gameStateRef, summaryDoneRef,
    handlePlayCard, handlePlayAoeCard, handleGiveUp, setIsUserPaused,
    handleSetStance, handleCycleSpeed, handleWaveRewardPick, handleWaveRewardSkip,
    handleOpenPack, handleCampaignWin, handleCampaignRetry, handleDailyChallengeRetry,
    handlePlayAgain, handleWorldBattleRetry, handleMainMenu, handleAbandonRun,
  } = useBattle()

  const {
    showBossShockwave, dcGameOverState, summaryStats, fingerSmashNames,
    waveRewardChoices, speedMultiplier,
  } = battle

  return (
    <>
      {screen === 'battlesummary' && summaryStats && (
        <BattleSummary
          stats={summaryStats.stats}
          gameTime={summaryStats.gameTime}
          playerScore={summaryStats.playerScore}
          onContinue={() => summaryDoneRef.current()}
        />
      )}

      {screen === 'playing' && gameState && (() => {
        const pendingId = run?.pendingNodeId
        const failCount = pendingId ? (run?.nodeFailCounts?.[pendingId] ?? 0) : 0
        const quickPlayHint = isCampaignRef.current
          && gameState.phase.type === 'gameOver'
          && gameState.phase.winner !== 'player'
          && failCount >= 2
        if (gameState.phase.type === 'celebration') {
          return (
            <>
              <Battlefield state={gameState} onPlayCard={handlePlayCard} onPlayAoeCard={handlePlayAoeCard} onGiveUp={handleGiveUp} onPause={setIsUserPaused} actTheme={actTheme} activeRelic={run?.activeRelic} showBossSplash={false} activeModifiers={run && actData ? getModifiersByCount(actData, run.activeModifierCount) : []} isCampaign={isCampaign} stance={gameState.playerStance ?? 'auto'} onSetStance={handleSetStance} speedMultiplier={speedMultiplier} onCycleSpeed={handleCycleSpeed} onCounterSpell={() => dispatch({ type: 'COUNTER_SPELL' })} isAdmin={isAdminUser(user)} />
              <VictoryPanel
                playerScore={gameState.playerScore}
                opponentScore={gameState.opponentScore}
                playerBaseHp={gameState.playerBase.hp}
                playerBaseMaxHp={gameState.playerBase.maxHp}
                unitsDefeated={gameState.battleStats.playerKills}
                gameTime={gameState.gameTime}
                onContinue={() => dispatch({ type: 'SET_GAME_STATE', gameState: { ...gameState, phase: { type: 'gameOver', winner: 'player' } } })}
              />
            </>
          )
        }
        if (gameState.phase.type === 'fingerSmash') {
          return (
            <>
              <Battlefield state={gameState} onPlayCard={handlePlayCard} onPlayAoeCard={handlePlayAoeCard} onGiveUp={handleGiveUp} onPause={setIsUserPaused} actTheme={actTheme} activeRelic={run?.activeRelic} showBossSplash={showBossSplash} activeModifiers={run && actData ? getModifiersByCount(actData, run.activeModifierCount) : []} isCampaign={isCampaign} stance={gameState.playerStance ?? 'auto'} onSetStance={handleSetStance} speedMultiplier={speedMultiplier} onCycleSpeed={handleCycleSpeed} onCounterSpell={() => dispatch({ type: 'COUNTER_SPELL' })} isAdmin={isAdminUser(user)} />
              <FingerSmash
                smashedNames={fingerSmashNames}
                onDone={() => {
                  dispatch({ type: 'DISMISS_FINGER_SMASH' })
                  const gs = gameStateRef.current
                  if (gs && gs.phase.type === 'fingerSmash') {
                    const fphase = gs.phase as { type: 'fingerSmash'; wave: number; smashedNames: string[]; rewardDue: boolean }
                    dispatch({ type: 'SET_GAME_STATE', gameState: {
                      ...gs,
                      phase: fphase.rewardDue
                        ? { type: 'waveReward', wave: fphase.wave, smashedNames: fphase.smashedNames }
                        : { type: 'playing' },
                    } })
                  }
                }}
              />
            </>
          )
        }
        if (gameState.phase.type === 'waveReward') {
          const wave = (gameState.phase as { type: 'waveReward'; wave: number; smashedNames: string[] }).wave
          return (
            <PostBattleReward
              choices={waveRewardChoices}
              nodeType="battle"
              crystals={0}
              onPick={handleWaveRewardPick}
              onSkip={handleWaveRewardSkip}
              headerOverride={{
                title: `WAVE ${wave} CLEARED`,
                sub: 'Pick a card to add to your deck.',
              }}
            />
          )
        }
        return gameState.phase.type === 'gameOver' ? (
          <GameOver
            state={gameState}
            winner={gameState.phase.winner}
            handicap={handicap}
            onOpenPack={!isCampaignRef.current && worldBattleNodeIdRef.current === null && gameState.phase.winner === 'player' ? handleOpenPack : undefined}
            rewardClaimed={quickPlayRewardClaimed}
            onPlayAgain={worldBattleNodeIdRef.current !== null
              ? handleWorldBattleRetry
              : isCampaignRef.current
                ? (gameState.phase.winner === 'player' ? handleCampaignWin : handleCampaignRetry)
                : isDailyChallengeRef.current
                  ? handleDailyChallengeRetry
                  : isWeeklyChallengeRef.current
                    ? handleStartWeeklyChallenge
                    : handlePlayAgain
            }
            onMainMenu={handleMainMenu}
            campaignAbandon={isCampaignRef.current ? handleAbandonRun : undefined}
            quickPlayHint={quickPlayHint}
            showStreak={!isCampaignRef.current && worldBattleNodeIdRef.current === null && !isDailyChallengeRef.current && !isWeeklyChallengeRef.current}
            dailyChallengeState={isDailyChallengeRef.current ? dcGameOverState : undefined}
            worldBattle={worldBattleNodeIdRef.current !== null}
            singleBattle={isWandererBattleRef.current}
          />
        ) : (
          <>
            <Battlefield state={gameState} onPlayCard={handlePlayCard} onPlayAoeCard={handlePlayAoeCard} onGiveUp={handleGiveUp} onPause={setIsUserPaused} actTheme={actTheme} activeRelic={run?.activeRelic} showBossSplash={showBossSplash} activeModifiers={run && actData ? getModifiersByCount(actData, run.activeModifierCount) : []} isCampaign={isCampaign} stance={gameState.playerStance ?? 'auto'} onSetStance={handleSetStance} speedMultiplier={speedMultiplier} onCycleSpeed={handleCycleSpeed} onCounterSpell={() => dispatch({ type: 'COUNTER_SPELL' })} isAdmin={isAdminUser(user)} />
            {showBossShockwave && <BossShockwave onDone={() => dispatch({ type: 'HIDE_BOSS_SHOCKWAVE' })} />}
            {activeRareEvent === 'fakeCrash'   && <FakeCrashEvent   onDone={handleRareEventDone} />}
            {activeRareEvent === 'blackjack'   && <BlackjackEvent   onDone={handleRareEventDone} />}
            {activeRareEvent === 'wrongNumber' && <WrongNumberEvent onDone={handleRareEventDone} />}
            {activeRareEvent === 'narrator'    && <NarratorEvent    onDone={handleRareEventDone} />}
            {activeRareEvent === 'liarsDice'   && <LiarsDiceEvent   onDone={handleRareEventDone} />}
            {activeRareEvent === 'gambler'     && <GamblerEvent     onDone={handleRareEventDone} />}
            {activeRareEvent === 'devBuild'       && <DevBuildEvent       onDone={handleRareEventDone} />}
            {activeRareEvent === 'glitchedCard'   && <GlitchedCardEvent   onDone={handleRareEventDone} />}
            {activeRareEvent === 'confusedTourist' && <ConfusedTouristEvent onDone={handleRareEventDone} />}
          </>
        )
      })()}
    </>
  )
}
