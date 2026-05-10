# Awards Tab Redesign

**Date:** 2026-05-10
**Status:** design

## Problem

The current `PlayerAwardsCard` (rendered inside the Highlights tab on `PlayerPage`) feels clunky:

- Three competing chip styles in one card — large gold-gradient legendary chips, mid-weight major chips, small selection pills — fight visually.
- The gold gradient (`#d4af37`) reads as disconnected from Scorva's brand orange (`#e8863a`).
- The legendary chips render like generic stat cards (huge tabular numerals + tiny label) rather than career honors.
- Awards live below the ratings section in the Highlights tab, so they're buried for players where awards are the headline (e.g. multi-MVPs).

## Goals

1. Replace the three-chip layout with a single editorial-typography language that scales from 1 award to 50.
2. Promote awards to a top-level tab on `PlayerPage`, to the right of Highlights.
3. Hide the tab entirely for players with zero awards (most of the league).

## Non-goals

- Trophy photography or licensed imagery.
- Restructuring `groupAwards` / `awardTiers.js` — tier classification stays as-is.
- Server-side changes — the awards payload shape is unchanged.
- Search / filter / sort UI inside the card.

## Design

### Visual language: editorial typographic rows

Replace `LegendaryChip`, `MajorChip`, `SelectionPill` with a single `AwardRow` component. One row per award type, three columns:

```
[ Award name ───────────── Years inline / "N selections" ───────── Count ]
```

Hierarchy comes from typographic scale + color, not from chip shape:

| Tier | Name size / weight | Name color | Count size / color |
|---|---|---|---|
| Legendary | 14px / 600 | `text-text-primary` | 22px / 600 / `text-accent` |
| Major | 13px / 500 | `text-text-primary` (slight desaturate) | 16px / 500 / `text-text-primary` |
| Selection | 12px / 400 | `text-text-secondary` | 13px / 500 / `text-text-secondary` |

Tier labels (`Legendary`, `Major Honors`, `Selections`) remain as section headers — same `text-[10px] uppercase tracking-[0.16em] text-text-tertiary` styling as today.

Rows separated by `border-b border-white/[0.06]`, last row in each tier no border. Vertical padding `py-2.5`.

### Years column behavior

- If `award.count <= 4`: render seasons joined by `, ` (e.g. `'08-09, '09-10, '11-12, '12-13`). Row is not clickable.
- If `award.count > 4`: years column is empty — the count column already communicates the magnitude. Row becomes clickable; click toggles a detail strip below the row that reveals the full season list, reusing the existing `DetailStrip` component (`role="status"`, `aria-live="polite"`, height-based reveal).
- Visual affordance for clickable rows: `cursor-pointer` + `hover:bg-white/[0.02]` row background, plus a subtle `+` glyph in the years column that rotates to `×` (or just disappears) when expanded. The affordance stays light because most rows aren't clickable.
- Click-outside / Escape close behavior: keep current — the existing `useEffect` block on `cardRef` is reused unchanged.

### Card chrome

- Same outer card treatment as today: `bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]`.
- Drop the `mb-12` — the card is the only thing in the tab now, so external spacing is the tab container's job.
- Header eyebrow stays: `text-xs uppercase tracking-[0.14em] text-text-tertiary mb-6` reading `Career Honors`.

### Empty / loading state

- Card is never rendered when `awards.length === 0` (it returns null today; behavior preserved).
- The Awards tab itself is not rendered when awards are empty — see below.

## Tab integration on PlayerPage

`PlayerPage.jsx` currently has two tabs: `profile`, `highlights`. Add a third: `awards`, to the right of `highlights`, conditional on `playerData.awards?.length > 0`.

### TABS array becomes computed

The static `TABS` const is replaced with a computed value inside the component (after `playerData` is loaded), so the awards entry is filtered out for players without awards. `ALLOWED_TABS` becomes computed alongside.

### Tab parameter handling

If a user lands on `?tab=awards` for a player with no awards (e.g. via shared URL), the tab parameter falls through `ALLOWED_TABS` validation and resolves to `profile` — the existing fallback already handles this case.

### SwipeableTabs entries

The `tabs` prop on `SwipeableTabs` is built conditionally:

```js
const tabContent = [
  { id: "profile",    content: profileContent },
  { id: "highlights", content: highlightsContent },
  ...(hasAwards ? [{ id: "awards", content: awardsContent }] : []),
];
```

`awardsContent` is a thin wrapper:

```jsx
const awardsContent = <PlayerAwardsCard awards={playerData.awards} />;
```

`PlayerAwardsCard` is removed from `highlightsContent` — Highlights becomes ratings-only (NBA) or empty placeholder (other leagues, which already had no ratings to show).

### Highlights tab fallback

For non-NBA leagues, `highlightsContent` was previously: `<PlayerRatingsSection />` (gated by `ratingsAvailable`) + `<PlayerAwardsCard />`. With awards moved out, NHL/NFL highlights renders an empty fragment. Two options:

- **a)** Keep the highlights tab visible but empty — looks broken.
- **b)** Hide the highlights tab too when its content would be empty.

Going with **b**. Highlights tab becomes conditional on `ratingsAvailable` (i.e. NBA only). Same pattern as the new awards conditional.

### Tab pill indicator

The existing sliding-underline `tabBounds` logic in `useLayoutEffect` already keys on `tab` and `loading`. It will need to also re-measure when the tabs array changes (e.g. awards arrive after data load). Adding `playerData` to the effect's dep array is the simplest fix; alternatively rebuild the ref array length each render (already implicit since `tabRefs.current[i]` is reassigned inline).

## Architecture / file changes

| File | Change |
|---|---|
| `frontend/src/components/cards/PlayerAwardsCard.jsx` | Rewrite. Replace 3 chip components with 1 `AwardRow`. Drop the gold gradient styling. Keep the `useState`/`useRef`/`useEffect` plumbing for click-outside-to-close. Keep `DetailStrip`. |
| `frontend/src/pages/PlayerPage.jsx` | Make `TABS` / `ALLOWED_TABS` computed inside component. Add `awards` tab entry conditional on `awards.length > 0`. Move `PlayerAwardsCard` out of `highlightsContent` into new `awardsContent`. Add `playerData` to the tab-bounds effect dep array. |
| `frontend/src/__tests__/components/PlayerAwardsCard.test.jsx` | Update DOM assertions: query by row, not chip class names. Existing tests cover empty/undefined, render-by-tier, click-to-expand-and-collapse, click-outside-to-close, escape-to-close — all behavior preserved. |

No backend, no service, no data shape changes.

## Testing plan

Frontend (Vitest + RTL):

1. **`PlayerAwardsCard` tests** (rewritten):
   - Returns null for empty / undefined awards (preserved).
   - Renders one row per award, grouped under the right tier label.
   - Rows with `count <= 4` show comma-joined seasons inline; not clickable.
   - Rows with `count > 4` show `{count} selections` summary; clickable.
   - Clicking a clickable row toggles the detail strip with full season list.
   - Pressing Escape closes the detail strip.
   - Clicking outside the card closes the detail strip.
2. **`PlayerPage` tab tests** (new or extended):
   - Awards tab visible when player has awards.
   - Awards tab hidden when player has none.
   - Highlights tab hidden for non-NBA leagues (since ratings + awards are both moved/unavailable).
   - Loading `?tab=awards` for a player with no awards falls back to profile.

Manual:
- Visit a high-award player (e.g. LeBron, slug `lebron-james`) on NBA — verify all three tiers render correctly with new typography.
- Visit a 1-award player — verify only the relevant tier section renders.
- Visit a 0-award player — verify the awards tab is absent.
- Visit a non-NBA player — verify highlights tab is also absent.
- Tab indicator slides correctly between profile / highlights / awards.

## Open questions

None blocking.
