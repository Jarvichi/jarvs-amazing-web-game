import React from 'react'

/**
 * The game's icon set (#2172), replacing OS-rendered emoji so iconography
 * looks the same on iOS/Android/desktop and doesn't clash with the 2,535
 * hand-made sprite SVGs. Simple geometric shapes at 24x24, matching the
 * sprite set's blocky, flat-shaded language but drawn in a single
 * `currentColor` so each icon themes with whatever text colour surrounds it.
 *
 * Mount <IconSprite /> once near the app root; every <Icon name="..." />
 * instance references a <symbol> here via <use>, so the markup for all 23
 * icons is only ever parsed once regardless of how many places render them.
 */
export const ICON_NAMES = [
  'player', 'deck', 'collection', 'shop', 'codex', 'chronicle', 'news',
  'settings', 'trophy', 'minigames', 'sword', 'infinity', 'hub', 'crystal',
  'lock', 'coin', 'heart', 'mana', 'back-arrow', 'close', 'info', 'filter',
  'search', 'calendar',
] as const

export type IconName = typeof ICON_NAMES[number]

export function IconSprite() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" style={{ display: 'none' }} aria-hidden="true">
      <defs>
        <symbol id="icon-player" viewBox="0 0 24 24">
          <circle cx="12" cy="7" r="4" />
          <path d="M4 21v-1c0-4.4 3.6-8 8-8s8 3.6 8 8v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
        </symbol>

        <symbol id="icon-deck" viewBox="0 0 24 24">
          <rect x="4" y="8" width="12" height="15" rx="1.5" transform="rotate(-10 10 15.5)" opacity="0.55" />
          <rect x="7" y="3" width="13" height="17" rx="1.5" />
        </symbol>

        <symbol id="icon-collection" viewBox="0 0 24 24">
          <path d="M3 8.5 5 4h14l2 4.5V20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20z" />
          <rect x="3" y="8" width="18" height="2" opacity="0.5" />
        </symbol>

        <symbol id="icon-shop" viewBox="0 0 24 24">
          <path d="M8 8Q12 1 16 8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M5 8h14l-1.4 11.5a1.5 1.5 0 0 1-1.5 1.5H7.9a1.5 1.5 0 0 1-1.5-1.5z" />
        </symbol>

        <symbol id="icon-codex" viewBox="0 0 24 24">
          <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 1 4 19.5z" />
          <rect x="4" y="3" width="2.6" height="18" opacity="0.55" />
        </symbol>

        <symbol id="icon-chronicle" viewBox="0 0 24 24">
          <rect x="5" y="5" width="14" height="14" rx="1" />
          <ellipse cx="12" cy="5" rx="7" ry="2" />
          <ellipse cx="12" cy="19" rx="7" ry="2" />
        </symbol>

        <symbol id="icon-news" viewBox="0 0 24 24">
          <path d="M4 4h13a1 1 0 0 1 1 1v13.5A1.5 1.5 0 0 0 19.5 20H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <rect x="7" y="7.5" width="7" height="4.5" opacity="0.6" />
          <rect x="7" y="14" width="10" height="1.6" opacity="0.6" />
          <rect x="16" y="7.5" width="1.6" height="4.5" opacity="0.6" />
        </symbol>

        <symbol id="icon-settings" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M12 2.5a1.4 1.4 0 0 1 1.37 1.12l.24 1.16a7.6 7.6 0 0 1 1.87.78l1-.63a1.4 1.4 0 0 1 1.75.19l.98.98a1.4 1.4 0 0 1 .19 1.75l-.63 1a7.6 7.6 0 0 1 .78 1.87l1.16.24a1.4 1.4 0 0 1 1.12 1.37v1.4a1.4 1.4 0 0 1-1.12 1.37l-1.16.24a7.6 7.6 0 0 1-.78 1.87l.63 1a1.4 1.4 0 0 1-.19 1.75l-.98.98a1.4 1.4 0 0 1-1.75.19l-1-.63a7.6 7.6 0 0 1-1.87.78l-.24 1.16A1.4 1.4 0 0 1 12 21.5a1.4 1.4 0 0 1-1.37-1.12l-.24-1.16a7.6 7.6 0 0 1-1.87-.78l-1 .63a1.4 1.4 0 0 1-1.75-.19l-.98-.98a1.4 1.4 0 0 1-.19-1.75l.63-1a7.6 7.6 0 0 1-.78-1.87l-1.16-.24A1.4 1.4 0 0 1 2.5 12v-1.4a1.4 1.4 0 0 1 1.12-1.37l1.16-.24a7.6 7.6 0 0 1 .78-1.87l-.63-1a1.4 1.4 0 0 1 .19-1.75l.98-.98a1.4 1.4 0 0 1 1.75-.19l1 .63a7.6 7.6 0 0 1 1.87-.78l.24-1.16A1.4 1.4 0 0 1 12 2.5zm0 6a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" />
        </symbol>

        <symbol id="icon-trophy" viewBox="0 0 24 24">
          <path d="M7 4h10v6a5 5 0 0 1-10 0z" />
          <path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <rect x="10.5" y="15" width="3" height="4" />
          <rect x="7" y="19" width="10" height="2" rx="1" />
        </symbol>

        <symbol id="icon-minigames" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <circle cx="9" cy="9" r="1.5" fill="var(--game-bg, #0a0a0a)" />
          <circle cx="15" cy="9" r="1.5" fill="var(--game-bg, #0a0a0a)" />
          <circle cx="9" cy="15" r="1.5" fill="var(--game-bg, #0a0a0a)" />
          <circle cx="15" cy="15" r="1.5" fill="var(--game-bg, #0a0a0a)" />
          <circle cx="12" cy="12" r="1.5" fill="var(--game-bg, #0a0a0a)" />
        </symbol>

        <symbol id="icon-sword" viewBox="0 0 24 24">
          <rect x="10.8" y="2" width="2.4" height="12" rx="1" />
          <rect x="7.5" y="13" width="9" height="2.2" rx="1" />
          <rect x="10.4" y="15" width="3.2" height="5" rx="1.2" />
          <circle cx="12" cy="21" r="1.4" />
        </symbol>

        <symbol id="icon-infinity" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M7 8a4.5 4.5 0 0 0 0 9c1.9 0 3.1-1.1 4-2.3l1-1.4 1 1.4c.9 1.2 2.1 2.3 4 2.3a4.5 4.5 0 0 0 0-9c-1.9 0-3.1 1.1-4 2.3l-1 1.4-1-1.4C10.1 9.1 8.9 8 7 8zm0 2.6c.83 0 1.5.5 2.2 1.5l.5.7-.5.7c-.7 1-1.37 1.5-2.2 1.5a2.1 2.1 0 0 1 0-4.4zm10 0a2.1 2.1 0 0 1 0 4.4c-.83 0-1.5-.5-2.2-1.5l-.5-.7.5-.7c.7-1 1.37-1.5 2.2-1.5z" />
        </symbol>

        <symbol id="icon-hub" viewBox="0 0 24 24">
          <path d="M12 3 3 10.5V21h6v-6h6v6h6V10.5z" />
        </symbol>

        <symbol id="icon-crystal" viewBox="0 0 24 24">
          <path d="M12 2 5 8l7 14 7-14z" />
          <path d="M5 8h14L12 2z" opacity="0.6" />
        </symbol>

        <symbol id="icon-lock" viewBox="0 0 24 24">
          <path d="M7 10V7.5a5 5 0 0 1 10 0V10" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <rect x="4.5" y="10" width="15" height="11" rx="2" />
          <rect x="11" y="14" width="2" height="4" rx="1" fill="var(--game-bg, #0a0a0a)" />
        </symbol>

        <symbol id="icon-coin" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="6.2" fill="none" stroke="var(--game-bg, #0a0a0a)" strokeWidth="1.4" />
        </symbol>

        <symbol id="icon-heart" viewBox="0 0 24 24">
          <path d="M12 20.5S3 14.8 3 8.8A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9 2.8c0 6-9 11.7-9 11.7z" />
        </symbol>

        <symbol id="icon-mana" viewBox="0 0 24 24">
          <path d="M12 2S5 12 5 16a7 7 0 0 0 14 0c0-4-7-14-7-14z" />
        </symbol>

        <symbol id="icon-back-arrow" viewBox="0 0 24 24">
          <path d="M11 4 4 12l7 8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 12h16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </symbol>

        <symbol id="icon-close" viewBox="0 0 24 24">
          <rect x="11" y="2" width="2" height="20" rx="1" transform="rotate(45 12 12)" />
          <rect x="11" y="2" width="2" height="20" rx="1" transform="rotate(-45 12 12)" />
        </symbol>

        <symbol id="icon-info" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9.5" />
          <rect x="10.8" y="10.5" width="2.4" height="7" rx="1" fill="var(--game-bg, #0a0a0a)" />
          <circle cx="12" cy="7.2" r="1.5" fill="var(--game-bg, #0a0a0a)" />
        </symbol>

        <symbol id="icon-filter" viewBox="0 0 24 24">
          <path d="M3 4h18l-6.5 8v6l-5 3v-9z" />
        </symbol>

        <symbol id="icon-search" viewBox="0 0 24 24">
          <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <rect x="17.5" y="15.5" width="2.6" height="7" rx="1.3" transform="rotate(-45 18.8 19)" />
        </symbol>

        <symbol id="icon-calendar" viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <path d="M3 9.5h18" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <rect x="6.8" y="2" width="2.4" height="5" rx="1.2" />
          <rect x="14.8" y="2" width="2.4" height="5" rx="1.2" />
        </symbol>
      </defs>
    </svg>
  )
}
