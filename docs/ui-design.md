# UI / Component Design Reference

Read this before any task that touches look-and-feel: new components, visual
redesigns, styling tweaks, animations, or anything under `web/src/styles/` or
`web/src/components/ui/`. It complements AGENTS.md's **CSS Styling Rules** and
**Component Extraction and Storybook Stories** sections (still canonical for
those two topics) with the fuller design-system inventory and the verification
workflow this project actually uses for visual work.

## Design tokens — `web/src/styles/tokens.css`

Every colour, font, spacing value, radius, shadow, and z-index used by shared
UI lives here as a CSS custom property. **Never hardcode a raw hex colour or
pixel value that already has a token**, and never reach for `!important` to
win a specificity fight — fix the selector instead. Key groups:

- **Palette:** `--color-gold`, `--color-gold-alt`, `--color-gold-dim`,
  `--color-gold-light`, `--color-red`, `--color-orange`, `--color-green-bright`,
  `--color-gray-3` through `--color-gray-10`.
- **Accents** (semantic, not raw colour): `--accent-gold` (rewards/rarity/
  economy), `--accent-ember` (danger/damage), `--accent-arcane` (magic/
  upgrades), `--accent-blood` (enemy). Reach for these over the raw palette
  colours when the meaning is one of these four.
- **Text:** `--game-text-color` (the CRT-green theme colour) plus
  `--game-text-color-dim`/`--game-text-color-muted` (opacity-mixed variants),
  `--text-primary` (neutral `#e8e8e8` for content that shouldn't inherit the
  green — card names, body copy), `--text-inverse`.
- **Surfaces:** `--surface-0` (page) through `--surface-4` (popover/floating).
  0-2 alias the older `--game-bg`/`--game-bg-raised`/`--game-bg-card` exactly.
- **Elevation:** `--elevation-flat` / `--elevation-raised` / `--elevation-overlay`
  — neutral depth shadows. Use `color-mix(in srgb, <token> N%, transparent)`
  for glows/tints rather than a new hardcoded rgba.
- **Borders:** `--border-edge`, `--border-edge-dark`.
- **Radius:** `--radius-sm` (2px) / `--radius-md` (4px) / `--radius-lg` (6px).
- **Fonts:** `--font-display` (Cinzel — titles, logo, card names, headers),
  `--font-body` (Spectral — descriptions, dialogue, tooltips), `--font-mono`
  (JetBrains Mono — HP/mana/costs/timers/log, for tabular figures). Size scale
  `--font-xxs` through `--font-xl`, plus `--font-display-xl` for the title logo.
- **Spacing:** `--gap-1` (2px) through `--gap-8` (20px).
- **Motion:** `--dur-fast` (0.15s) / `--dur-normal` (0.3s) / `--dur-slow` (0.5s)
  / `--dur-xslow` (0.8s).
- **Focus ring:** `--focus-ring` / `--focus-ring-offset` — applied globally via
  `:focus-visible` in `base.css`. Don't build a bespoke focus treatment.
- **Z-index:** `--z-dropdown` / `--z-modal` (both 200), `--z-toast` (9000),
  `--z-debug` (9999).
- **Breakpoints:** `--breakpoint-tablet` (768px) / `--breakpoint-desktop`
  (1024px) / `--breakpoint-desktop-lg` (1440px), mirrored in
  `web/src/breakpoints.ts` (`BREAKPOINT.tablet/desktop/desktopLg`) — use the TS
  constant in component logic, the CSS var in style values. **Custom
  properties don't work inside an `@media` condition** in this setup (no
  Custom Media Queries plugin), so every `@media (min-width: …)` rule repeats
  the literal pixel value; `breakpoints.test.ts` checks those literals against
  `breakpoints.ts` so they can't silently drift apart.

Light mode was retired in #2184 rather than themed — don't add
`prefers-color-scheme`/light-mode overrides.

## Shared component primitives — `web/src/components/ui/`

Reach for these before writing new markup+CSS from scratch:

- **`Button.tsx`** — `<Button size="xs|sm|md|lg" variant="default|gold|danger|ghost">`.
  Wraps the `action-btn` CSS classes (`action-btn--xs/sm/large`,
  `action-btn--gold/danger/ghost`). This is the only way most code should
  reach `action-btn` — the raw class names in AGENTS.md's CSS section are for
  cases the component can't cover (e.g. building a fully custom control that
  still wants the same visual language, like the clover pickers in
  `battle/battlefield/`).
- **`Panel.tsx`** — `<Panel elevation="flat|raised|floating" tone="neutral|gold|danger|arcane" runeCorners>`.
  The standard bordered surface container.
- **`Section.tsx`** — titled content block (`<Section title="..." bordered headerRight={...}>`).
- **`ModalBackdrop.tsx`** / **`Modal.tsx`** — standardised modal shell (#2174).
  Handles the shared modal stack (topmost-only Esc/Tab-trap via
  `useSyncExternalStore`), scroll lock, and backdrop. Build new modals on this
  rather than a bespoke `position: fixed` overlay.
- **`Toast.tsx`** — shared toast/notification primitive (#2173).
- **`OverlayScreen.tsx`** — full-screen overlay shell; has a `--bleed` variant
  for content that intentionally ignores `--container-pad-x/y`.
- **`PageHeader.tsx`**, **`ProgressBar.tsx`**, **`StatRow.tsx`**,
  **`MasteryBar.tsx`** — smaller reusable pieces, self-explanatory from name.
- **`icons/Icon.tsx`** + **`icons/IconSprite.tsx`** — `<Icon name="..." size={20} aria-label="...">`
  (#2172). One `<IconSprite />` mounted near the app root; `Icon` references a
  `<symbol>` via `<use>` so markup for all icons parses once. Icons are flat
  24×24 `currentColor` shapes matching the sprite set's blocky style. Current
  `ICON_NAMES` (`icons/IconSprite.tsx`): player, deck, collection, shop,
  codex, chronicle, news, settings, trophy, minigames, sword, infinity, hub,
  crystal, lock, coin, heart, mana, back-arrow, close, info, filter, search,
  calendar. **Adding a new icon means adding both a name to `ICON_NAMES` and a
  `<symbol>` to `IconSprite.tsx`** — there's no icon for shield/hourglass/etc.
  yet as of this writing.
- **`filters/`** (`FilterOption.tsx`, `FilterPopup.tsx`) — trigger-button +
  dropdown + outside-click-to-close shell used by Collection/deck-builder
  filter menus. `useClickOutsideToClose` (`web/src/hooks/`) is the extracted
  outside-click/Escape hook if you need that behaviour without the rest of
  `FilterPopup`.

## Utility classes — `web/src/styles/utilities.css`

Prefix `u-`. Layout: `u-flex`, `u-col`, `u-row`, `u-wrap`, `u-center`,
`u-items-c`/`u-items-end`, `u-just-c`/`u-just-sb`/`u-just-end`, `u-grow`. Text:
`u-text-c`/`u-text-r`, `u-text-xs` through `u-text-lg`, `u-text-gold`/`u-text-dim`/
`u-text-muted`/`u-text-red`. Spacing: `u-gap-1` through `u-gap-7`,
`u-pad-sm/md/lg`, `u-mg-sm/md/lg` and directional `u-mg-{l,r,t,b}-{sm,md,lg}`.
Reach for these before writing a one-off inline `style={{display:'flex',...}}`
or a single-purpose class that just sets `gap`/`padding`.

## Stylesheet organization — `web/src/styles/`

Split by domain (#2169), not one monolith: `tokens.css`, `base.css`,
`buttons.css`, `panels.css`, `modals.css`, `utilities.css`, then one file per
screen family — `battle.css`, `battle-screens.css`, `cards.css`, `campaign.css`,
`campaign-events.css`, `collection.css`, `collection-meta.css`, `hub.css`,
`minigames-1.css` through `-4.css`, `rare-events.css`, `title.css`. Add new
rules to the file matching their domain; only start a new file for a genuinely
new domain, not a handful of rules that fit an existing one.

## Component extraction & Storybook

See AGENTS.md's **Component Extraction and Storybook Stories** section for the
full pattern (sub-component folders, one `.stories.tsx` per extracted piece,
pure-visual props-only sub-components). The clover pickers in
`battle/battlefield/` (`StanceBar.tsx`, `SpeedClover.tsx`,
`cloverGeometry.ts`) are a recent example: shared geometry extracted to its
own module once a second component needed the same shape math, each component
keeps its own `.stories.tsx` with both static-state stories and a `play`
function that clicks the collapsed control open and asserts the expanded
petal count — a cheap regression check for "wrong petal count for this
allowed-options case" that's easy to eyeball right in a screenshot but easy to
silently break in code.

## Press feedback

Every clickable element needs an `:active` state, not just `:hover` — see
AGENTS.md's **CSS Styling Rules** section. `:hover` never fires on touch.

## Verifying a visual change

`npm run build`/`npm run test` catch logic/type regressions but tell you
nothing about whether something actually *looks* right — for that, render it
and look, and verify anything geometry-dependent (positioning, curves,
alignment) with real numbers, not just eyeballing a screenshot. A screenshot
that's too small or low-contrast to read clearly is worse than no screenshot —
it produced three confidently-wrong "fixes" in a row during the clover label
work before switching to DOM measurement caught the actual bug.

**1. Start Storybook against real components**, per AGENTS.md's Verifying
Changes section (copy `web/.env.test` → `web/.env.local` first, gitignored,
required for any story that touches Firebase-backed code):
```bash
cd web && cp .env.test .env.local
npx storybook dev -p <port> --ci
```
Poll `http://localhost:<port>/index.json` until it 200s rather than a fixed
sleep — first boot takes several seconds. That same `index.json` lists every
story's id (`<kebab-title>--<kebab-export-name>`), which is what you need for
the next step.

**2. Screenshot the specific story with Playwright**, not the running app —
faster, and isolates the one component under test from everything else on
screen:
```js
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 300, height: 300 }, deviceScaleFactor: 4 });
await page.goto(`http://localhost:<port>/iframe.html?id=<story-id>&viewMode=story`, { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/.../out.png' });
```
Use a real `deviceScaleFactor` (4+) for anything with small text or fine
detail — a low-res screenshot of curved/rotated text reads as ambiguous where
a zoomed one is unambiguous. If a story has a `play` function that opens a
collapsed control, `waitForTimeout` a few hundred ms after `goto` rather than
racing it.

**3. For anything position/geometry-sensitive, measure the DOM directly**
instead of trusting your own read of a screenshot:
```js
const info = await page.evaluate(() => {
  const el = document.querySelector('.some-el')
  return el.getBoundingClientRect()   // or distance-from-center, etc.
})
```
This is what actually resolved the clover label bugs: a screenshot alone
looked "probably fine" or "probably wrong" three different times in a row;
`getBoundingClientRect()` on the label text vs. the petal button it was
supposed to sit inside made the actual bug (a wrong-circle SVG arc, not just
a text-direction issue) unambiguous in one measurement.

**4. Clean up before committing** — delete any throwaway `.mjs` screenshot/
probe scripts and `web/.env.local`, and kill the Storybook process. None of
that belongs in a commit.

## Gotchas worth knowing before you hit them again

- **SVG `textPath` direction is not just cosmetic.** For an arc built from two
  points 90° apart, there are *two* circles of the same radius through those
  points (one on each side of the chord) — a fixed `sweep-flag` only traces
  the intended one for angle pairs going a particular direction. Get this
  wrong and the arc silently renders on the *other* circle: not just
  upside-down text, but text positioned outside the shape you meant to draw
  it in. Derive `sweep-flag` from the actual signed short-way direction
  between the two angles (see `arcPath()` in
  `battle/battlefield/cloverGeometry.ts`) rather than hardcoding it.
  Separately, reversing a path's direction to fix upside-down text also flips
  *which side* of the baseline the glyphs render on (browsers draw text on a
  fixed side relative to travel direction) — if you reverse direction for
  half your labels, expect to also compensate their radius/offset so they
  don't end up visibly closer to (or further from) the center than the
  other half.
- **Four-leaf-clover / radial picker shape** — a 2×2 (or 1×2) CSS grid where
  each cell is rounded *only* on its true outer corner
  (`border-top-left-radius` etc., 0 on the other three corners) with a small
  gap between cells renders as petals meeting at a shared center point. No
  `conic-gradient`, `clip-path`, or SVG needed for the shape itself — real
  `<button>` elements, trivially hit-testable. See `cloverGeometry.ts` +
  `.stance-petal*` in `battle.css` for the full pattern including the
  collapsed-tiny/expanded-large two-state version (a real button too small to
  subdivide into real per-option hit targets stays one button with decorative
  children; tapping it swaps in a `role="group"` of full-size real buttons).
