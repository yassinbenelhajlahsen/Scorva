# Skeleton & Loading State Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh every skeleton and loading state so they match the post-refresh visual language (rail + atmospheric gradient, no card chrome) and mirror responsive grids on mobile, especially two-column layouts.

**Architecture:** Introduce two shared primitives in `frontend/src/components/skeletons/_chrome.jsx` (`<SkeletonCard>` and `<SkeletonRow>`) that bake in the new chrome. Refresh 12 existing skeletons to use them where common; keep inline markup for exotic chrome (PlayerAvgCard top stripe + radial gradient, PredictionCard radial glow). Add 3 new skeleton files for components that ship their own loading state but predate the refresh.

**Tech Stack:** React 19, Tailwind CSS v4 (CSS-based @theme config), Framer Motion 12, Vitest + @testing-library/react + jsdom.

**Pre-refresh chrome (what we are replacing everywhere):**
```
bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)]
```
**Post-refresh chrome (what we are introducing):**
```
relative overflow-hidden rounded-2xl
  + absolute left-0 top-0 bottom-0 w-[2px] bg-white/15        ← rail
  + absolute inset-0 bg-gradient-to-r from-white/[0.04] to-transparent  ← atmospheric gradient
```

---

## Task 1: Add primitive helpers

**Files:**
- Create: `frontend/src/components/skeletons/_chrome.jsx`
- Test: `frontend/src/__tests__/components/skeletonChrome.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/components/skeletonChrome.test.jsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SkeletonCard, SkeletonRow } from "../../components/skeletons/_chrome.jsx";

describe("SkeletonCard", () => {
  it("renders a left rail and an atmospheric gradient over children", () => {
    const { container, getByTestId } = render(
      <SkeletonCard>
        <div data-testid="inner">x</div>
      </SkeletonCard>,
    );
    expect(getByTestId("inner")).toBeInTheDocument();
    // Rail: 2px absolute element on the left, default neutral color
    expect(container.querySelector(".w-\\[2px\\].bg-white\\/15")).toBeInTheDocument();
    // Gradient: absolute inset-0 with from-white/[0.04]
    expect(container.querySelector(".bg-gradient-to-r.from-white\\/\\[0\\.04\\]")).toBeInTheDocument();
  });

  it("accepts a custom railClass for colored rails (win/loss/playoff)", () => {
    const { container } = render(
      <SkeletonCard railClass="bg-win/60">
        <div />
      </SkeletonCard>,
    );
    expect(container.querySelector(".bg-win\\/60")).toBeInTheDocument();
    expect(container.querySelector(".bg-white\\/15")).not.toBeInTheDocument();
  });
});

describe("SkeletonRow", () => {
  it("renders a transparent left-rail slot and hairline-row padding", () => {
    const { container, getByTestId } = render(
      <SkeletonRow>
        <div data-testid="inner">x</div>
      </SkeletonRow>,
    );
    expect(getByTestId("inner")).toBeInTheDocument();
    expect(container.querySelector(".pl-4.pr-3.py-3")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/components/skeletonChrome.test.jsx`
Expected: FAIL — module not found / SkeletonCard is not defined.

- [ ] **Step 3: Write the primitives**

```jsx
// frontend/src/components/skeletons/_chrome.jsx
export function SkeletonCard({ children, className = "", railClass = "bg-white/15" }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${railClass}`} />
      <div className="absolute inset-0 bg-gradient-to-r from-white/[0.04] to-transparent pointer-events-none" />
      <div className="relative">{children}</div>
    </div>
  );
}

export function SkeletonRow({ children, className = "" }) {
  return (
    <div className={`relative flex items-center gap-3 pl-4 pr-3 py-3 ${className}`}>
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-transparent" />
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/components/skeletonChrome.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/skeletons/_chrome.jsx frontend/src/__tests__/components/skeletonChrome.test.jsx
git commit -m "$(cat <<'EOF'
feat(skeletons): add SkeletonCard + SkeletonRow chrome primitives

New shared helpers that bake in the post-refresh chrome (left rail +
atmospheric gradient). To be consumed by the 12 skeleton refresh tasks
that follow.
EOF
)"
```

---

## Task 2: Refresh GameCardSkeleton

**Files:**
- Modify: `frontend/src/components/skeletons/GameCardSkeleton.jsx`

GameCardSkeleton currently wears the old `bg-surface-elevated border ... shadow` chrome. The live GameCard now uses rail + gradient. Match it.

- [ ] **Step 1: Rewrite the file**

```jsx
// frontend/src/components/skeletons/GameCardSkeleton.jsx
import Skeleton from "../ui/Skeleton.jsx";
import { SkeletonCard } from "./_chrome.jsx";

export default function GameCardSkeleton() {
  return (
    <SkeletonCard className="max-w-md mx-auto">
      <div className="p-5 text-center">
        <div className="flex items-center justify-between gap-4 h-[120px]">
          {/* Home */}
          <div className="flex flex-col items-center flex-1 gap-1.5">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-5 w-8" />
          </div>

          {/* Center */}
          <div className="flex flex-col items-center flex-shrink-0 w-[90px] gap-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-2.5 w-10" />
          </div>

          {/* Away */}
          <div className="flex flex-col items-center flex-1 gap-1.5">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-5 w-8" />
          </div>
        </div>
      </div>
    </SkeletonCard>
  );
}
```

- [ ] **Step 2: Verify nothing broke**

Run: `cd frontend && npm test -- GameCard`
Expected: PASS (no GameCardSkeleton-specific tests exist; check that consumers don't fail).

- [ ] **Step 3: Manual mobile check**

Run: `cd frontend && npm run dev`
Visit `/nba` at viewport `375px` width. Throttle to "Slow 3G" in DevTools to see the skeleton. Confirm:
- No border / shadow visible
- Left rail visible (2px, subtle white)
- Card geometry matches a real GameCard after load (no layout shift)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/skeletons/GameCardSkeleton.jsx
git commit -m "refresh(GameCardSkeleton): rail + atmospheric gradient, drop card chrome"
```

---

## Task 3: Refresh StatCardSkeleton

**Files:**
- Modify: `frontend/src/components/skeletons/StatCardSkeleton.jsx`

The live StatCard now has a rail (W/L/playoff colored) + accent gradient + optional rating column on the right. The skeleton can't know the W/L outcome, so we default to neutral rail.

- [ ] **Step 1: Rewrite the file**

```jsx
// frontend/src/components/skeletons/StatCardSkeleton.jsx
import Skeleton from "../ui/Skeleton.jsx";
import { SkeletonCard } from "./_chrome.jsx";

export default function StatCardSkeleton() {
  return (
    <SkeletonCard className="max-w-sm mx-auto">
      <div className="flex items-stretch">
        <div className="flex-1 min-w-0 p-5 text-center">
          {/* Meta row (opponent / date / result pill) */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Skeleton className="h-3 w-6 rounded-full" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
          {/* Stat row */}
          <div className="flex flex-wrap justify-center gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center min-w-[52px] gap-1.5">
                <Skeleton className="h-2.5 w-8" />
                <Skeleton className="h-7 w-12 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
        {/* Rating column placeholder — real StatCard renders it when ratingGrade != null */}
        <div className="shrink-0 px-3.5 py-3 flex flex-col items-center justify-center gap-1.5">
          <Skeleton className="h-8 w-10 rounded" />
          <Skeleton className="h-2 w-10" />
        </div>
      </div>
    </SkeletonCard>
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd frontend && npm test -- StatCard`
Expected: PASS.

- [ ] **Step 3: Manual check at `375px`** — visit any player page (`/nba/players/<slug>`) on slow 3G to see the StatCard skeleton; geometry should match the real card after load.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/skeletons/StatCardSkeleton.jsx
git commit -m "refresh(StatCardSkeleton): rail + gradient, add rating column placeholder"
```

---

## Task 4: Refresh NewsCardSkeleton

**Files:**
- Modify: `frontend/src/components/skeletons/NewsCardSkeleton.jsx`

Live NewsCard is borderless with hover-rail. Skeleton drops chrome entirely; rail stays transparent (matches the hover-only rail on the live card at rest).

- [ ] **Step 1: Rewrite the file**

```jsx
// frontend/src/components/skeletons/NewsCardSkeleton.jsx
import Skeleton from "../ui/Skeleton.jsx";
import { SkeletonCard } from "./_chrome.jsx";

export default function NewsCardSkeleton() {
  return (
    <SkeletonCard railClass="bg-transparent">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="p-4 flex flex-col gap-2.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center gap-2">
          <Skeleton className="w-3.5 h-3.5 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </SkeletonCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/skeletons/NewsCardSkeleton.jsx
git commit -m "refresh(NewsCardSkeleton): drop card chrome, transparent rail to match hover-rail card"
```

---

## Task 5: Refresh RosterGridSkeleton

**Files:**
- Modify: `frontend/src/components/skeletons/RosterGridSkeleton.jsx`

Real RosterGrid dropped chrome, added hover rail + ring on avatar.

- [ ] **Step 1: Rewrite the file**

```jsx
// frontend/src/components/skeletons/RosterGridSkeleton.jsx
import Skeleton from "../ui/Skeleton.jsx";
import { SkeletonCard } from "./_chrome.jsx";

export default function RosterGridSkeleton({ count = 9, statCount = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} railClass="bg-transparent">
          <div className="p-5">
            <div className="flex items-center gap-4">
              {/* Ring around avatar via the inner shadow trick */}
              <div className="relative">
                <Skeleton className="w-20 h-20 rounded-full shrink-0" />
                <div className="absolute inset-0 rounded-full ring-1 ring-white/[0.08] pointer-events-none" />
              </div>
              <div className="flex-1 flex flex-col gap-2.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-12 rounded-md mt-1" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.05] flex justify-around gap-2">
              {Array.from({ length: statCount }).map((_, j) => (
                <div key={j} className="flex flex-col items-center gap-1.5">
                  <Skeleton className="h-2.5 w-7" />
                  <Skeleton className="h-4 w-9" />
                </div>
              ))}
            </div>
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Manual check on `/nba/teams/<slug>?tab=roster` at `375px`** — grid should be 1 col on mobile, 2 on sm, 3 on lg. No bordered card; hover-rail transparent.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/skeletons/RosterGridSkeleton.jsx
git commit -m "refresh(RosterGridSkeleton): drop card chrome, ring-avatar, transparent hover rail"
```

---

## Task 6: Refresh TopPerformersSkeleton + inline TopPerformerSkeleton in GamePageSkeleton

**Files:**
- Modify: `frontend/src/components/skeletons/TopPerformersSkeleton.jsx`
- Modify: `frontend/src/components/skeletons/GamePageSkeleton.jsx` (only the `TopPerformerSkeleton` inner function — full GamePageSkeleton refresh is Task 10)

Real TopPerformerCard has a colored gradient slab on the left (88px wide), no outer border, and an optional rating column on the right. Both files render an identically-shaped placeholder; consolidate.

- [ ] **Step 1: Rewrite TopPerformersSkeleton.jsx**

```jsx
// frontend/src/components/skeletons/TopPerformersSkeleton.jsx
import Skeleton from "../ui/Skeleton.jsx";
import { SkeletonCard } from "./_chrome.jsx";

function TopPerformerCardSkeleton() {
  return (
    <SkeletonCard railClass="bg-accent/40">
      <div className="flex items-stretch h-[108px]">
        {/* Left slab */}
        <div className="w-[88px] shrink-0 bg-gradient-to-br from-accent/[0.12] to-accent/[0.04] border-r border-accent/[0.15] flex flex-col items-center justify-center gap-1.5">
          <Skeleton className="w-12 h-12 rounded-full" />
          <Skeleton className="h-2 w-14" />
        </div>
        {/* Right zone */}
        <div className="flex-1 flex flex-col justify-between px-3.5 py-3 min-w-0">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-16" />
          </div>
          <div className="flex gap-3.5">
            <Skeleton className="h-4 w-7" />
            <Skeleton className="h-4 w-7" />
            <Skeleton className="h-4 w-7" />
          </div>
        </div>
      </div>
    </SkeletonCard>
  );
}

export default function TopPerformersSkeleton() {
  return (
    <div data-testid="top-performers-skeleton">
      <Skeleton className="h-[88px] w-full rounded-2xl mb-3" />
      <div className="flex flex-col gap-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export { TopPerformerCardSkeleton };
```

- [ ] **Step 2: Update GamePageSkeleton to import the shared sub-component**

In `frontend/src/components/skeletons/GamePageSkeleton.jsx`, delete the local `TopPerformerSkeleton` function (lines 4-26) and import + use the shared one:

```jsx
// Add to imports near the top of GamePageSkeleton.jsx
import { TopPerformerCardSkeleton } from "./TopPerformersSkeleton.jsx";
```

Then replace `<TopPerformerSkeleton key={i} />` (in the Top performer cards grid) with `<TopPerformerCardSkeleton key={i} />`. (Full GamePageSkeleton refresh happens in Task 10 — this step is just the import swap.)

- [ ] **Step 3: Verify**

Run: `cd frontend && npm test -- TopPerformers GamePage`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/skeletons/TopPerformersSkeleton.jsx frontend/src/components/skeletons/GamePageSkeleton.jsx
git commit -m "refresh(TopPerformersSkeleton): colored slab + rail, share TopPerformerCardSkeleton"
```

---

## Task 7: Refresh ReportRowSkeleton

**Files:**
- Modify: `frontend/src/components/skeletons/ReportRowSkeleton.jsx`

Real RowChrome uses transparent bg + hover-rail. The skeleton was painting `bg-surface-primary` — drop it.

- [ ] **Step 1: Rewrite**

```jsx
// frontend/src/components/skeletons/ReportRowSkeleton.jsx
import Skeleton from "../ui/Skeleton.jsx";
import { SkeletonRow } from "./_chrome.jsx";

export default function ReportRowSkeleton() {
  return (
    <SkeletonRow>
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-3 w-10" />
    </SkeletonRow>
  );
}
```

- [ ] **Step 2: Run the ReportsList test**

Run: `cd frontend && npx vitest run src/__tests__/components/ReportsList.test.jsx`
Expected: PASS (the test asserts `data-testid="report-skeleton"` on the wrapper in ReportsList; the wrapper still applies).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/skeletons/ReportRowSkeleton.jsx
git commit -m "refresh(ReportRowSkeleton): transparent bg, hairline-row geometry via SkeletonRow"
```

---

## Task 8: Refresh PlayoffsSkeleton (SeriesSkeleton inner)

**Files:**
- Modify: `frontend/src/components/skeletons/PlayoffsSkeleton.jsx`

`SeriesSkeleton` (lines 40-53) uses old `bg-surface-elevated border ... shadow` chrome. Drop the surface bg and shadow; keep the border to match the live series card which is bordered + hairline-divided.

- [ ] **Step 1: Edit the SeriesSkeleton function**

Replace:
```jsx
<div className="bg-surface-elevated border border-white/[0.08] rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
```
with:
```jsx
<div className="border border-white/[0.08] rounded-xl overflow-hidden">
```

Use the Edit tool. The replacement must match the exact existing line in `PlayoffsSkeleton.jsx`.

- [ ] **Step 2: Run the playoffs test**

Run: `cd frontend && npx vitest run src/__tests__/components/PlayoffsBracket.test.jsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/skeletons/PlayoffsSkeleton.jsx
git commit -m "refresh(PlayoffsSkeleton): drop bg-surface-elevated and shadow on series cards"
```

---

## Task 9: Refresh LeaguePageSkeleton — GamePillSkeleton in ScoresBar

**Files:**
- Modify: `frontend/src/components/skeletons/LeaguePageSkeleton.jsx`

`GamePillSkeleton` (lines 5-24) uses `bg-white/[0.03] border border-white/[0.06] rounded-xl` — the live pill in ScoresBar uses ring-style chrome. Match.

- [ ] **Step 1: Edit GamePillSkeleton**

Use the Edit tool to replace:
```jsx
<div className="flex-none inline-flex items-center justify-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
```
with:
```jsx
<div className="flex-none inline-flex items-center justify-center gap-3 ring-1 ring-white/[0.06] bg-white/[0.02] rounded-xl px-3 py-2">
```

- [ ] **Step 2: Run ScoresBar test**

Run: `cd frontend && npx vitest run src/__tests__/components/ScoresBar.test.jsx`
Expected: PASS — the test asserts `data-testid="scores-bar-skeleton"` on the wrapper, which is unchanged.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/skeletons/LeaguePageSkeleton.jsx
git commit -m "refresh(LeaguePageSkeleton): ring-chrome on ScoresBar game pill skeleton"
```

---

## Task 10: Refresh GamePageSkeleton — info card + quarter scoreboard + chart placeholder

**Files:**
- Modify: `frontend/src/components/skeletons/GamePageSkeleton.jsx`

Three inner cards in this file still wear old chrome: the game-info card (line 66), the quarter-scoreboard card (line 95), and the chart placeholder (line 125).

- [ ] **Step 1: Add the SkeletonCard import**

Use the Edit tool at the top of `GamePageSkeleton.jsx` to add:
```jsx
import { SkeletonCard } from "./_chrome.jsx";
```

- [ ] **Step 2: Replace the game-info card wrapper**

Use the Edit tool. Replace:
```jsx
<div className="mb-6">
  <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col gap-3">
```
with:
```jsx
<div className="mb-6">
  <SkeletonCard>
    <div className="p-5 flex flex-col gap-3">
```
and find the matching closing `</div>` for the inner card and add a closing `</SkeletonCard>` tag. (The replacement is one block — confirm bracket balance after edit.)

- [ ] **Step 3: Replace the quarter-scoreboard card wrapper**

Replace:
```jsx
<div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)] mb-6">
```
with:
```jsx
<SkeletonCard className="mb-6">
  <div className="p-5">
```
and close with `</SkeletonCard>` matching the existing closing `</div>`.

- [ ] **Step 4: Replace the chart placeholder**

Replace:
```jsx
<div className="bg-surface-elevated border border-white/[0.08] rounded-2xl h-48 animate-pulse" />
```
with:
```jsx
<SkeletonCard>
  <div className="h-48 animate-pulse" />
</SkeletonCard>
```

- [ ] **Step 5: Run the test**

Run: `cd frontend && npm test -- GamePage`
Expected: PASS — no GamePageSkeleton-specific tests, so consumers should be fine.

- [ ] **Step 6: Manual check** — visit `/nba/games/<id>` at `375px` and confirm three inner cards have rail + gradient, no border or shadow.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/skeletons/GamePageSkeleton.jsx
git commit -m "refresh(GamePageSkeleton): rail + gradient on info card, quarter board, chart"
```

---

## Task 11: Refresh PlayerPageSkeleton — hero with two-col rankings layout on mobile

**Files:**
- Modify: `frontend/src/components/skeletons/PlayerPageSkeleton.jsx`

This is the biggest task. The live PlayerHero on mobile has TWO inner columns when rankings exist (details on left + 140-170px PlayerRankings panel on right). The current skeleton always renders single-col details. Match the with-rankings layout since rankings are the more visually substantial case; the simpler no-rankings page will gracefully shrink.

Also add:
- StreakBadge slot
- NextGameCard slot (h-[88px] bordered slab)
- Distinct team-link slot above the jersey/position row

- [ ] **Step 1: Rewrite the hero block**

Use the Edit tool. Find the existing hero block (lines 22-48) starting at:
```jsx
{/* Hero: headshot + name + team + meta + status badges */}
<div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 mb-8">
```

Replace the entire hero block (through line 48 `</div></div>`) with:

```jsx
{/* Hero: headshot + name + (details | rankings) */}
<div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 mb-8">
  <Skeleton className="w-40 h-40 md:w-48 md:h-48 rounded-3xl shrink-0" />

  <div className="flex flex-col w-full md:flex-1 min-w-0 gap-3">
    {/* Name row */}
    <div className="flex justify-center md:justify-start">
      <div className="flex items-center gap-3">
        <div className="relative">
          <span className="text-3xl sm:text-4xl font-bold tracking-tight text-transparent select-none">
            {displayName || "Player Name"}
          </span>
          <Skeleton className="absolute inset-0 rounded-xl" />
        </div>
        <svg className="w-7 h-7 fill-none text-text-tertiary/30 shrink-0" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
        </svg>
      </div>
    </div>

    {/* Two-col row: details (left) + rankings (right) — stays side-by-side on mobile */}
    <div className="flex flex-row items-start gap-4 md:gap-6">
      {/* Details column */}
      <div className="flex flex-col gap-3 items-center md:items-start min-w-0 flex-1">
        {/* Team link */}
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-7 h-7 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        {/* Jersey · Position · Height/Weight */}
        <Skeleton className="h-4 w-44 rounded" />
        {/* DOB · Draft */}
        <Skeleton className="h-3.5 w-56 rounded" />
        {/* Status + Streak badges row */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        {/* NextGameCard slot (h-[88px]) — only on profile tab; render as a SkeletonCard */}
        <SkeletonCard className="w-full max-w-[260px] mt-1">
          <div className="h-[88px] flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-3 w-12" />
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </SkeletonCard>
      </div>

      {/* Rankings column — matches PlayerRankings live width (w-[140px] sm:w-[170px]) */}
      <div className="shrink-0 w-[140px] sm:w-[170px]">
        <SkeletonCard railClass="bg-transparent">
          <div className="p-3 space-y-2.5">
            <Skeleton className="h-2.5 w-16 mx-auto" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
    </div>
  </div>
</div>
```

Make sure `SkeletonCard` is imported at the top of the file:
```jsx
import { SkeletonCard } from "./_chrome.jsx";
```

- [ ] **Step 2: Manual check at `375px` and `768px`**

Visit `/nba/players/<slug>` on slow 3G. At `375px`, confirm:
- Photo on top
- Name centered below
- **Details column on left + 140px rankings column on right** (the two-col mobile layout you flagged)
- Status pills + NextGameCard slot underneath details
At `768px+`, confirm photo moves left, details + rankings sit beside it.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/skeletons/PlayerPageSkeleton.jsx
git commit -m "refresh(PlayerPageSkeleton): hero — two-col details+rankings on mobile, streak + next-game slots"
```

---

## Task 12: Refresh PlayerPageSkeleton — averages + similar players sidebar

**Files:**
- Modify: `frontend/src/components/skeletons/PlayerPageSkeleton.jsx`

The averages card (lines 69-93) still wears old chrome. Real PlayerAvgCard has a top accent stripe + radial gradient. Also: add a SimilarPlayersCard slot at `lg+` (single column on mobile, two-up on `lg`).

- [ ] **Step 1: Rewrite the averages + sidebar block**

Use the Edit tool. Find the block starting at:
```jsx
{/* Averages + similar players sidebar */}
<div className="flex flex-col lg:flex-row gap-8 mb-12">
```

Replace through its matching closing `</div></div>` with:

```jsx
{/* Averages + similar players sidebar */}
<div className="flex flex-col lg:flex-row gap-8 mb-12">
  <div className="flex-1 min-w-0">
    {/* PlayerAvgCard — top accent stripe + gradient (no rail chrome) */}
    <div className="relative overflow-hidden rounded-2xl w-full">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/60" />
      <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.06] via-transparent to-transparent pointer-events-none" />
      <div className="relative">
        <div className="text-accent text-[11px] uppercase tracking-[0.22em] font-semibold text-center pt-4 pb-3 border-b border-white/[0.05]">
          <span className="text-transparent select-none">Regular Season</span>
        </div>
        <div className="px-6 py-7">
          <ul className="flex flex-wrap gap-y-6 justify-around w-full">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex flex-col items-center flex-1 min-w-[72px] gap-1.5">
                <Skeleton className="h-2.5 w-10" />
                <Skeleton className="h-10 w-14 rounded-lg" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </div>

  {/* SimilarPlayersCard sidebar — matches live w-[400px] on lg */}
  <div className="w-full lg:w-[400px] lg:shrink-0">
    <Skeleton className="h-3 w-28 mb-3 ml-3" />
    <div className="flex flex-col">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonRow key={i} className={i < 3 ? "border-b border-white/[0.04]" : ""}>
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </SkeletonRow>
      ))}
    </div>
  </div>
</div>
```

Add `SkeletonRow` to the existing `_chrome.jsx` import at the top of the file.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/skeletons/PlayerPageSkeleton.jsx
git commit -m "refresh(PlayerPageSkeleton): top-stripe PlayerAvg, add SimilarPlayers sidebar slot"
```

---

## Task 13: Refresh TeamPageSkeleton — add streak, next-game, rankings slots

**Files:**
- Modify: `frontend/src/components/skeletons/TeamPageSkeleton.jsx`

Live TeamPage hero has: name + favorite icon, **StreakBadge** (if exists), **NextGameCard** (if nextGame), logo. The skeleton currently has only name + logo. Also missing TeamRankings placeholder for NBA.

- [ ] **Step 1: Edit the team-header block**

Find:
```jsx
{/* Team header */}
<div className="flex flex-col md:flex-row gap-10 mb-12">
  {/* Logo + name */}
  <div className="flex flex-col items-center md:items-start gap-4">
    <div className="flex items-center gap-3">
      ...
    </div>
    <Skeleton className="w-44 h-44 rounded-2xl" />
  </div>
```

Replace the inner-column block (between the name-row and the logo) so it reads:

```jsx
  {/* Logo + name */}
  <div className="flex flex-col items-center md:items-start gap-4">
    <div className="flex items-center gap-3">
      <div className="relative">
        <span className="text-3xl sm:text-4xl font-bold tracking-tight text-transparent select-none">
          {displayName}
        </span>
        <Skeleton className="absolute inset-0 rounded-xl" />
      </div>
      <svg className="w-7 h-7 fill-none text-text-tertiary/30 shrink-0" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
      </svg>
    </div>
    {/* Streak slot */}
    <Skeleton className="h-6 w-24 rounded-full" />
    {/* Next game slot */}
    <SkeletonCard className="w-full max-w-[280px]">
      <div className="h-[88px] flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-3 w-12" />
        <div className="flex items-center gap-2">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </SkeletonCard>
    <Skeleton className="w-44 h-44 rounded-2xl" />
  </div>
```

Add the import at the top of the file:
```jsx
import { SkeletonCard } from "./_chrome.jsx";
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/skeletons/TeamPageSkeleton.jsx
git commit -m "refresh(TeamPageSkeleton): add streak + next-game placeholders to hero"
```

---

## Task 14: Refresh ComparePageSkeleton

**Files:**
- Modify: `frontend/src/components/skeletons/ComparePageSkeleton.jsx`

Two bordered+shadow cards (hero + recent-games-per-side) need rail + gradient.

- [ ] **Step 1: Edit the hero card wrapper**

Find:
```jsx
<div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
```
Replace with:
```jsx
<SkeletonCard>
  <div className="p-6 sm:p-8">
```
and close the inner `<div>` and `</SkeletonCard>` to match.

- [ ] **Step 2: Edit Head-to-Head card wrapper**

Find:
```jsx
<div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
```
Replace with:
```jsx
<SkeletonCard>
  <div className="p-6">
```
+ matching close.

- [ ] **Step 3: Edit Recent Games per-side card wrapper**

Find (inside the `.map`):
```jsx
<div key={col} className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
```
Replace with:
```jsx
<SkeletonCard key={col}>
  <div className="p-4">
```
+ matching close.

Add to the top of the file:
```jsx
import { SkeletonCard } from "./_chrome.jsx";
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/skeletons/ComparePageSkeleton.jsx
git commit -m "refresh(ComparePageSkeleton): rail + gradient on hero, head-to-head, recent games"
```

---

## Task 15: Add PredictionCardSkeleton + wire into PredictionCard

**Files:**
- Create: `frontend/src/components/skeletons/PredictionCardSkeleton.jsx`
- Modify: `frontend/src/components/cards/PredictionCard.jsx` (replace the internal `LoadingSkeleton` function with import)
- Modify: `frontend/src/components/skeletons/GamePageSkeleton.jsx` (render it for the `scheduled` branch where the live page shows PredictionCard pre-game)

The chrome around the inner placeholders is already refresh-styled in PredictionCard.jsx (top stripe + radial glow). The inner shapes themselves stay; just extract them and reuse in GamePageSkeleton.

- [ ] **Step 1: Create the file**

```jsx
// frontend/src/components/skeletons/PredictionCardSkeleton.jsx
// Inner content placeholders for PredictionCard. The outer chrome
// (top stripe + radial glow + ring) is provided by the consumer —
// for the live PredictionCard, that's the wrapper at lines ~289-345.
// For GamePageSkeleton scheduled-game branch, we wrap this in a
// matching outer to mirror the same chrome.
export function PredictionCardInner() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/[0.06]" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-14 bg-white/[0.06] rounded-full" />
            <div className="h-2.5 w-10 bg-white/[0.04] rounded-full" />
          </div>
        </div>
        <div className="h-8 w-8 bg-white/[0.04] rounded-full" />
        <div className="flex items-center gap-3">
          <div className="space-y-1.5 items-end flex flex-col">
            <div className="h-3.5 w-14 bg-white/[0.06] rounded-full" />
            <div className="h-2.5 w-10 bg-white/[0.04] rounded-full" />
          </div>
          <div className="w-10 h-10 rounded-full bg-white/[0.06]" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <div className="h-6 w-10 bg-white/[0.08] rounded" />
          <div className="h-6 w-10 bg-white/[0.08] rounded" />
        </div>
        <div className="h-3 bg-white/[0.06] rounded-full" />
      </div>
      <div className="space-y-2 pt-2">
        <div className="h-3 bg-white/[0.05] rounded-full" />
        <div className="h-3 bg-white/[0.05] rounded-full" />
      </div>
    </div>
  );
}

// Standalone version with full chrome — for GamePageSkeleton scheduled-game branch
export default function PredictionCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/[0.06]">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/40" />
      <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent pointer-events-none" />
      <div className="relative p-5 sm:p-6">
        <PredictionCardInner />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update PredictionCard.jsx to consume PredictionCardInner**

In `frontend/src/components/cards/PredictionCard.jsx`:

1. Add at the top:
```jsx
import { PredictionCardInner } from "../skeletons/PredictionCardSkeleton.jsx";
```

2. Delete the local `function LoadingSkeleton()` (lines 243-280).

3. Find the usage `<LoadingSkeleton />` (around line 347) and replace with `<PredictionCardInner />`.

- [ ] **Step 3: Wire into GamePageSkeleton scheduled branch**

In `frontend/src/components/skeletons/GamePageSkeleton.jsx`, the `scheduled` branch currently renders nothing below the tab bar. Add a PredictionCardSkeleton:

```jsx
import PredictionCardSkeleton from "./PredictionCardSkeleton.jsx";
```

Inside the component, after the tab bar block, before the `{!scheduled && (...)}` block, add:
```jsx
{scheduled && (
  <div className="mb-10">
    <PredictionCardSkeleton />
  </div>
)}
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npm test -- PredictionCard GamePage`
Expected: PASS.

- [ ] **Step 5: Manual check**

Visit a pre-game (scheduled) game page. The skeleton during initial load should show the prediction card placeholder.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/skeletons/PredictionCardSkeleton.jsx frontend/src/components/cards/PredictionCard.jsx frontend/src/components/skeletons/GamePageSkeleton.jsx
git commit -m "feat(skeletons): add PredictionCardSkeleton, wire into PredictionCard + scheduled GamePage"
```

---

## Task 16: Add SimilarPlayersSkeleton (standalone) + sanity check

**Files:**
- Create: `frontend/src/components/skeletons/SimilarPlayersSkeleton.jsx`

Note: PlayerPageSkeleton already inlines a SimilarPlayers placeholder (Task 12). This standalone version exists so any future caller has a drop-in. SimilarPlayersCard itself uses an `AnimatePresence` gate that only mounts after data arrives, so there is no internal loading state to replace.

- [ ] **Step 1: Create the file**

```jsx
// frontend/src/components/skeletons/SimilarPlayersSkeleton.jsx
import Skeleton from "../ui/Skeleton.jsx";
import { SkeletonRow } from "./_chrome.jsx";

export default function SimilarPlayersSkeleton({ count = 4 }) {
  return (
    <div className="w-full max-w-sm">
      <Skeleton className="h-3 w-28 mb-3 ml-3" />
      <div className="flex flex-col">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonRow key={i} className={i < count - 1 ? "border-b border-white/[0.04]" : ""}>
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </SkeletonRow>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/skeletons/SimilarPlayersSkeleton.jsx
git commit -m "feat(skeletons): add standalone SimilarPlayersSkeleton"
```

---

## Task 17: Add PlayByPlaySkeleton + wire into PlayByPlay

**Files:**
- Create: `frontend/src/components/skeletons/PlayByPlaySkeleton.jsx`
- Modify: `frontend/src/components/ui/PlayByPlay.jsx`

PlayByPlay has its own internal loading state (lines 559-572) that does NOT match the refresh. Replace with a proper skeleton that mirrors the refreshed PlayByPlay shape (drop chrome, team-color scoring rail strips, ring controls).

- [ ] **Step 1: Create the file**

```jsx
// frontend/src/components/skeletons/PlayByPlaySkeleton.jsx
import Skeleton from "../ui/Skeleton.jsx";

export default function PlayByPlaySkeleton() {
  return (
    <div className="mb-8" data-testid="play-by-play-skeleton">
      {/* Header: icon + title */}
      <div className="flex items-center gap-3 mb-5">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>

      {/* Filter pill row — ring-style pills */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-16 rounded-full" />
        ))}
      </div>

      {/* Plays — hairline-divided rows with team-color rail strips */}
      <div className="flex flex-col">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`relative flex items-start gap-3 py-3 ${i < 7 ? "border-b border-white/[0.04]" : ""}`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/[0.06]" />
            <Skeleton className="h-3 w-10 shrink-0 mt-0.5" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-12 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace the inline skeleton in PlayByPlay.jsx**

In `frontend/src/components/ui/PlayByPlay.jsx`:

1. Add import at the top:
```jsx
import PlayByPlaySkeleton from "../skeletons/PlayByPlaySkeleton.jsx";
```

2. Use the Edit tool to replace lines 559-572 (the entire `if (loading)` branch body):

Replace:
```jsx
  if (loading) {
    return (
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-white/[0.05] animate-pulse shrink-0" />
          <div className="space-y-1.5">
            <div className="h-4 w-36 bg-white/[0.05] rounded animate-pulse" />
            <div className="h-3 w-48 bg-white/[0.04] rounded animate-pulse" />
          </div>
        </div>
        <div className="h-64 animate-pulse" />
      </div>
    );
  }
```

with:
```jsx
  if (loading) {
    return <PlayByPlaySkeleton />;
  }
```

- [ ] **Step 3: Run the PlayByPlay test**

Run: `cd frontend && npx vitest run src/__tests__/components/PlayByPlay.test.jsx`
Expected: PASS — the test (line 84) checks `container.querySelector(".animate-pulse")` is truthy. PlayByPlaySkeleton uses `<Skeleton>` which is `.animate-pulse`, so this still passes.

- [ ] **Step 4: Manual check**

Visit `/nba/games/<id>?tab=plays` on slow 3G. Skeleton should show: header + filter pills + hairline-divided play rows. No bordered block.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/skeletons/PlayByPlaySkeleton.jsx frontend/src/components/ui/PlayByPlay.jsx
git commit -m "feat(skeletons): add PlayByPlaySkeleton, replace inline loading state in PlayByPlay"
```

---

## Task 18: Fix NewsSection compact-mode loading on mobile

**Files:**
- Modify: `frontend/src/components/news/NewsSection.jsx`

Currently the loading state always uses the expanded 1→2→4 grid even when mobile renders the compact 1→2 hairline-divided layout. Match.

- [ ] **Step 1: Edit the loading branch**

In `frontend/src/components/news/NewsSection.jsx`, find the loading branch (lines 67-72):

```jsx
{loading ? (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {[0, 1, 2, 3].map((i) => (
      <NewsCardSkeleton key={i} />
    ))}
  </div>
)
```

Replace with:
```jsx
{loading ? (
  isMobile && !expanded ? (
    /* Compact mobile loading — match hairline-divided 1-col layout */
    <div className="flex flex-col divide-y divide-white/[0.04]">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="w-6 h-6 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
          <Skeleton className="h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  ) : (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <NewsCardSkeleton key={i} />
      ))}
    </div>
  )
)
```

Add to the imports near the top of the file:
```jsx
import Skeleton from "../ui/Skeleton.jsx";
```

- [ ] **Step 2: Manual check**

Visit `/` (Homepage) at `375px` with NewsSection in compact mode (the default on mobile). On slow 3G, the loading state should show a hairline 1-col list, NOT a 4-up card grid.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/news/NewsSection.jsx
git commit -m "fix(NewsSection): match compact loading layout to compact display on mobile"
```

---

## Task 19: Final verify pass + frontend test suite

**Files:** none directly — just verification.

- [ ] **Step 1: Run full verify**

Run: `cd frontend && npm run verify`
Expected: PASS (lint + test + build all green).

If any test fails, root-cause and fix in a follow-up commit on this branch. Do not push if red.

- [ ] **Step 2: Smoke-test all four hot paths in the browser**

Run: `cd frontend && npm run dev`

For each of these pages, throttle DevTools network to "Slow 3G" and confirm the skeleton (a) matches the loaded layout (no CLS), (b) has rail+gradient where the live component has it, (c) renders correctly at `375px`, `768px`, and `1280px`:

- `/` — Homepage games grid (1→2→3 cols), NewsSection compact-vs-expanded
- `/nba` — League page games grid (1→3 cols), Standings (1→2 cols), Playoffs bracket
- `/nba/games/<finalGameId>` — GamePage (info card, quarter scoreboard, top performers, chart)
- `/nba/players/<slug>` — PlayerPage (hero with two-col rankings on mobile, averages, similar players sidebar)

- [ ] **Step 3: Commit the verification log (no code changes expected)**

If `npm run verify` produced no fixes, nothing to commit. If you needed fixups, they should have been committed as part of the failing task — do not bundle.

---

## Self-Review Notes

**Spec coverage:**
- Refresh existing skeletons (12) → Tasks 2–14 (note: Task 11 + 12 split PlayerPageSkeleton into hero and averages-sidebar sub-tasks since the file changes are independent and reviewed separately)
- Add missing skeletons (audit listed 7) → Tasks 15, 16, 17 (3 actually warranted; the other 4 — `AISummarySkeleton`, `BoxScoreSkeleton`, `PlayerAwardsCardSkeleton`, `GameChartSkeleton` — are not implemented because their consumers either already have refresh-styled inline loading states (AISummary), accept data via props with no internal loading (BoxScore, PlayerAwardsCard), or are conditionally rendered after their data arrives (GameChart). Documented as out-of-scope at the bottom of this section.)
- Mobile two-column matching → Task 11 (PlayerPage hero, the user's headline call-out) and Task 18 (NewsSection compact mode)
- Inline loading state audit → Task 18 (NewsSection), Task 17 (PlayByPlay)

**Type/name consistency:** `SkeletonCard`, `SkeletonRow`, `PredictionCardInner`, `PredictionCardSkeleton`, `PlayByPlaySkeleton`, `SimilarPlayersSkeleton`, `TopPerformerCardSkeleton` — names match across tasks.

**Out-of-scope (deferred):**
- AISummary internal loading already matches refresh (rail + gradient on lines 127-130 of `AISummary.jsx`); no work needed.
- BoxScore has no internal loading state (component receives data via props from `gameData.json_build_object` which is gated by the page-level `if (loading)`).
- PlayerAwardsCard same — receives `awards` prop, no internal loading.
- GameChart has no internal loading state (OverviewTab gates rendering on `winProbData` existing); the chart placeholder lives in GamePageSkeleton and is refreshed in Task 10.
