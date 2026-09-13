import React from 'react'

interface Props {
  featureThreshold: number
  featureBonusCredits: number
}

export function PaytableDetails({ featureThreshold, featureBonusCredits }: Props) {
  return (
    <>
      {/* How to play */}
      <details className="fm-paytable">
        <summary>How to play</summary>
        Spin the reels match symbols for a prize. Getting the feature 🌟 symbol increases the feature level, hit 5 and the trail will progress. the trail is long, reach the end and you'll get the JACKPOT!!!<br />
        Everyone who plays the game is contributing to the jackpot, and there can only be one winner. Once it's been won the jackpot will reset.
      </details>

      {/* Payout reference */}
      <details className="fm-paytable">
        <summary>Payout table</summary>
        <table className="fm-paytable-table">
          <tbody>
            <tr><td>🃏🃏🃏</td><td>40 credits (triple wild)</td></tr>
            <tr><td>💎💎💎</td><td>50 credits</td></tr>
            <tr><td>⭐⭐⭐</td><td>30 credits</td></tr>
            <tr><td>🔔🔔🔔</td><td>20 credits</td></tr>
            <tr><td>Any triple</td><td>10 credits</td></tr>
            <tr><td>💎💎 pair</td><td>5 credits</td></tr>
            <tr><td>⭐⭐ pair</td><td>3 credits</td></tr>
            <tr><td>Any pair</td><td>2 credits</td></tr>
            <tr><td>🍒 on reel 1</td><td>1 credit</td></tr>
            <tr><td>🃏 Wild</td><td>substitutes for any symbol</td></tr>
            <tr><td>💰💰 Bonus</td><td>4 credits (scatter)</td></tr>
            <tr><td>💰💰💰 Bonus</td><td>15 credits (scatter)</td></tr>
            <tr><td>🌟 Feature ×{featureThreshold}</td><td>+{featureBonusCredits} credits</td></tr>
          </tbody>
        </table>
      </details>
    </>
  )
}
