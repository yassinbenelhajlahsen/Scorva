# Mobile Experience Pass — Design Spec

**Date:** 2026-04-27
**Branch:** `feat/mobile`
**Status:** Design (pre-implementation)
**Follows:** PWA Foundation (2026-04-27-pwa-foundation-design.md)

## Goal

Make Scorva feel like a native iOS/Android app inside the standalone PWA shell. Three features (tab swipe, pull-to-refresh, panel swipe-to-close), three behavior locks (no pinch-zoom, no iOS history-swipe, no input auto-zoom), three polish items (44px touch targets, full safe-area audit, overscroll-background fix). One spec, one plan, one branch.

Out of scope: bottom navigation bar, swipe between leagues, swipe between game dates, haptic feedback, Android-specific gestures, replacing Framer Motion or adding new gesture libraries.

## Decisions locked during brainstorm

| Decision | Choice | Rationale |
|---|---|---|
| Swipe nav scope | Sub-tabs only (LeaguePage, GamePage) | League swipe + tab swipe interacts badly with horizontal-scroll containers (charts, tables); sub-tabs are the cleanest scope. |
| Pull-to-refresh scope | All data pages (Home, League, Player, Team, Game, Compare) | Static pages skipped (About, Privacy, Error). User accepted that PTR on rarely-changing pages still triggers the indicator — the affordance is consistent. |
| Bottom nav | Skipped | Current top navbar is already mobile-friendly (no hamburger, all 3 league links visible). Bottom nav would duplicate or fight existing nav. |
| Pinch-zoom | Disabled globally | User accepts WCAG 2.1 tradeoff for native-app feel. This also kills iOS input auto-zoom as a side effect. |
| iOS history swipe | Disabled via `touch-action: pan-y` on `<body>` | Single-property fix; coexists with Framer Motion drag for tab swipe (Framer Motion uses pointer events, not browser-handled gestures). |
| Input zoom (defense in depth) | Bump SearchBar (14px) and AccountTab (14px) to 16px regardless | `user-scalable=no` solves the auto-zoom on iOS, but 16px is the broader-browser safe value and reads better on mobile anyway. |
| Touch target size | 44px minimum (iOS HIG) | iPhone-dominant userbase; 48px (Material) is stricter but unnecessary here. |
| Touch target scope | All interactive elements | Add hit-area padding even when visual size stays smaller. |
| Gesture library | Framer Motion (existing dep) | Already used for animations; `drag` API handles all three gesture features. No new dependencies. |
| Overscroll background | `html` and `body` background = `#0a0a0c` (`surface-base` token) | Eliminates white/light-gray bleed during iOS rubber-band overscroll into safe areas. |
| Safe-area audit scope | Every fixed/sticky/absolute-positioned element + html bg | Comprehensive — the IOSInstallHint and ChatPanel got it right; sweep the rest (Navbar top, ChatFAB bottom, FavoritesPanel/SettingsDrawer, modals). |

## Architecture

```
frontend/
├── index.html                      # MODIFIED: viewport meta — add user-scalable=no, maximum-scale=1.0
├── src/
│   ├── index.css                   # MODIFIED: html/body bg, touch-action: pan-y on body,
│   │                               #           input font-size baseline, overscroll-behavior
│   ├── hooks/
│   │   ├── usePullToRefresh.js     # NEW — drag-at-top → refetch, returns { containerRef, indicator state }
│   │   ├── useSwipeableTabs.js     # NEW — horizontal swipe → tab change
│   │   └── useSwipeToClose.js      # NEW — drag panel past threshold → close()
│   ├── components/
│   │   ├── ui/
│   │   │   ├── PullToRefresh.jsx   # NEW — wrapper component using usePullToRefresh hook
│   │   │   └── SwipeableTabs.jsx   # NEW — animated tab content with swipe + slide transition
│   │   ├── layout/
│   │   │   └── Navbar.jsx          # MODIFIED: safe-area top inset, 44px touch targets on links/star button
│   │   ├── chat/
│   │   │   ├── ChatPanel.jsx       # MODIFIED: drag-to-close (right), 44px targets on close/reset
│   │   │   └── ChatFAB.jsx         # MODIFIED: safe-area bottom inset
│   │   ├── favorites/
│   │   │   └── FavoritesPanel.jsx  # MODIFIED: drag-to-close, safe-area, 44px close button
│   │   ├── settings/
│   │   │   └── SettingsDrawer.jsx  # MODIFIED: drag-to-close, safe-area, 44px close button
│   │   ├── pwa/
│   │   │   └── IOSInstallHint.jsx  # MODIFIED: drag-down to close
│   │   └── ui/
│   │       ├── SearchBar.jsx       # MODIFIED: input font-size 16px
│   │       └── (icon buttons)      # MODIFIED in place — 44px targets
│   ├── pages/
│   │   ├── Homepage.jsx            # MODIFIED: wrap with <PullToRefresh>
│   │   ├── LeaguePage.jsx          # MODIFIED: <PullToRefresh> + <SwipeableTabs> for tab content
│   │   ├── GamePage.jsx            # MODIFIED: <PullToRefresh> + <SwipeableTabs>
│   │   ├── PlayerPage.jsx          # MODIFIED: <PullToRefresh>
│   │   ├── TeamPage.jsx            # MODIFIED: <PullToRefresh>
│   │   └── ComparePage.jsx         # MODIFIED: <PullToRefresh>
│   └── components/settings/
│       └── AccountTab.jsx          # MODIFIED: input font-size 16px
```

## Feature 1 — Tab swipe (LeaguePage, GamePage)

### Behavior

- On a tab-using page, horizontal pan on the tab *content area* (not the tab bar itself) changes tabs.
- Pan distance > 25% of viewport width OR velocity > 500 px/s → commit to next/prev tab.
- Below threshold → spring back to current tab.
- Active tab content slides out (left or right) while next tab content slides in. Existing pill indicator on the tab bar animates to new active tab via existing logic.
- At edges (first tab, last tab), drag is rubber-banded with elastic resistance — no wraparound.

### Implementation

**`useSwipeableTabs(tabs, currentIndex, onChange)` hook:**
- Returns `{ x, dragHandlers, currentIndex }` where `x` is a Framer Motion `MotionValue`.
- Wraps Framer Motion `drag="x"` with `dragConstraints` that allow only the valid direction at edges.
- On `onDragEnd`, computes commit threshold from `info.offset.x` and `info.velocity.x`.
- Calls `onChange(nextIndex)` and animates `x` to settle.

**`<SwipeableTabs tabs={[...]} activeId currentIndex onChange>` component:**
- Renders a horizontal flex strip of tab panels, translated by the `x` motion value.
- Only the active panel is fully visible; adjacent panels are pre-rendered (or loaded on demand if expensive).
- `touch-action: pan-y` on the strip — vertical scroll inside the panel still works; horizontal goes to drag handler.

**Page integration (LeaguePage, GamePage):**
- Existing tab logic stays. Tab bar (with sliding pill) remains the source of truth for `activeId`.
- Tab content area swapped from current `{activeId === 'foo' && <FooContent />}` to `<SwipeableTabs>`.
- Tab order matches the current tab bar order.

### Edge cases

- **Horizontal-scroll content inside tabs** (e.g., charts, wide tables): the inner element's own `overflow-x: auto` will fight the swipe. Solution: inner scroll containers set `touch-action: pan-x` to claim horizontal gesture; `useSwipeableTabs` checks `event.target` ancestry on dragstart and bails if a horizontal-scroll ancestor is engaged. Documented in the hook implementation.
- **Tab content with its own draggable elements**: none currently exist. If introduced later, same `touch-action` + ancestry-bail pattern applies.

## Feature 2 — Pull-to-refresh

### Behavior

- On data pages, drag down from `scrollY === 0` reveals a spinner indicator.
- Below 60px pull: indicator scales/rotates with progress, no commit.
- At 60px+: indicator locks to "ready" state.
- Release while ready → spinner spins, calls `onRefresh()`, snaps back when promise resolves.
- Release before ready → snaps back, no refetch.
- Native browser PTR (Chrome on Android) is suppressed via `overscroll-behavior-y: contain` on `html` (set in `index.css`). `contain` keeps iOS rubber-band working (which Feature 6's bg fix relies on); `none` would kill rubber-band entirely. Defense-in-depth: the PTR `touchmove` handler also calls `e.preventDefault()` on downward pulls when armed.

### Implementation

**`usePullToRefresh(onRefresh, { threshold = 60 } = {})` hook:**
- Returns `{ containerRef, pullDistance, isRefreshing, isReady }`.
- Attaches passive `touchstart`, non-passive `touchmove`, `touchend` listeners on `containerRef`.
- On `touchstart`: only arms if `window.scrollY === 0`.
- On `touchmove`: if delta > 0 (downward), calls `e.preventDefault()` and updates `pullDistance` with diminishing-returns formula (resistance: `delta * 0.5` for native rubber-band feel).
- On `touchend`: if `pullDistance >= threshold`, calls `onRefresh()` (Promise) and animates indicator into spin state until resolved.

**`<PullToRefresh onRefresh>` component:**
- Wraps page content. Uses the hook.
- Renders an absolutely-positioned indicator (small spinner using existing accent color) above content, translated and rotated based on `pullDistance`.
- The wrapper is rendered below the Navbar (which handles the top safe-area itself in Feature 8), so the indicator doesn't need its own safe-area-inset-top.

**Page integration:**
- Each data page (Homepage, LeaguePage, PlayerPage, TeamPage, GamePage, ComparePage) wraps its top-level container.
- Each page defines its own `handleRefresh` async function passed as `onRefresh`. The function awaits all relevant query refetches via `Promise.all`. Existing data hooks already expose `refetch` (verified for `useHomeGames`, `usePlayer`, `useFavorites`, `useUserPrefs` per memory; others are added if missing — single-line addition).
- Per-page `handleRefresh`:
  - Homepage → `useHomeGames().refetch()`
  - LeaguePage → `Promise.all([useLeagueData().refetch(), useGameDates().refetch(), useSeasons().refetch()])`
  - PlayerPage → `usePlayer().refetch()`
  - TeamPage → team data hook's `refetch()`
  - GamePage → game-detail hook's `refetch()` (and any live-data hook used on that page)
  - ComparePage → head-to-head hook's `refetch()`
- Indicator spinner stops when the returned Promise resolves or rejects (rejection caught and logged; UI snaps back regardless).

### Why custom (not a library)

- Existing project uses Framer Motion heavily; touch handlers compose cleanly with the project's animation patterns.
- Off-the-shelf libraries (`react-pull-to-refresh`, etc.) are mostly unmaintained or pull in their own animation engines.
- Implementation is ~80 lines and gives full control over the indicator visuals to match the design system.

## Feature 3 — Swipe-to-close panels

### Behavior

- **Right-side panels** (FavoritesPanel, ChatPanel, SettingsDrawer): drag rightward on the panel; release past 25% width or velocity > 500 px/s → close. Below threshold → spring back to open position. Drag handler attaches to the panel root, not to internal content (avoids fighting scrolling lists).
- **Bottom panel** (IOSInstallHint): drag downward; release past 50% of panel height or velocity > 400 px/s → dismiss (also sets the `scorva:ios-install-dismissed` localStorage flag, same as tap-X). Below threshold → spring back.

### Implementation

**`useSwipeToClose(onClose, { direction = 'right', threshold = 0.25 } = {})` hook:**
- `direction`: `'right' | 'down'` (the only two we use).
- Returns `{ dragProps }` to spread on a Framer Motion `motion.*` element.
- Configures `drag`, `dragConstraints`, `dragElastic`, and `onDragEnd` based on direction.
- On `onDragEnd`, checks `info.offset` against threshold (proportional to element size) or velocity. If past, calls `onClose()`. Framer Motion's `exit` animation continues from current position.

**Panel integration:**
- Each panel's root `motion.div` adds `dragProps` from the hook.
- For right panels, internal scrollable areas (chat message list, favorites list, settings tab content) use `touch-action: pan-y` so vertical scroll inside isn't hijacked by the right-drag handler. The drag handler is attached to a header strip or panel chrome, not the scroll body. Where this is impractical, the hook's drag-axis filter (`drag="x"` with constrained y) lets vertical scroll pass through to the inner element naturally.

### Edge cases

- **Drag during chat input focus on mobile**: keyboard-aware visualViewport logic in ChatPanel must keep working. Drag handler is on the panel root which sits above the keyboard logic; no conflict.
- **Drag conflict with internal interactive elements** (buttons, links): Framer Motion only kicks in past a small movement threshold (~5px). Tap and drag are distinguished automatically.

## Feature 4 — Disable pinch-zoom + input auto-zoom

### `index.html` viewport meta

Change from:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

To:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

`user-scalable=no` and `maximum-scale=1.0` together suppress both pinch-zoom and iOS input auto-zoom. Both flags included for cross-browser reliability — older iOS respects `user-scalable`, newer respects `maximum-scale`.

### Defense-in-depth font-size

Independent of viewport meta, raise input font-sizes ≥ 16px to prevent any future browser regression:
- `SearchBar.jsx`: `text-sm` (14px) → `text-base` (16px) on the `<input>` element.
- `AccountTab.jsx`: `text-sm` on bare inputs → `text-base`.
- `FloatingInput.jsx` (currently 15px) → 16px to match the rule.
- `ChatInput.jsx` already 16px (`text-base`) — unchanged.

### Tradeoff acknowledgement

Explicitly accepted by user: this fails WCAG 2.1 SC 1.4.4 (Resize Text). Standard practice for native-feel PWAs (Twitter, Instagram, etc.); user has decided knowingly.

## Feature 5 — Disable iOS history-swipe gesture

### Approach

Add to `index.css` under `body` (or `html`):
```css
body {
  touch-action: pan-y;
  overscroll-behavior-x: none;
}
```

`touch-action: pan-y` allows the browser to handle vertical scrolling natively, but routes horizontal pans to JS pointer events without triggering the iOS edge-swipe-back interaction. `overscroll-behavior-x: none` is belt-and-suspenders for Chrome on Android.

### Coexistence with tab swipe

Framer Motion's `drag` uses pointer events (not browser-handled gesture detection). With `touch-action: pan-y` on `<body>`, horizontal pans still fire pointer events that Framer Motion captures. The browser's history-swipe is suppressed because it's a gesture-recognizer-level feature, not a pointer-event-level feature.

The `<SwipeableTabs>` strip sets `touch-action: pan-y` itself (same as body) to keep this behavior consistent and let the inner pointer handlers grab horizontal motion.

### Standalone PWA mode caveat

In standalone display mode on iOS, history-swipe is already absent (no browser chrome). This fix primarily benefits non-installed Safari users; in standalone mode it's a no-op. Either way, it's the correct rule.

## Feature 6 — Overscroll background fix

### Problem

When the user pulls past the top or bottom of a page on iOS, the rubber-band exposes the area behind the document. Currently this is the default white/light-gray, even though the app theme is `#0a0a0c`. Most visible at the top, where the safe-area inset reveals the bg between the top of the page and the notch.

### Fix

In `index.css`:
```css
html, body {
  background-color: #0a0a0c; /* surface-base */
}
```

Both selectors are needed: iOS picks up `html`'s background for the area "behind" the document during overscroll. Setting only `body` leaves the area behind `<body>` (during overscroll) at the browser default.

`<meta name="theme-color" content="#0a0a0c">` already in `index.html` covers the iOS standalone status-bar area (separate fix already shipped in PWA foundation).

## Feature 7 — 44px touch targets, sweep all interactives

### Rule

Every interactive element (buttons, links, dropdown triggers, icon-only controls) must have a hit area of at least 44×44 CSS pixels. Visual size may stay smaller — extra hit area is achieved via padding or pseudo-element expansion.

### Implementation tactic

Where the element already has appropriate text + padding (e.g., nav links with `px-4 py-2`), measure and bump padding if under 44px tall.

For icon-only buttons currently under 44px (canonical examples from the audit):
- Navbar favorite star: `w-7 h-7` (28px) → wrap in a `min-w-[44px] min-h-[44px] flex items-center justify-center` button; icon stays 28px visually.
- ChatPanel close: `w-8 h-8` (32px) → same wrap.
- ChatPanel reset: `w-8 h-8` → same.
- FavoritesPanel close: `w-8 h-8` → same.
- SettingsDrawer close: `w-8 h-8` → same.
- IOSInstallHint close: apply same wrap pattern.
- AvatarDropdown trigger button (Navbar avatar circle): wrap so the clickable area is ≥44×44 even if the avatar image stays its current size.
- GameCard expand button (mobile, GameCard.jsx around line 280): apply wrap.
- All card-internal favorite toggles (heart/star buttons inside player/team/game cards), dropdown selectors (SeasonSelector, GameChart dropdowns), pagination/tab indicator clicks: each must hit ≥44×44 — implementer greps `<button` and `<select` in component files, measures effective hit area, applies wrap pattern where short.

### Audit method

Implementer must grep for: `w-[1-9]` (small width tokens), icon-only `<button>`, `<select>` without explicit height. Each match audited; under 44px gets the wrap pattern. New utility class optional (`.touch-target` defined in `index.css` could DRY this up, but plain Tailwind is also fine and matches existing patterns).

## Feature 8 — Safe-area audit (full sweep)

### Rule

Every element that touches a screen edge in standalone PWA mode must respect the device safe area:
- Top edge (notch / status bar) → `env(safe-area-inset-top)`
- Bottom edge (home indicator) → `env(safe-area-inset-bottom)`
- Left/right (rare; landscape with notch) → `env(safe-area-inset-left/right)`

### Already done

- IOSInstallHint: bottom inset ✓
- ChatPanel: top + bottom insets ✓

### Sweep targets

- **Navbar** (`Navbar.jsx`): currently `sticky top-0`. Add `pt-[max(0px,env(safe-area-inset-top))]` to the inner container so logo/links don't sit under the notch in standalone mode. The navbar background already extends behind the safe area; only the content needs the inset.
- **ChatFAB** (`ChatFAB.jsx`): bottom-anchored. Add `bottom-[max(1.5rem,calc(1.5rem+env(safe-area-inset-bottom)))]`.
- **FavoritesPanel** (`FavoritesPanel.jsx`): right-side full-height panel. Header needs top inset; body/footer needs bottom inset on the scroll padding (so last items don't hide under home indicator).
- **SettingsDrawer** (`SettingsDrawer.jsx`): same pattern as FavoritesPanel.
- **ComparePage**: grep for any `sticky` or `fixed` positioned bar (e.g., a compare-action bar on mobile). If present and bottom-anchored, add bottom inset.
- **PullToRefresh indicator**: already specified above (`top: env(safe-area-inset-top)`).
- **Full-screen-on-mobile modals** (AuthModal, CompareModal, PlayerStatusModal, NewsHeadlineModal): for each, locate the top header (containing close X) and add `pt-[max(0px,env(safe-area-inset-top))]`. For each, locate any bottom-anchored action bar (submit buttons, primary CTA) and add `pb-[max(0px,env(safe-area-inset-bottom))]`. If a modal scrolls its body, the scroll container's bottom padding gets the same inset so last items don't hide under the home indicator.

### Style pattern

Standardize on the `max(<fallback>, env(safe-area-inset-X))` form so non-PWA browsers keep their existing padding and PWA users get the inset added.

## Verification

Manual test plan (pre-merge), executed on a real iOS device installed as PWA:

1. **Tab swipe — LeaguePage**: navigate to `/nba`. Swipe left on Games tab content → moves to Standings. Swipe right → back to Games. At first/last tab, drag rubber-bands. Tap a tab on the bar — pill indicator animates correctly. Vertical scroll inside the tab still works during swipe arming.
2. **Tab swipe — GamePage**: navigate to a game. Same swipe behavior across Box Score / Play-by-Play / Win Probability tabs.
3. **Pull-to-refresh**: on each data page (Homepage, LeaguePage, PlayerPage, TeamPage, GamePage, ComparePage), pull down at top. Indicator animates with pull. Release past threshold → spinner spins, data refetches, indicator dismisses. Release before threshold → snaps back, no refetch. Native Chrome PTR does NOT also fire.
4. **Swipe-to-close panels**: open FavoritesPanel via star button → drag right → closes. Same for ChatPanel (via FAB) and SettingsDrawer (via avatar dropdown). Drag past threshold but release with rebound velocity → still commits to close (velocity check works). Drag short distance → springs back open.
5. **Swipe-to-close install hint**: trigger IOSInstallHint (clear localStorage, visit). Drag down → dismisses with localStorage flag set. Reload → no re-prompt.
6. **No pinch-zoom**: try pinching anywhere — page does not zoom. Try double-tap — no zoom.
7. **No input auto-zoom**: tap SearchBar in navbar — page doesn't zoom in. Tap each AccountTab field — no zoom. Tap chat input — no zoom (this was already correct).
8. **No iOS history-swipe**: in non-standalone Safari, swipe from left edge of screen — does NOT navigate back. (In standalone mode, this gesture isn't available anyway.)
9. **Overscroll background**: pull past top of any page — area exposed by rubber-band is `#0a0a0c` (dark), not light gray. Pull past bottom of long page — same.
10. **Touch targets**: tap each previously-undersized control (favorites star, panel close buttons, panel reset, install-hint close, GameCard expand). Each registers a tap easily without precise aiming. Spot-check 5 random text links and dropdowns — same.
11. **Safe areas**: in standalone PWA mode on a notched iPhone, navbar logo not clipped by notch; ChatFAB sits above home indicator; panel content doesn't hide under home indicator.
12. **Regression sanity**: vertical scroll still works on every page. Forms still submit. Existing animations (Framer Motion staggers, hover effects on desktop) still play.

## Out of scope (explicit)

- Bottom navigation bar (decided against by user)
- Swipe between leagues (`/nba` → `/nfl`)
- Swipe to change game date on LeaguePage
- Haptic feedback (no clean web API; iOS Safari does not support)
- Android-specific gesture polish
- Replacing Framer Motion with a dedicated gesture library
- Tablet-specific layouts
- Landscape-orientation polish
- Accessibility opt-out for users who want pinch-zoom (deliberate choice; out of scope)
- New tabs or page restructuring
- Touch target color/visual updates (only hit-area sizing; visual stays the same)
