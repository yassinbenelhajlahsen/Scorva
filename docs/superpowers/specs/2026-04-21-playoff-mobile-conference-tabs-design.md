# Playoff Bracket Mobile Conference Tabs

**Date:** 2026-04-21  
**Scope:** `frontend/src/components/playoffs/PlayoffsBracket.jsx` only

## Problem

On mobile the existing playoff bracket renders two `ConferenceColumn`s stacked vertically. Each column uses `grid-cols-3` (one column per round), producing six cramped card columns on a ~375px screen.

## Solution

Below the `lg` breakpoint, replace the two stacked conference columns with:
- A pill tab strip to switch between conferences (East/West or AFC/NFC)
- A single-conference view showing rounds stacked vertically with full-width `SeriesCard`s

At `lg+` the existing two-column desktop layout is unchanged.

## Breakpoints

- **Mobile**: `< lg` — conference tabs + vertical round list  
- **Desktop**: `lg+` — current side-by-side layout, no changes

## New Internal Components

### `MobileConferenceTabs`

Props: `{ conferences, activeConf, onPick }`

- Pill tab strip matching the existing app pill style:  
  container `bg-surface-elevated border border-white/[0.08] rounded-full p-1 flex gap-0`
- Static active highlight (no animated sliding pill — secondary nav inside an already-tabbed page):  
  active button `bg-accent/15 border border-accent/25 text-accent rounded-full`  
  inactive `text-text-secondary`
- Hidden at `lg+` via `lg:hidden`

### `MobileConferenceView`

Props: `{ block, labels, league, direction }`

- Iterates `labels.bracketKeys`; for each key renders:
  - Round section heading: `text-[10px] font-semibold uppercase tracking-widest text-text-tertiary`
  - `flex flex-col gap-3` of `SeriesCard`s (full-width, one per row)
- `AnimatePresence` with directional x-slide on conference switch:  
  `initial: { x: direction * 30, opacity: 0 }` → `animate: { x: 0, opacity: 1 }` → `exit: { x: direction * -30, opacity: 0 }`  
  Duration 0.22s, `ease: [0.22, 1, 0.36, 1]`
- Wrapped in `lg:hidden`

## State Added to `PlayoffsBracket`

| State | Type | Default | Purpose |
|---|---|---|---|
| `activeMobileConf` | string | `confA.key` | Which conference tab is active |
| `mobileTabDirection` | number | 1 | Slide direction for `MobileConferenceView` animation |

`pickConf(key)` sets direction (`confB → confA = -1`, `confA → confB = 1`) then sets `activeMobileConf`.

## Layout Structure (mobile)

```
FinalsSection          ← unchanged, centered card
MobileConferenceTabs   ← [Eastern] [Western]  (lg:hidden)
MobileConferenceView   ← animated, shows active conf rounds (lg:hidden)
  [First Round]
    SeriesCard
    SeriesCard
    SeriesCard
    SeriesCard
  [Conf. Semis]
    SeriesCard
    SeriesCard
  [Conf. Finals]
    SeriesCard
```

## Layout Structure (desktop, unchanged)

```
FinalsSection
grid-cols-2
  ConferenceColumn (Eastern)   ConferenceColumn (Western)
    grid-cols-3                  grid-cols-3
```

## Out of Scope

- `PlayInSection` — already has its own `md:hidden` / `hidden md:flex` mobile layout
- `SeriesCard`, `PlayoffsSkeleton`, `LEAGUE_LABELS` — no changes
- `PlayoffsBracket` desktop layout — no changes
