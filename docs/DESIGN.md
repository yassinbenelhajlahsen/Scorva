# Scorva — Design System

## Framework
Tailwind v4 — config only in `frontend/src/index.css` (`@theme`). No `tailwind.config.js`.

## Design tokens (defined in `@theme`)

### Surfaces
| Token | Value |
|---|---|
| `surface-base` | #0a0a0c |
| `surface-primary` | #111114 |
| `surface-elevated` | #1a1a1f |
| `surface-overlay` | #222228 |

### Text
| Token | Value |
|---|---|
| `text-primary` | #f5f5f7 |
| `text-secondary` | #a1a1a6 |
| `text-tertiary` | #6e6e73 |

### Accent & semantic
| Token | Value |
|---|---|
| `accent` | #e8863a |
| `accent-hover` | #f0974d |
| `win` | #34c759 |
| `loss` | #ff453a |
| `live` | #ff9f0a |

### Font
Inter via Google Fonts — overrides `--font-sans`.

## Core patterns

### Card
```
bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)]
```

### Card hover
```
hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5
```
Never use `hover:scale-105` — always use `-translate-y-0.5` lift.

### Transitions
```
transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]
```

### Framer Motion stagger
`staggerChildren: 0.06`, items `y: 12→0` 0.35s ease.

### Navbar
```
sticky top-0 z-50 bg-[rgba(10,10,12,0.88)] backdrop-blur-2xl border-b border-white/[0.06]
```

### Content max-width
```
max-w-[1200px] mx-auto
```

### Primary button
```
bg-accent text-white rounded-full hover:bg-accent-hover hover:shadow-[0_0_24px_rgba(232,134,58,0.3)]
```

## Component conventions

### Skeleton
`frontend/src/components/ui/Skeleton.jsx` — `animate-pulse bg-white/[0.06] rounded-lg`, className overridable.
Page-specific skeletons in `frontend/src/components/skeletons/` mirror real content layout.

### ErrorState
`frontend/src/components/ui/ErrorState.jsx` — card with warning icon + message + optional "Try Again" button.
Centered via `min-h-[60vh] flex items-center justify-center px-4 sm:px6`. Props: `{ message?, onRetry? }`.

### Auth modal
Fully centered on all screen sizes, dismissible via outside click, scrollable content, `max-h-[90dvh]`. Close button always visible.

## Settings page (`/settings`)
Sidebar navigation (desktop) / drill-down (mobile). Tabs: Favorites and Account.
Navbar shows gear icon → `/settings` when logged in; "Sign In" pill when logged out.

## Game clock colors
- GamePage clock/period text (`Q3 · 5:32`): `text-loss` (red `#ff453a`)
- GameCard clock: `text-live/70` (orange)
- "Live" badge: `text-live` in both

## Game type logos
`/NBA/NBAPlayoff.png`, `/NBA/NBAFinal.png`, `/NFL/NFLPlayoff.png`, `/NFL/NFLFinal.png`, `/NHL/NHLPlayoff.png`, `/NHL/NHLFinal.png`
