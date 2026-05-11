# Refresh Design Port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the "left-rail refresh" visual language from the mocks at `/_mocks/cards` (`frontend/src/pages/MockCards.jsx`) into production components, replacing `bg-surface-elevated + border + shadow` chrome with rails, top accent stripes, atmospheric gradients, and ring-based control affordances per `docs/refresh-design.md`.

**Architecture:** Each task is one file (occasionally two) edited to mirror its corresponding mock. The mock file (`MockCards.jsx`) is the visual source of truth — when in doubt, copy JSX directly from the named mock function and only swap in production data shapes / imports / Link/onClick wiring. The doc (`docs/refresh-design.md`) is the prose spec.

**Tech Stack:** React 19, Tailwind v4 (tokens defined in `frontend/src/index.css` `@theme`), Framer Motion 12 (`m`, `AnimatePresence`), TanStack Query v5. No new dependencies.

---

## Conventions for this plan

- **Visual refactor, not TDD.** These changes are chrome only — class names, wrapper elements, layout. Existing render/behaviour tests in `src/__tests__/components/` must keep passing; do not modify them unless a test asserts an exact class string from the old chrome (rare). When that happens, update the assertion to match the refresh and note it in the commit message.
- **Source of truth order:** mock JSX (`MockCards.jsx`) → doc spec (`docs/refresh-design.md`) → this plan. The plan summarizes, but mock + doc carry the authoritative class strings.
- **Run from `frontend/`:** all commands assume `cd frontend` first unless prefixed otherwise.
- **Verification per task:**
  1. `npm run lint` — must pass.
  2. `npm test -- <component-or-path>` — the relevant test(s) must still pass (snapshot diff is fine; class strings might change, in which case adjust the assertion only).
  3. Visual check via `npm run dev` on the listed production route.
  4. Visual diff against `/_mocks/cards` (the corresponding mock section).
- **Commit cadence:** one commit per task. Use the suggested message; prefix with `refresh:`.
- **No-changes case:** if a task says "no production change required," verify that the production matches the mock anyway and skip the commit.

---

## Task 1: GameCard — left rail + rating column

**Files:**
- Modify: `frontend/src/components/cards/GameCard.jsx`
- Reference (mock): `RailGameCard` in `frontend/src/pages/MockCards.jsx:268-356`
- Reference (doc): `docs/refresh-design.md` — *Card — left rail variant* (rail table) + *Rating column* + *Pattern application*
- Test: `frontend/src/__tests__/components/GameCard.test.jsx` (existing — verify still passes; adjust assertions only if class-string checks fail)

- [ ] **Step 1: Read the current production file** `frontend/src/components/cards/GameCard.jsx` end-to-end.

- [ ] **Step 2: Replace the outer card chrome.** The current `<div className="relative bg-surface-elevated border border-white/[0.08] p-5 text-center rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.45)] cursor-pointer flex flex-col overflow-hidden">` becomes:

```jsx
<div className="group relative transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer hover:bg-white/[0.04] hover:-translate-y-0.5 max-w-md mx-auto">
```

  Compute `rail` and `isChampionship` next to the existing `isFinal` / `inProgress` / `isPlayoff` block (around line 32-58):

```jsx
const isChampionship = gameType === "final";
const rail = isChampionship
  ? "w-[3px] bg-accent"
  : inProgress
    ? "w-[2px] bg-live animate-[pulse_2s_ease-in-out_infinite]"
    : "w-[2px] bg-white/15 group-hover:bg-white/30 transition-colors duration-200";
```

  Immediately inside the outer `<div>`, insert the rail and conditional atmosphere overlay:

```jsx
<div className={`absolute left-0 top-0 bottom-0 ${rail}`} />
{(inProgress || isChampionship) && (
  <div className={`absolute inset-0 bg-gradient-to-r ${inProgress ? "from-live/[0.05]" : "from-accent/[0.06]"} to-transparent pointer-events-none`} />
)}
```

  The rest of the existing content (teams/scores/center/breakdown/playoff label) must now live inside a `<div className="relative flex items-stretch">` two-column wrapper. The first child wraps the existing content `<div className="flex-1 min-w-0 p-5 text-center">`. The second child is the rating column.

- [ ] **Step 3: Add the rating into the CENTER column (between teams).** This replaces the `<div className="absolute top-3 right-3 z-10"><GameRatingPill .../></div>` block (currently at lines ~83-87 of the file). **No right-side rating column** — GameCard's center column already sits between the two teams, which is where the rating goes. (StatCard handles it differently — see Task 3 — because StatCard has no center column.)

  Inside the center column (the `<div className="flex flex-col items-center justify-center flex-shrink-0 w-[90px] ...">` between Home and Away), insert the rating between the date and the status line, gated on Final games with a grade:

```jsx
{isFinal && game.grade != null && (
  <div className="flex flex-col items-center mt-1">
    <span className={`font-bold text-2xl tabular-nums leading-none ${game.grade < 0 ? "text-loss" : "text-accent"}`}>
      {game.grade.toFixed(1)}
    </span>
    <span className="text-[8px] uppercase tracking-widest text-text-tertiary mt-0.5 font-medium">Rating</span>
  </div>
)}
```

  Note: the outer `flex items-stretch` two-column wrapper from earlier drafts is NOT used here. The card stays single-column with `<div className="relative p-5 text-center">` wrapping all content. Make sure the center column carries `overflow-hidden` so the rating cleanly clips inside `w-[90px]`.

  Remove the `import GameRatingPill from "./GameRatingPill.jsx";` line at the top of the file. (`GameRatingPill.jsx` and its test get deleted in Task 2.)

- [ ] **Step 4: Refresh the playoff round label.** Find the `{isPlayoff && game.game_label && (...)}` block (currently `<p className="mt-2 pt-2 border-t border-white/[0.06] text-xs font-medium text-text-tertiary text-center tracking-wide">`). Replace with the championship-aware version + `SeriesDots`:

  Add a `SeriesDots` helper inside the file (top-level, above `GameCard`) and a `TrophyIcon` helper. Copy both from `MockCards.jsx:237-264`. (Or extract to `frontend/src/components/cards/_GameCardAtoms.jsx` if you prefer; the mock keeps them inline.) Then replace the playoff label block with:

```jsx
{isPlayoff && game.game_label && (
  <div className={`mt-2 pt-2 border-t ${isChampionship ? "border-accent/30" : "border-white/[0.04]"}`}>
    <p className={`flex items-center justify-center gap-1.5 text-center tracking-wide ${isChampionship ? "text-accent font-semibold uppercase tracking-[0.15em] text-[11px]" : "text-xs text-text-tertiary font-medium"}`}>
      {isChampionship && <TrophyIcon className="w-3 h-3" />}
      {game.game_label}
      {isChampionship && <TrophyIcon className="w-3 h-3" />}
    </p>
    {!game.game_label.toLowerCase().includes("play-in") && (
      <SeriesDots home={game.home_series_wins} away={game.away_series_wins} />
    )}
  </div>
)}
```

  Delete the separate `(() => { const h = Number(...) ... })()` "lead 3-1" text block — `SeriesDots` replaces it. Keep the `play-in` guard.

- [ ] **Step 5: Score margin pip on the winning side.** Inside each team column, where the score is rendered (current `<m.div ... className="text-lg font-bold min-h-[28px] ...">{game.homescore}</m.div>`), change to baseline-aligned flex with a margin pip when that team won:

```jsx
<m.div
  key={homeAnimKey}
  variants={scoreUpdateVariants}
  initial={homeAnimKey === 0 ? false : "initial"}
  animate="animate"
  exit="exit"
  className={`text-lg font-bold tabular-nums flex items-baseline justify-center gap-1 min-h-[28px] ${scoreColor(homeWon, awayWon && isFinal)}`}
>
  {game.homescore}
  {homeWon && Math.abs(game.homescore - game.awayscore) > 0 && (
    <span className="text-[10px] text-text-tertiary font-medium">+{Math.abs(game.homescore - game.awayscore)}</span>
  )}
</m.div>
```

  Mirror for `awayWon`.

- [ ] **Step 6: Keep the chevron mobile breakdown toggle.** The mock omits it because it's a static demo (CSS hover only), but production needs the chevron as the touch-device fallback for the breakdown expand. Leave the `<button onClick={...} aria-label={isExpanded ? "Hide quarter breakdown" : "Show quarter breakdown"}>` block intact at the bottom of the card. It uses `[@media(hover:hover)]:!hidden` so it only renders on touch devices.

- [ ] **Step 7: Lint.**

Run: `cd frontend && npm run lint`
Expected: PASS

- [ ] **Step 8: Run GameCard test.**

Run: `cd frontend && npm test -- GameCard`
Expected: PASS. If any test asserts the old `bg-surface-elevated` class string or the chevron button, update the assertion to match the refresh (these are class-string sanity checks, not behaviour).

- [ ] **Step 9: Visual check.** `npm run dev`, open the homepage and `/{nba|nhl|nfl}` league pages. Verify: rails differ for Final/Live/Playoff/Final-Championship, rating shows in the right column when present, hover lifts the card and brightens rail, no border around the card.

- [ ] **Step 10: Commit.**

```bash
git add frontend/src/components/cards/GameCard.jsx
git commit -m "refresh(GameCard): port to left-rail variant with rating column"
```

---

## Task 2: Delete GameRatingPill

**Files:**
- Delete: `frontend/src/components/cards/GameRatingPill.jsx`
- Delete: `frontend/src/__tests__/components/GameRatingPill.test.jsx`

- [ ] **Step 1: Confirm no remaining imports.**

Run: `cd /Users/yassin/work/Scorva && grep -rn "GameRatingPill" frontend/src/`
Expected: empty output. (Task 1 removed the only import; if anything remains, fix that first.)

- [ ] **Step 2: Delete the files.**

Run: `rm frontend/src/components/cards/GameRatingPill.jsx frontend/src/__tests__/components/GameRatingPill.test.jsx`

- [ ] **Step 3: Lint + test.**

Run: `cd frontend && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add -A
git commit -m "refresh(GameRatingPill): delete; rating moved into GameCard rating column"
```

---

## Task 3: StatCard — left rail + rating column

**Files:**
- Modify: `frontend/src/components/cards/StatCard.jsx`
- Reference (mock): `RailStatCard` in `MockCards.jsx:360-413`
- Reference (doc): `docs/refresh-design.md` — *Card — left rail variant* (StatCard W/L variants table)
- Test: `frontend/src/__tests__/components/StatCard.test.jsx`

- [ ] **Step 1: Read the current file.**

- [ ] **Step 2: Replace outer chrome and add the rail.** Compute `rail` near the top of the component:

```jsx
const gameType = stat.gameType || "regular";
const isPlayoff = gameType === "playoff" || gameType === "final";
const isChampionship = gameType === "final";
const rail = isChampionship
  ? "w-[3px] bg-accent"
  : isPlayoff
    ? "w-[2px] bg-accent/70 group-hover:bg-accent transition-colors duration-200"
    : stat.result === "W"
      ? "w-[2px] bg-win/60 group-hover:bg-win transition-colors duration-200"
      : "w-[2px] bg-loss/60 group-hover:bg-loss transition-colors duration-200";
```

  Outer wrapper becomes:

```jsx
<div className="group relative transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer max-w-sm mx-auto hover:bg-white/[0.04] hover:-translate-y-0.5">
  <div className={`absolute left-0 top-0 bottom-0 ${rail}`} />
  <div className="relative flex items-stretch">
    <div className="flex-1 min-w-0 p-5 text-center">
      {/* existing content: opponent header + stats list + playoff label */}
    </div>
    {stat.ratingGrade != null && (
      <div className="shrink-0 px-3.5 py-3 flex flex-col items-center justify-center">
        <span className="text-accent font-bold text-3xl tabular-nums leading-none">{stat.ratingGrade.toFixed(1)}</span>
        <span className="text-[9px] uppercase tracking-widest text-text-tertiary mt-1.5 font-medium">Rating</span>
      </div>
    )}
  </div>
</div>
```

- [ ] **Step 3: Refresh the playoff label.** Mirror Task 1, Step 4 — same `border-accent/30 vs border-white/[0.06]` switch and trophy flank for championship games. Copy from `MockCards.jsx:396-404`.

- [ ] **Step 4: Lint + test.**

Run: `cd frontend && npm run lint && npm test -- StatCard`
Expected: PASS.

- [ ] **Step 5: Visual check.** Open a player page (e.g. `/nba/players/...`) — recent games render StatCards.

- [ ] **Step 6: Commit.**

```bash
git add frontend/src/components/cards/StatCard.jsx
git commit -m "refresh(StatCard): port to left-rail variant with rating column"
```

---

## Task 4: RosterCard — rail-on-hover + ring chrome

**Files:**
- Modify: `frontend/src/components/team/RosterGrid.jsx`
- Reference (mock): `RefreshedRosterCard` in `MockCards.jsx:548-592`
- Reference (doc): `docs/refresh-design.md` — *RosterGrid / RosterCard*
- Test: `frontend/src/__tests__/components/RosterGrid.test.jsx`

- [ ] **Step 1: Read the file.**

- [ ] **Step 2: Replace the card outer.** Find the per-player `<Link>` wrapper. Strip `bg-surface-elevated`, `border border-white/[0.08]`, both shadow layers. Keep `rounded-2xl overflow-hidden` (needed to clip the oversized jersey number). New outer:

```jsx
<Link
  to={...}
  className="group relative block overflow-hidden rounded-2xl transition-all duration-[300ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/[0.04] hover:-translate-y-1 cursor-pointer"
>
  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/[0.06] group-hover:bg-accent transition-colors duration-200" />
  {/* existing jersey number + content */}
</Link>
```

- [ ] **Step 3: Swap avatar + position pill chrome.** Avatar `<img>`:
  - Was: `bg-surface-overlay border border-white/[0.08]` (or `ring-1 ring-white/[0.18]`)
  - Now: `bg-surface-overlay/40 ring-1 ring-white/[0.06] group-hover:ring-accent/30 transition-all duration-[300ms]`

  Position pill:
  - Was: `bg-white/[0.05] border border-white/[0.06]`
  - Now: `bg-white/[0.05] ring-1 ring-white/[0.06]`

- [ ] **Step 4: Stat-row footer divider.** Keep `border-t border-white/[0.05]` — unchanged.

- [ ] **Step 5: Lint + test.**

Run: `cd frontend && npm run lint && npm test -- RosterGrid`
Expected: PASS.

- [ ] **Step 6: Visual check.** Open `/nba/teams/<team>` or any team page → Roster tab.

- [ ] **Step 7: Commit.**

```bash
git add frontend/src/components/team/RosterGrid.jsx
git commit -m "refresh(RosterGrid): drop card chrome, add hover rail + ring avatar"
```

---

## Task 5: SimilarPlayersCard — container chrome removal + row rails

**Files:**
- Modify: `frontend/src/components/cards/SimilarPlayersCard.jsx`
- Reference (mock): `RefreshedSimilarPlayersCard` in `MockCards.jsx:449-480`
- Reference (doc): `docs/refresh-design.md` — *SimilarPlayersCard*

- [ ] **Step 1: Read the file.**

- [ ] **Step 2: Strip container chrome.** Outer wrapper becomes:

```jsx
<div className="w-full max-w-sm">
  <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-tertiary mb-3 pl-3">
    Similar Players
  </h3>
  <div className="flex flex-col">
    {/* rows */}
  </div>
</div>
```

  (Remove any `bg-surface-elevated`, `border`, `shadow`, `rounded-2xl` on the outer.)

- [ ] **Step 3: Per-row rail-on-hover.** Each player `<Link>` row:

```jsx
<Link
  key={player.id}
  to={...}
  className={`group relative flex items-center gap-3 pl-3 pr-3 py-3 transition-colors duration-200 hover:bg-white/[0.03] ${idx < players.length - 1 ? "border-b border-white/[0.04]" : ""}`}
>
  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-transparent group-hover:bg-accent transition-colors duration-200" />
  {/* avatar + name + meta */}
</Link>
```

- [ ] **Step 4: Soften avatar chrome.** `<div className="w-10 h-10 rounded-full overflow-hidden bg-surface-overlay/40 border border-white/[0.06] shrink-0">` — keep the `border` here (matches mock exactly). Name keeps `group-hover:text-accent transition-colors duration-150`.

- [ ] **Step 5: Lint + test.**

Run: `cd frontend && npm run lint && npm test`
Expected: PASS. (No dedicated test exists; sanity-check the rest of the suite.)

- [ ] **Step 6: Visual check.** Player page sidebar shows Similar Players.

- [ ] **Step 7: Commit.**

```bash
git add frontend/src/components/cards/SimilarPlayersCard.jsx
git commit -m "refresh(SimilarPlayersCard): drop container chrome, hover rail on rows"
```

---

## Task 6: PlayerAwardsCard — container chrome removal + Legendary accent rail

**Files:**
- Modify: `frontend/src/components/cards/PlayerAwardsCard.jsx`
- Reference (mock): `RefreshedPlayerAwardsCard`, `AwardSection`, `AwardRow`, `TIER_STYLES` in `MockCards.jsx:484-530`
- Reference (doc): `docs/refresh-design.md` — *PlayerAwardsCard*
- Test: `frontend/src/__tests__/components/PlayerAwardsCard.test.jsx`

- [ ] **Step 1: Read the file.**

- [ ] **Step 2: Strip container chrome.** Outer becomes:

```jsx
<div className="w-full max-w-2xl">
  <div className="text-[11px] uppercase tracking-[0.22em] text-text-tertiary mb-6 pl-3 font-semibold">
    Career Honors
  </div>
  <div className="flex flex-col gap-7">
    <AwardSection title="Legendary" awards={groups.legendary} tier="legendary" accentRail />
    <AwardSection title="Major Honors" awards={groups.major} tier="major" />
    <AwardSection title="Selections" awards={groups.selection} tier="selection" />
  </div>
</div>
```

- [ ] **Step 3: AwardSection with conditional rail.** Replace the existing section wrapper:

```jsx
function AwardSection({ title, awards, tier, accentRail }) {
  if (!awards.length) return null;
  return (
    <div className={`relative ${accentRail ? "pl-4" : ""}`}>
      {accentRail && <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-accent rounded-full" />}
      <div className={`text-[10px] uppercase tracking-[0.18em] mb-3 font-semibold ${accentRail ? "text-accent" : "text-text-tertiary"}`}>
        {title}
      </div>
      <div className="flex flex-col">
        {awards.map((award) => <AwardRow key={award.type} award={award} tier={tier} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Keep `AwardRow` expandable behaviour.** The current production `AwardRow` has an expand toggle when `award.count > 4`. Preserve that logic; only swap the row outer to:

```jsx
<div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-white/[0.06] last:border-b-0">
  {/* label · years · count */}
</div>
```

  Tier text styles (`text-sm font-semibold` for legendary, etc.) follow `MockCards.jsx:484-488` `TIER_STYLES`.

- [ ] **Step 5: Lint + test.**

Run: `cd frontend && npm run lint && npm test -- PlayerAwardsCard`
Expected: PASS. The expand-on-click behaviour test (existing) must still pass; if it asserts the old wrapper class, update the assertion.

- [ ] **Step 6: Visual check.** Open any veteran player page (e.g. LeBron, Brady, Crosby).

- [ ] **Step 7: Commit.**

```bash
git add frontend/src/components/cards/PlayerAwardsCard.jsx
git commit -m "refresh(PlayerAwardsCard): drop chrome, accent rail on Legendary"
```

---

## Task 7: PlayerAvgCard — top stripe + atmospheric gradient

**Files:**
- Modify: `frontend/src/components/cards/PlayerAvgCard.jsx`
- Reference (mock): `RefreshedPlayerAvgCard` in `MockCards.jsx:417-445`
- Reference (doc): `docs/refresh-design.md` — *PlayerAvgCard*
- Test: `frontend/src/__tests__/components/PlayerAvgCard.test.jsx`

- [ ] **Step 1: Read the file.**

- [ ] **Step 2: Replace the wrapper.** Drop `bg-surface-elevated`, `border`, `shadow`. New shell:

```jsx
<div className="relative overflow-hidden rounded-2xl w-full">
  <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/60" />
  <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.06] via-transparent to-transparent pointer-events-none" />
  <div className="relative">
    <div className="text-accent text-[11px] uppercase tracking-[0.22em] font-semibold text-center pt-4 pb-3 border-b border-white/[0.05]">
      {season} Regular Season
    </div>
    <div className="px-6 py-7">
      <ul className="flex flex-wrap gap-y-6 justify-around w-full">
        {/* stat items */}
      </ul>
    </div>
  </div>
</div>
```

  Replace the existing `bg-accent/10` filled header strip — the gradient + stripe carry the accent weight now.

- [ ] **Step 3: Bump stat values to `text-4xl`.** Existing values are likely `text-3xl sm:text-4xl`; collapse to `text-4xl` (mock uses `font-bold text-4xl mt-1.5 text-text-primary tabular-nums`).

- [ ] **Step 4: Lint + test.**

Run: `cd frontend && npm run lint && npm test -- PlayerAvgCard`
Expected: PASS.

- [ ] **Step 5: Visual check.** Open any player page — top "Season Averages" card.

- [ ] **Step 6: Commit.**

```bash
git add frontend/src/components/cards/PlayerAvgCard.jsx
git commit -m "refresh(PlayerAvgCard): top stripe + atmospheric gradient, drop chrome"
```

---

## Task 8: GameMatchupHeader — atmospheric wrap + SeriesDots + championship label

**Files:**
- Modify: `frontend/src/components/game/GameMatchupHeader.jsx`
- Reference (mock): `RefreshedGameMatchupHeader` in `MockCards.jsx:596-642` + `GameRatingBadge` in `MockCards.jsx:692-705` + `SeriesDots` + `TrophyIcon`
- Reference (doc): `docs/refresh-design.md` — *GameMatchupHeader* + *GameRatingBadge*
- Test: `frontend/src/__tests__/components/GameMatchupHeader.test.jsx`

- [ ] **Step 1: Read the file.**

- [ ] **Step 2: Wrap the header in an atmospheric container for championship games.** Currently the outermost element is `<div className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_1fr] items-center justify-center gap-8 sm:gap-16 mb-10">`. Wrap that in a new outer:

```jsx
<div className="relative overflow-hidden rounded-2xl mb-10">
  {isChampionship && (
    <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.04] to-transparent pointer-events-none" />
  )}
  <div className="relative grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-8 sm:gap-16 py-8 px-4">
    {/* home column + center + away column */}
  </div>
</div>
```

  Compute `isChampionship` early in the component (probably `game.type === "final"`). Existing `mb-10` moves up to the outer; remove it from the grid inner.

- [ ] **Step 3: Update GameRatingBadge.** The badge already exists in this file. Swap chrome:
  - Was: `bg-surface-overlay border border-white/[0.1]`
  - Now: `bg-white/[0.04] ring-1 ring-white/[0.08]`

- [ ] **Step 4: Replace the playoff round label.** Find the `{game.gameLabel && (<span className="text-sm font-medium text-text-secondary text-center">...)`. For championship games, switch to:

```jsx
<p className={`flex items-center justify-center gap-1.5 ${isChampionship ? "text-accent font-semibold uppercase tracking-[0.18em] text-[11px]" : "text-sm font-medium text-text-secondary"}`}>
  {isChampionship && <TrophyIcon className="w-3 h-3" />}
  {game.gameLabel}
  {isChampionship && <TrophyIcon className="w-3 h-3" />}
</p>
```

  Import or define `TrophyIcon` (copy from `MockCards.jsx:237-243` — or extract to `frontend/src/components/cards/_icons.jsx` and import everywhere it's needed).

- [ ] **Step 5: Replace text-based series score with SeriesDots.** The existing `(() => { const { homeWins: h, awayWins: a } = game.seriesScore; ... })()` block renders text like "Lakers lead 3-1". Replace with `<SeriesDots home={game.seriesScore.homeWins} away={game.seriesScore.awayWins} />` — and define/import `SeriesDots` (copy from `MockCards.jsx:245-263`).

- [ ] **Step 6: Lint + test.**

Run: `cd frontend && npm run lint && npm test -- GameMatchupHeader`
Expected: PASS. If a test asserts text content like "Lakers lead 3-1", it will break — `SeriesDots` is purely visual. Update the test to assert dot count + filled state instead, or relax the assertion.

- [ ] **Step 7: Visual check.** Open `/nba/games/<some-playoff-game-id>` and `/nba/games/<finals-game-id>`. Verify atmospheric gradient on Finals, dots replace text, trophy flanks championship label.

- [ ] **Step 8: Commit.**

```bash
git add frontend/src/components/game/GameMatchupHeader.jsx
git commit -m "refresh(GameMatchupHeader): atmospheric wrap, SeriesDots, ring badge"
```

---

## Task 9: GameInfoCard — drop chrome, left rail, hairline rows

**Files:**
- Modify: `frontend/src/components/game/GameInfoCard.jsx`
- Reference (mock): `RefreshedGameInfoCard` in `MockCards.jsx:646-666`
- Reference (doc): `docs/refresh-design.md` — *GameInfoCard*

- [ ] **Step 1: Read the file.**

- [ ] **Step 2: Replace the entire component body** with the mock shape, mapping the existing rows array (Date / Status / Location / Broadcast) into the new layout:

```jsx
<div className="relative pl-4 mb-6">
  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent/40 rounded-full" />
  <div className="flex flex-col">
    {rows.map(({ label, value }, i) => (
      <div key={label} className={`flex items-center justify-between gap-4 py-3 ${i < rows.length - 1 ? "border-b border-white/[0.05]" : ""}`}>
        <span className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary font-semibold shrink-0">{label}</span>
        <span className="text-sm font-medium text-text-primary text-right">{value}</span>
      </div>
    ))}
  </div>
</div>
```

  Drop `bg-surface-elevated`, `border border-white/[0.08]`, `rounded-2xl`, `shadow-[0_4px_20px_rgba(0,0,0,0.3)]` from the previous outer.

- [ ] **Step 3: Lint + test.**

Run: `cd frontend && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 4: Visual check.** Any GamePage shows this directly below the matchup header.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/components/game/GameInfoCard.jsx
git commit -m "refresh(GameInfoCard): drop chrome, accent rail, hairline rows"
```

---

## Task 10: Quarter scoreboard — chrome removal inside OverviewTab

**Files:**
- Modify: `frontend/src/components/game/OverviewTab.jsx` (inline scoreboard block)
- Reference (mock): `RefreshedQuarterScoreboard` in `MockCards.jsx:709-735`
- Reference (doc): `docs/refresh-design.md` — *Quarter scoreboard*
- Test: `frontend/src/__tests__/components/OverviewTab.test.jsx`

- [ ] **Step 1: Read the file.** Find the scoreboard block — it's the `<div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">` containing `<div className="font-mono text-sm w-full">` with the quarter header row + home row + divider + away row.

- [ ] **Step 2: Replace the wrapper.**
  - Was: `<div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)] mb-6">`
  - Now: `<div className="relative mb-6">`

- [ ] **Step 3: Strengthen the header bottom border.** The header row (currently `border-b border-white/[0.06]`) → `border-b border-white/[0.08]`.

- [ ] **Step 4: Bump header tracking + add tabular-nums on cells.** Header labels: change `tracking-widest` → `tracking-[0.18em]`. Add `tabular-nums` to every quarter cell `<span>` (already on totals — extend to per-quarter `<span className="w-7 text-center shrink-0 text-text-secondary text-xs">{...}</span>`).

- [ ] **Step 5: Lint + test.**

Run: `cd frontend && npm run lint && npm test -- OverviewTab`
Expected: PASS.

- [ ] **Step 6: Visual check.** Finals/in-progress NBA game GamePage Overview tab.

- [ ] **Step 7: Commit.**

```bash
git add frontend/src/components/game/OverviewTab.jsx
git commit -m "refresh(OverviewTab): drop chrome on quarter scoreboard"
```

---

## Task 11: Prediction Locked stripe — drop bg, add rail

**Files:**
- Modify: `frontend/src/components/game/OverviewTab.jsx` (inline locked-prediction block)
- Reference (mock): `RefreshedPredictionLocked` in `MockCards.jsx:739-758`
- Reference (doc): `docs/refresh-design.md` — *Prediction Locked stripe*

- [ ] **Step 1: Find the block.** It's the conditional render in `OverviewTab.jsx` shown when the prior playoff game hasn't finished — has the diagonal stripe pattern + radial glow + lock icon.

- [ ] **Step 2: Replace the wrapper.**
  - Was: `<div className="relative overflow-hidden rounded-2xl mb-6 bg-surface-elevated border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">`
  - Now: `<div className="relative overflow-hidden rounded-2xl mb-6">`

  Immediately inside, insert: `<div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent/60" />`

- [ ] **Step 3: Adjust stripe opacity.** The diagonal `repeating-linear-gradient(...)` was at `opacity-[0.06]` (or similar). Drop to `opacity-[0.05]` since the surface bg is gone.

- [ ] **Step 4: Lint + visual + commit.**

```bash
cd frontend && npm run lint
git add frontend/src/components/game/OverviewTab.jsx
git commit -m "refresh(OverviewTab): rail-only Prediction Locked stripe"
```

---

## Task 12: GameTabBar — no change required, optional indicator bump

**Files:**
- Read-only: `frontend/src/components/game/GameTabBar.jsx`
- Reference (doc): `docs/refresh-design.md` — *GameTabBar*

- [ ] **Step 1: Verify the tab bar already uses `bg-accent` underline + `text-accent` active.** No production change needed.

- [ ] **Step 2 (optional):** Bump the underline from `h-0.5` to `h-[2px]` for a slightly bolder accent line. Skip if `h-0.5` already renders as 2px in your viewport.

- [ ] **Step 3:** No commit if no change.

---

## Task 13: TopPerformerCard — drop outer chrome, keep gradient slab

**Files:**
- Modify: `frontend/src/components/cards/TopPerformerCard.jsx`
- Reference (mock): `RefreshedTopPerformerCard` in `MockCards.jsx:765-803`
- Reference (doc): `docs/refresh-design.md` — *TopPerformerCard*
- Test: `frontend/src/__tests__/components/TopPerformancesCard.test.jsx` (if applicable)

- [ ] **Step 1: Read the file.**

- [ ] **Step 2: Replace outer wrapper.** The gradient slab (88px wide, team-coloured) stays — it IS the rail. Drop only the outer chrome.

```jsx
<Link
  to={...}
  className="group relative flex items-stretch h-[108px] rounded-2xl overflow-hidden transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/[0.04] hover:-translate-y-0.5 cursor-pointer w-full"
>
  {/* gradient slab + info zone */}
</Link>
```

  Removed: `bg-surface-elevated`, `border border-white/[0.08]`, `hover:bg-surface-overlay hover:border-white/[0.14]`.

- [ ] **Step 3: Remove the rating-column divider.** Find the `border-l border-white/[0.08]` on the rating column wrapper — delete it. The accent rating numeral carries enough weight.

- [ ] **Step 4: Lint + test.**

Run: `cd frontend && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 5: Visual check.** GamePage Overview tab → 3-card row near the top.

- [ ] **Step 6: Commit.**

```bash
git add frontend/src/components/cards/TopPerformerCard.jsx
git commit -m "refresh(TopPerformerCard): drop outer chrome, keep slab rail"
```

---

## Task 14: PredictionCard — top stripe, radial glow kept, ring confidence pill

**Files:**
- Modify: `frontend/src/components/cards/PredictionCard.jsx`
- Reference (mock): `RefreshedPredictionCard` in `MockCards.jsx:819-908`
- Reference (doc): `docs/refresh-design.md` — *PredictionCard*

- [ ] **Step 1: Read the file.**

- [ ] **Step 2: Replace inner card chrome.** The component already has a heading + main card region. The main card:
  - Was: `bg-surface-elevated border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.35)]` (plus `relative overflow-hidden rounded-2xl`)
  - Now: `relative overflow-hidden rounded-2xl` (only)

  Add immediately inside: `<div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/60" />`. The radial glow div stays unchanged.

- [ ] **Step 3: Convert confidence pill border → ring.**
  - Was: `border border-white/[0.08]`
  - Now: `ring-1 ring-white/[0.08]`

- [ ] **Step 4: Bump section kicker tracking.** Headers like "Key Factors", "Injuries", "Stats" — change `tracking-wider` to `tracking-[0.18em]`.

- [ ] **Step 5: Lint + visual + commit.**

Run: `cd frontend && npm run lint`

```bash
git add frontend/src/components/cards/PredictionCard.jsx
git commit -m "refresh(PredictionCard): top stripe + ring chrome, keep radial glow"
```

---

## Task 15: TeamComparison — top stripe, atmospheric gradient, kicker + title, RATING row

**Files:**
- Modify: `frontend/src/components/game/TeamComparison.jsx`
- Reference (mock): `RefreshedTeamComparison`, `ComparisonRow` in `MockCards.jsx:912-973`
- Reference (doc): `docs/refresh-design.md` — *TeamComparison*
- Test: `frontend/src/__tests__/components/TeamComparison.test.jsx`

- [ ] **Step 1: Read the file** (current state already includes the `RATING` row logic — `RatingRow` + `hasRating` block).

- [ ] **Step 2: Replace outer wrapper.**
  - Was: `<div className="mt-6 w-full bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] p-6 sm:p-8">`
  - Now:

```jsx
<div className="relative overflow-hidden rounded-2xl mt-6 w-full">
  <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/60" />
  <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.04] to-transparent pointer-events-none" />
  <div className="relative p-6 sm:p-8">
    {/* header + comparison body */}
  </div>
</div>
```

- [ ] **Step 3: Split header into kicker + title.** The current header is a single `<h3 className="text-2xl font-bold tracking-tight text-text-primary mb-6 text-center">Team Comparison</h3>`. Replace with:

```jsx
<div className="text-center">
  <p className="text-[11px] uppercase tracking-[0.22em] text-text-tertiary font-semibold">Team Comparison</p>
  <h3 className="text-2xl font-bold tracking-tight text-text-primary mt-1">Season Averages</h3>
</div>
```

- [ ] **Step 4: Team header strip — `border-y` instead of `border-b`.** Current: `<div className="flex items-center gap-4 pb-5 mb-5 border-b border-white/[0.06]">`. Now:

```jsx
<div className="flex items-center gap-4 py-4 mt-4 border-y border-white/[0.06]">
  {/* TeamHeader x 2 + vs */}
</div>
```

- [ ] **Step 5: Keep RATING-row separator.** The current `<div className="border-t border-white/[0.06] mt-6" />` after `<RatingRow>` stays; just sanity-check the spacing reads correctly under the new wrapper.

- [ ] **Step 6: Lint + test.**

Run: `cd frontend && npm run lint && npm test -- TeamComparison`
Expected: PASS. Class-string assertions may need updating.

- [ ] **Step 7: Visual check.** GamePage Analysis tab.

- [ ] **Step 8: Commit.**

```bash
git add frontend/src/components/game/TeamComparison.jsx
git commit -m "refresh(TeamComparison): top stripe + gradient + kicker/title split"
```

---

## Task 16: BoxScore — table chrome removal, ring sort pill

**Files:**
- Modify: `frontend/src/components/ui/BoxScore.jsx`
- Reference (mock): `RefreshedBoxScore` in `MockCards.jsx:977-1022`
- Reference (doc): `docs/refresh-design.md` — *BoxScore*

- [ ] **Step 1: Read the file.**

- [ ] **Step 2: Replace per-team wrapper.**
  - Was: `<div className="bg-surface-elevated border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.35)] flex flex-col h-full">`
  - Now: `<div className="w-full">`

- [ ] **Step 3: Replace header row.**
  - Was: `<div className="px-5 py-4 border-b border-white/[0.06] ...">` (or similar)
  - Now: `<div className="flex items-center justify-between gap-3 pb-3 mb-2 border-b border-white/[0.08]">`

- [ ] **Step 4: Sort pill chrome.** Convert `border border-accent/...` → `ring-1 ring-accent/20`. Keep `bg-accent/10 text-accent`.

- [ ] **Step 5: Per-row hover + hairline.** Each `<tr>` gets `border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors duration-150`. Header `<th>` cells use `text-[10px] uppercase tracking-[0.18em]`. Currently-sorted column header stays `text-accent`.

- [ ] **Step 6: Lint + test.**

Run: `cd frontend && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 7: Visual check.** GamePage Analysis tab → box score.

- [ ] **Step 8: Commit.**

```bash
git add frontend/src/components/ui/BoxScore.jsx
git commit -m "refresh(BoxScore): drop card chrome, ring sort pill, hairline rows"
```

---

## Task 17: PlayByPlay — drop list chrome, team-colored scoring rail, ring filters

**Files:**
- Modify: `frontend/src/components/ui/PlayByPlay.jsx`
- Reference (mock): `RefreshedPlayByPlay`, `FilterPill`, `PlayRow` in `MockCards.jsx:1026-1091`
- Reference (doc): `docs/refresh-design.md` — *PlayByPlay*
- Test: `frontend/src/__tests__/components/PlayByPlay.test.jsx`

- [ ] **Step 1: Read the file.**

- [ ] **Step 2: Strip the play-list container chrome.**
  - Was: `<div className="bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] overflow-hidden">` (or similar wrapping the list)
  - Now: `<div className="relative">`

- [ ] **Step 3: Filter pills + search → ring chrome.** Per `FilterPill` in mock:
  - Inactive: `bg-white/[0.03] text-text-secondary hover:bg-white/[0.06] hover:text-text-primary` (no ring)
  - Active: `bg-accent/15 text-accent ring-1 ring-accent/25`

  Search input: `bg-white/[0.03] ring-1 ring-white/[0.06] rounded-full ... focus:ring-accent/40`. Convert any `border border-white/...` to `ring-1 ring-white/...`.

- [ ] **Step 4: Per-play row + scoring rail.** Each row:

```jsx
<div className={`relative flex items-start gap-3 py-3 pl-4 pr-3 transition-colors duration-150 hover:bg-white/[0.02] ${play.scoring ? "bg-white/[0.015]" : ""} ${!isLast ? "border-b border-white/[0.04]" : ""}`}>
  {play.scoring && <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: teamColor }} />}
  {/* clock cell + description + score */}
</div>
```

  `teamColor` is the scoring team's primary colour (`game.home_primary_color` / `away_primary_color` — already plumbed through, see MEMORY note on `teams.primary_color`). Remove the previous full-width tinted-bg scoring highlight.

- [ ] **Step 5: Suggestion dropdown chrome — keep elevation.** The filter suggestion floating panel keeps `bg-surface-elevated ring-1 ring-white/[0.08] shadow-[0_8px_24px_rgba(0,0,0,0.4)]` (modals/dropdowns get to keep chrome — see doc).

- [ ] **Step 6: Lint + test.**

Run: `cd frontend && npm run lint && npm test -- PlayByPlay`
Expected: PASS.

- [ ] **Step 7: Visual check.** GamePage Plays tab.

- [ ] **Step 8: Commit.**

```bash
git add frontend/src/components/ui/PlayByPlay.jsx
git commit -m "refresh(PlayByPlay): drop chrome, team-color scoring rail, ring controls"
```

---

## Task 18: AISummary — left rail + atmospheric gradient

**Files:**
- Modify: `frontend/src/components/ui/AISummary.jsx`
- Reference (mock): `RefreshedAISummary` in `MockCards.jsx:1095-1128`
- Reference (doc): `docs/refresh-design.md` — *AISummary*

- [ ] **Step 1: Read the file.**

- [ ] **Step 2: Replace the card wrapper.** The bullet block:
  - Was: `<div className="bg-surface-elevated border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.35)] rounded-2xl ...">`
  - Now:

```jsx
<div className="relative overflow-hidden rounded-2xl pl-5">
  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent/60" />
  <div className="absolute inset-0 bg-gradient-to-r from-accent/[0.04] via-transparent to-transparent pointer-events-none" />
  <div className="relative p-6 sm:p-8">
    {/* bullets */}
  </div>
  <div className="relative px-6 sm:px-8 py-3 border-t border-white/[0.05]">
    <p className="text-[11px] text-text-tertiary">Generated using AI based on official game statistics</p>
  </div>
</div>
```

  Drop the `bg-surface-base/40` from the footer; just keep `border-t border-white/[0.05]`.

- [ ] **Step 3: Locked / sign-in variant.** Same chrome removal. The gradient curtain over ghost rows still works without the underlying fill.

- [ ] **Step 4: Lint + visual + commit.**

```bash
cd frontend && npm run lint
git add frontend/src/components/ui/AISummary.jsx
git commit -m "refresh(AISummary): rail + atmospheric gradient, drop chrome"
```

---

## Task 19: GameChart / WinProbabilityChart — top stripe + gradient + ring select

**Files:**
- Modify: `frontend/src/components/ui/GameChart.jsx`
- Reference (mock): `RefreshedGameChart` in `MockCards.jsx:1132-1170`
- Reference (doc): `docs/refresh-design.md` — *GameChart / WinProbabilityChart*
- Test: `frontend/src/__tests__/components/GameChart.test.jsx`

- [ ] **Step 1: Read the file.**

- [ ] **Step 2: Replace outer wrapper.**
  - Was: `<div className="bg-surface-elevated border border-white/[0.08] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)] rounded-2xl ...">`
  - Now:

```jsx
<div className="relative overflow-hidden rounded-2xl mb-10">
  <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/60" />
  <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.04] to-transparent pointer-events-none" />
  <div className="relative p-5">
    {/* select + legend + chart */}
  </div>
</div>
```

- [ ] **Step 3: Select dropdown ring.** Trigger:
  - Was: `border border-white/[0.08]`
  - Now: `ring-1 ring-white/[0.08]` with `hover:ring-white/[0.16] focus:ring-accent/40`

  Keep `bg-surface-primary` on the `<option>` list (browsers ignore that styling for native option lists, but it's correct).

- [ ] **Step 4 (optional): Inline team legend** in the header right (small coloured dots + abbrevs). See mock `RefreshedGameChart` for the layout. Skip if it duplicates info shown elsewhere on the GamePage.

- [ ] **Step 5: Lint + test.**

Run: `cd frontend && npm run lint && npm test -- GameChart`
Expected: PASS.

- [ ] **Step 6: Visual check.** GamePage Overview tab — win probability chart.

- [ ] **Step 7: Commit.**

```bash
git add frontend/src/components/ui/GameChart.jsx
git commit -m "refresh(GameChart): top stripe + atmospheric gradient, ring select"
```

---

## Task 20: ReportRow chrome — shared wrapper, hover rail, ring avatars

**Files:**
- Modify: `frontend/src/components/reports/ReportRow.jsx`
- Modify: `frontend/src/components/reports/InjuryReportRow.jsx`
- Modify: `frontend/src/components/reports/MoveReportRow.jsx`
- Modify: `frontend/src/components/reports/BirthdayReportRow.jsx`
- Modify: `frontend/src/components/reports/StreakReportRow.jsx`
- Modify: `frontend/src/components/reports/PlayerAvatar.jsx`
- Modify: `frontend/src/components/reports/NRBadge.jsx`
- Reference (mock): `RowChrome`, `MockInjuryRow`, `MockMoveRow`, `MockBirthdayRow`, `MockStreakRow`, `MockPlayerAvatar`, `MockTeamLogo`, `MockNRBadge` in `MockCards.jsx:1178-1336`
- Reference (doc): `docs/refresh-design.md` — *Reports* section
- Test: `frontend/src/__tests__/components/ReportRow.test.jsx`, `ReportsList.test.jsx`

- [ ] **Step 1: Read all 7 files.**

- [ ] **Step 2: Update PlayerAvatar.** Both the `<img>` and the initials fallback `<div>`:
  - Was: `bg-surface-overlay border border-white/[0.08]`
  - Now: `bg-surface-overlay/40 ring-1 ring-white/[0.06]`

  Size stays `w-9 h-9` for the main avatar.

- [ ] **Step 3: Update NRBadge.** Same chrome swap (`bg-surface-overlay/40 ring-1 ring-white/[0.06]`), size `w-6 h-6`, content `NR`.

- [ ] **Step 4: Extract shared row chrome into ReportRow.** If `ReportRow.jsx` is currently a pure dispatcher (switch on `report.type` → variant), keep the dispatcher but also export a `RowChrome` wrapper:

```jsx
export function RowChrome({ children, to }) {
  return (
    <Link to={to} className="group relative flex items-start gap-3 pl-4 pr-3 py-3 transition-colors duration-200 hover:bg-white/[0.03]">
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-transparent group-hover:bg-accent transition-colors duration-200" />
      {children}
    </Link>
  );
}
```

  (Use `<Link>` from `react-router-dom` since the production rows link to player/team pages.)

- [ ] **Step 5: Refactor the 4 variants to use RowChrome.** Each `InjuryReportRow`, `MoveReportRow`, `BirthdayReportRow`, `StreakReportRow`:
  - Replace the outer wrapper (`<div className="flex items-start gap-3 px-3.5 py-3 hover:bg-surface-overlay">` or similar) with `<RowChrome to={...}>...</RowChrome>`.
  - Right-aligned timestamp: `<span className="text-xs text-text-tertiary shrink-0">{relativeTime(...)}</span>` — unchanged.

- [ ] **Step 6: MoveReportRow inline logos.** The two team-logo `<img>` elements showing `from → to` get `bg-surface-overlay/40 ring-1 ring-white/[0.06]` (no border).

- [ ] **Step 7: StreakReportRow team-logo fallback.** The initials div uses `ring-1 ring-white/[0.06]` (no border).

- [ ] **Step 8: Lint + test.**

Run: `cd frontend && npm run lint && npm test -- Report`
Expected: PASS. Tests that assert specific class strings on the row outer or avatar may need updating to `ring-1 ring-white/[0.06]`.

- [ ] **Step 9: Visual check.** Homepage + Pulse + TeamPage Highlights.

- [ ] **Step 10: Commit.**

```bash
git add frontend/src/components/reports/
git commit -m "refresh(reports): shared RowChrome with hover rail, ring avatars"
```

---

## Task 21: ReportsList — drop container chrome, refresh date headers

**Files:**
- Modify: `frontend/src/components/reports/ReportsList.jsx`
- Reference (mock): `MockReportsList` in `MockCards.jsx:1348-1385`
- Reference (doc): `docs/refresh-design.md` — *ReportsList*
- Test: `frontend/src/__tests__/components/ReportsList.test.jsx`

- [ ] **Step 1: Read the file.**

- [ ] **Step 2: Flat (non-grouped) container.**
  - Was: `<div className="rounded-2xl overflow-hidden bg-surface-elevated border border-white/[0.08] divide-y divide-white/[0.04]">`
  - Now: `<div className="flex flex-col divide-y divide-white/[0.04]">`

- [ ] **Step 3: Date-grouped container.** Each group:

```jsx
<div key={g.key}>
  <div className="flex items-baseline justify-between pl-4 pr-3 pb-1.5">
    <h3 className="text-[10px] uppercase tracking-[0.22em] text-text-secondary font-semibold">
      {dateHeader(g.items[0].date)}
    </h3>
    <span className="text-[10px] text-text-tertiary tabular-nums">
      {g.items.length} update{g.items.length === 1 ? "" : "s"}
    </span>
  </div>
  <div className="flex flex-col divide-y divide-white/[0.04]">
    {g.items.map((r) => <ReportRow key={r.id} report={r} />)}
  </div>
</div>
```

  Outer wrap: `<div className="space-y-4">`. The old `text-xs uppercase tracking-widest text-text-tertiary font-semibold px-1 mb-2` header style is replaced.

- [ ] **Step 4: Skeleton state.** If `ReportRowSkeleton` is rendered inside `ReportsList`'s loading branch, drop the same container chrome (`bg-surface-elevated border + rounded-2xl`) — the skeletons sit directly in a `divide-y` container.

- [ ] **Step 5: Lint + test.**

Run: `cd frontend && npm run lint && npm test -- ReportsList`
Expected: PASS.

- [ ] **Step 6: Visual check.** Homepage, Pulse page, TeamPage Highlights.

- [ ] **Step 7: Commit.**

```bash
git add frontend/src/components/reports/ReportsList.jsx
git commit -m "refresh(ReportsList): flat container + refreshed date group headers"
```

---

## Task 22: NewsCard + NewsCardCompact + NewsSection + NewsPreviewModal

**Files:**
- Modify: `frontend/src/components/news/NewsCard.jsx`
- Modify: `frontend/src/components/news/NewsCardCompact.jsx`
- Modify: `frontend/src/components/news/NewsSection.jsx`
- Modify: `frontend/src/components/news/NewsPreviewModal.jsx`
- Reference (mock): `MockNewsCard` (1395-1426), `MockNewsCardCompact` (1428-1444), `MockNewsSection` (1446-1477), `MockNewsPreviewModal` (1479-end)
- Reference (doc): `docs/refresh-design.md` — News section (to be added in Task 24 if not already present)
- Test: `frontend/src/__tests__/components/NewsCard.test.jsx`, `NewsPreviewModal.test.jsx`

- [ ] **Step 1: Read all 4 files.**

- [ ] **Step 2: NewsCard.** Outer:
  - Was: `bg-surface-elevated border border-white/[0.08] rounded-2xl ... hover:bg-surface-overlay hover:border-white/[0.14]`
  - Now: `group relative w-full h-full text-left flex flex-col rounded-2xl overflow-hidden cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/[0.04] hover:-translate-y-0.5`

  Insert hover rail: `<div className="absolute left-0 top-0 bottom-0 w-[2px] bg-transparent group-hover:bg-accent transition-colors duration-200 z-10" />`

- [ ] **Step 3: NewsCardCompact.** Outer:
  - Was: pill-y card with bg / border
  - Now: `group relative w-full text-left flex items-center gap-3 pl-4 pr-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-white/[0.03] focus:outline-none`

  Hover rail (same pattern as above, sans `z-10`).

- [ ] **Step 4: NewsSection.** Headline kicker swap:

```jsx
<div className="flex items-center justify-between mb-4">
  <h2 className="text-[10px] uppercase tracking-[0.22em] text-text-secondary font-semibold">Headlines</h2>
  <button className="text-[11px] uppercase tracking-wide font-semibold text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer">
    {mode === "expanded" ? "Compact" : "Expand"}
  </button>
</div>
```

  Compact-mode grid: drop the `bg-white/[0.06] gap-px` faux-separator container; use proper divide-x + divide-y per `MockNewsSection`:

```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6 sm:divide-x sm:divide-white/[0.04]">
  <div className="flex flex-col divide-y divide-white/[0.04]">
    {firstHalf.map((article, i) => <NewsCardCompact key={i} article={article} onClick={...} />)}
  </div>
  <div className="flex flex-col divide-y divide-white/[0.04] sm:pl-6">
    {secondHalf.map((article, i) => <NewsCardCompact key={i} article={article} onClick={...} />)}
  </div>
</div>
```

- [ ] **Step 5: NewsPreviewModal.** Modals keep elevation chrome (they need to read as occluding the page). Swap `border` → `ring`, add top accent stripe:

```jsx
<div className="relative w-full max-w-lg mx-auto rounded-2xl overflow-hidden ring-1 ring-white/[0.08] bg-surface-elevated shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
  <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/60 z-10" />
  {/* close button + image + body */}
</div>
```

- [ ] **Step 6: Lint + test.**

Run: `cd frontend && npm run lint && npm test -- News`
Expected: PASS.

- [ ] **Step 7: Visual check.** Homepage News section (toggle expanded ↔ compact). Click an article → preview modal.

- [ ] **Step 8: Commit.**

```bash
git add frontend/src/components/news/
git commit -m "refresh(news): rail-on-hover cards, ring modal chrome, divide-line compact grid"
```

---

## Task 23: Strip residual `border-1` / `border-white/...` in refreshed files

**Files:** as touched by Tasks 1-22.

- [ ] **Step 1: Scan for stragglers.**

Run from `frontend/`:
```bash
grep -rn "border border-white" src/components/cards/ src/components/game/ src/components/ui/ src/components/reports/ src/components/news/ src/components/team/ | grep -v ".test.jsx"
```

  Expected: only intentional `border` (e.g. table hairlines, `border-t border-white/[0.04]` between rows, `border-accent/30` divider above championship label). Any `border border-white/[0.08]` on a card wrapper that survived is a miss — fix it.

- [ ] **Step 2: Lint.**

Run: `cd frontend && npm run lint`
Expected: PASS.

- [ ] **Step 3: Full test run.**

Run: `cd frontend && npm test`
Expected: PASS. If anything fails, it's almost certainly a class-string assertion. Update the test to assert behaviour / role / structure rather than exact classes.

- [ ] **Step 4: Commit** (only if straggler fixes were needed).

```bash
git add -A
git commit -m "refresh: clean up residual border chrome on refactored components"
```

---

## Task 24: Update DESIGN.md and retire refresh-design.md

**Files:**
- Modify: `docs/DESIGN.md`
- Modify (rename or content-overwrite, your call): `docs/refresh-design.md`

- [ ] **Step 1: Read `docs/DESIGN.md`.** Find the Card / Card hover blocks at the top.

- [ ] **Step 2: Replace the Card pattern.** Swap the old `bg-surface-elevated border + shadow` pattern with the rail-based pattern. Use the *Pattern application — by component shape* table from `refresh-design.md` plus the four shape strategies (list-item rail, list-container hairlines, hero top-stripe, modal elevation). Keep brevity — `DESIGN.md` is the canonical doc, not a full rewrite.

- [ ] **Step 3: Mark `refresh-design.md` historical.** Add at the top:

```markdown
> **Status (2026-05-11):** Ported to production. This file is preserved for the historical record of the rail-refresh decisions and the per-component before/after JSX. Day-to-day reference lives in `docs/DESIGN.md`.
```

  Alternatively delete `refresh-design.md` entirely — the mock file (`MockCards.jsx`) still serves as the visual reference once ported. Discuss with the user before deletion; default to "mark historical."

- [ ] **Step 4: Commit.**

```bash
git add docs/DESIGN.md docs/refresh-design.md
git commit -m "docs: promote rail refresh to DESIGN.md, mark refresh-design.md historical"
```

---

## Task 25: Decide on MockCards.jsx + route — retire or keep?

**Files:**
- `frontend/src/pages/MockCards.jsx`
- `frontend/src/App.jsx` (route)

- [ ] **Step 1: Ask the user.** Once the ports land, the mock route at `/_mocks/cards` is either a useful regression reference or dead weight. **Don't delete without confirmation.** Default position: keep — it's lazy-imported (only loaded when the route is hit), the doc references it, and it makes future visual experiments cheap.

- [ ] **Step 2 (if user opts to retire):**

```bash
rm frontend/src/pages/MockCards.jsx
```

  Remove the lazy import + `<Route path="/_mocks/cards" .../>` from `frontend/src/App.jsx`.

- [ ] **Step 3: Lint + test + commit.**

```bash
cd frontend && npm run lint && npm test
git add -A
git commit -m "chore: retire MockCards mocks after refresh ported to production"
```

---

## Final verification

After all tasks land:

- [ ] `cd frontend && npm run verify` (lint + test + build) — must pass.
- [ ] Open the dev server and walk through: Homepage (game feed, reports, news), a league page (`/nba`, `/nhl`, `/nfl`), a player page (PlayerAvgCard, StatCards, SimilarPlayers, Awards), a team page (RosterGrid, Highlights), a GamePage for each of: pre-game, in-progress, Finals, regular Final, playoff Final.
- [ ] Confirm no remaining `bg-surface-elevated` on a top-level card wrapper outside modals/dropdowns. Modals (e.g. `NewsPreviewModal`, `AuthModal`, suggestion floats) keep their elevation chrome by design.

---

## Notes / gotchas

- **`TrophyIcon` + `SeriesDots`** are used in both `GameCard` and `GameMatchupHeader`. After Task 1 + Task 8 land, consider extracting to `frontend/src/components/ui/icons/Trophy.jsx` and `frontend/src/components/ui/SeriesDots.jsx` to dedupe. This is a follow-up tidy, not part of the visual refresh — defer unless it bites you.
- **Class-string tests will be the main breakage source.** When a test asserts `expect(container.firstChild).toHaveClass("bg-surface-elevated")` and the refresh removes that class, update the assertion to check structure (`expect(container.querySelector(".group")).toBeInTheDocument()`) or behaviour, not the exact chrome.
- **`teams.primary_color`** is already plumbed through for win-probability charts and predictions. The team-coloured scoring rail in `PlayByPlay` reuses the same source — verify the data is on the play (or on the game) before rendering the rail; if missing, fall back to `bg-accent/40`.
- **The user has stated `tone` / `tierLabel` are no longer rendered** on `GameRatingBadge` — only used for `aria-label`. Don't reintroduce the visible tier text when porting.
