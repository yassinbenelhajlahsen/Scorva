### Card — left rail variant (proposed)

Replaces `bg-surface-elevated + border + shadow` with a colored left rail as the sole visual delimiter. Currently mocked at `/_mocks/cards` (`frontend/src/pages/MockCards.jsx`), not yet ported to production cards.

**Container:**
```
group relative p-5 text-center cursor-pointer
transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]
hover:bg-white/[0.04] hover:-translate-y-0.5
```

**Rail** — rendered as an absolutely-positioned `<div>` (not `border-l`) so it can pulse and brighten independently of the card content.

| Game state | Rail | Notes |
|---|---|---|
| Final · Championship (`type === "final"`) | `w-[3px] bg-accent` (solid) | Thicker, full intensity |
| Playoff (`type === "playoff"`) | `w-[2px] bg-accent/70` → `bg-accent` on hover | |
| Live (`status.includes("In Progress")`) | `w-[2px] bg-live` + `animate-[pulse_2s_ease-in-out_infinite]` | Rail itself pulses |
| Scheduled | `w-[2px] bg-accent/40` → `bg-accent/80` on hover | |
| Final · Regular | `w-[2px] bg-white/15` → `bg-white/30` on hover | |

**StatCard W/L variants** (regular-season only — playoff/finals rail wins):
| State | Rail |
|---|---|
| Win (`result === "W"`) | `w-[2px] bg-win/60` → `bg-win` on hover |
| Loss (`result === "L"`) | `w-[2px] bg-loss/60` → `bg-loss` on hover |

**Atmospheric gradient bleed** — absolutely-positioned overlay, applied only to live and Finals:
- Live: `bg-gradient-to-r from-live/[0.05] to-transparent`
- Finals: `bg-gradient-to-r from-accent/[0.06] to-transparent`

**Championship label** — replaces muted `text-text-tertiary` with `text-accent font-semibold uppercase tracking-[0.15em] text-[11px]`. Flanked by a small trophy SVG (24×24 Phosphor `Trophy` glyph at `w-3 h-3`). Divider above the label switches to `border-accent/30`.

**Series progress dots** (playoff + finals) — two rows of 4 pips at `w-1.5 h-1.5 rounded-full`, filled (`bg-text-primary`) for wins, unfilled (`bg-white/15`) for unplayed. Centered below the game label with a small `vs` separator.

**Score margin** — `+14` appended to the winning team's score in `text-[10px] text-text-tertiary font-medium`, baseline-aligned via `flex items-baseline gap-1`.

**Tabular nums** — applied to all scores, dates, clocks, ratings, and quarter breakdowns for column alignment.

**Date group headers** (for feed contexts) — `text-[10px] uppercase tracking-[0.22em] text-text-secondary font-semibold` with optional right-aligned game count in `text-text-tertiary tabular-nums`.

**Rating placement** (when `game.grade != null`):

| Card | Placement | Reason |
|---|---|---|
| **GameCard** | Inside the **center column**, between date and "Final" label (`text-2xl` accent value + tiny "Rating" kicker) | The card already has a center column between the two team blocks — rating fits naturally there. A right column would break the symmetric three-column grid (home / center / away). |
| **StatCard** | Dedicated **right-side column** (`text-3xl` accent value + "Rating" label) | StatCard has no center column to insert into. The stat values + opponent header sit in a single content block; the right column adds visual weight without disturbing the layout. |

**Common rating values** (both cards):
```
Grade:  font-bold tabular-nums leading-none
        text-accent   (positive grade)
        text-loss     (negative grade)
Label:  uppercase tracking-widest text-text-tertiary font-medium  →  "Rating"
```

**GameCard center column (final games only):**
```jsx
<div className="flex flex-col items-center justify-center flex-shrink-0 w-[90px] gap-0.5 h-full overflow-hidden">
  <span className="text-xs text-text-tertiary tabular-nums">{date}</span>
  {isFinal && game.grade != null && (
    <div className="flex flex-col items-center mt-1">
      <span className="font-bold text-2xl tabular-nums leading-none text-accent">{grade.toFixed(1)}</span>
      <span className="text-[8px] uppercase tracking-widest text-text-tertiary mt-0.5 font-medium">Rating</span>
    </div>
  )}
  {/* Live / clock / status as before */}
</div>
```

**StatCard right column:**
```jsx
<div className="relative flex items-stretch">
  <div className="flex-1 min-w-0 p-5 text-center">{/* opponent header + stats + playoff label */}</div>
  <div className="shrink-0 px-3.5 py-3 flex flex-col items-center justify-center">
    <span className="text-accent font-bold text-3xl tabular-nums leading-none">{grade.toFixed(1)}</span>
    <span className="text-[9px] uppercase tracking-widest text-text-tertiary mt-1.5 font-medium">Rating</span>
  </div>
</div>
```

The StatCard right column auto-stretches with the card height (`items-stretch`), so playoff footer growth keeps the rating centered in the taller container.

When porting GameCard, remove the `<div className="absolute top-3 right-3 z-10"><GameRatingPill .../></div>` block and inline the rating into the center column instead. The `GameRatingPill` file can then be deleted.

**Mobile breakdown chevron — kept.** The hover-driven quarter-breakdown expand only fires on hover-capable devices. The `<button>` at the bottom of `GameCard` (mobile-only, hidden via `[@media(hover:hover)]:!hidden`) is the touch fallback. Production keeps it.

---

## Pattern application — by component shape

The left-rail aesthetic adapts to four card shapes. Each shape gets a different chrome strategy:

| Shape | Examples | Strategy |
|---|---|---|
| **List-item card** | GameCard, StatCard, RosterCard | Left rail = state delimiter; brightens on hover |
| **List container** | SimilarPlayersCard | Container chrome removed; rows get rail-on-hover |
| **Sectioned list** | PlayerAwardsCard | Container chrome removed; internal sections may use a rail to elevate (e.g. Legendary) |
| **Hero/standalone** | PlayerAvgCard | No rail. Top accent stripe + atmospheric gradient + accent heading |

## PlayerAvgCard (proposed)

Hero/standalone card on PlayerPage. Rail doesn't fit — it's not a list item. Uses a **top accent stripe** + downward atmospheric gradient as the visual anchor.

**Container:**
```
relative overflow-hidden rounded-2xl w-full
```
(no `bg-surface-elevated`, no border, no shadow)

**Top accent stripe** — absolutely-positioned full-width strip at the top edge:
```
absolute top-0 left-0 right-0 h-[2px] bg-accent/60
```

**Atmospheric gradient** — downward fade from accent at the top, dissipating to transparent:
```
absolute inset-0 bg-gradient-to-b from-accent/[0.06] via-transparent to-transparent pointer-events-none
```

**Header text** — `text-accent text-[11px] uppercase tracking-[0.22em] font-semibold text-center pt-4 pb-3 border-b border-white/[0.05]`. Replaces the existing `bg-accent/10` fill block — the stripe + gradient carry the accent weight.

**Stat row** — same layout as current (`flex-wrap gap-y-6 justify-around`) but values bumped to `text-4xl` (from `text-3xl sm:text-4xl`) since the chrome reduction gives them more room to breathe. `tabular-nums` on all values.

## SimilarPlayersCard (proposed)

List container. Container chrome removed entirely — the section heading is the only structural marker.

**Container:**
```
w-full max-w-sm
```
(no card chrome)

**Section heading:**
```
text-[11px] font-semibold uppercase tracking-[0.22em] text-text-tertiary mb-3 pl-3
```
(matches the rail offset)

**Row** — each player link:
```
group relative flex items-center gap-3 pl-3 pr-3 py-3
transition-colors duration-200
hover:bg-white/[0.03]
border-b border-white/[0.04]   /* except last */
```

**Per-row rail-on-hover** — absolutely-positioned, transparent at rest, accent on hover:
```
absolute left-0 top-0 bottom-0 w-[2px] bg-transparent
group-hover:bg-accent transition-colors duration-200
```

**Name color shift** — `group-hover:text-accent transition-colors duration-150` (kept from current).

**Avatar** — `bg-surface-overlay/40 border border-white/[0.06]` (was `bg-surface-overlay border` — softened to match reduced-chrome aesthetic).

## PlayerAwardsCard (proposed)

Sectioned list. Container chrome removed; the **Legendary** section gets a left accent rail to elevate it above Major / Selections.

**Container:**
```
w-full max-w-2xl
```
(no card chrome)

**Top heading** — `text-[11px] uppercase tracking-[0.22em] text-text-tertiary mb-6 pl-3 font-semibold` (matches rail offset).

**Section structure:**
```
relative
  ↳ if Legendary: pl-4 + accent rail absolute at left
  ↳ otherwise: no offset, no rail
```

**Legendary accent rail** — visually elevates the section:
```
absolute left-0 top-1 bottom-1 w-[2px] bg-accent rounded-full
```

**Section title** — accent-colored when Legendary, tertiary otherwise:
```
text-[10px] uppercase tracking-[0.18em] mb-3 font-semibold
text-accent (Legendary) | text-text-tertiary (others)
```

**Award rows** — unchanged: `border-b border-white/[0.06] last:border-b-0`, three columns (label · years · count). Tier styles (`legendary` / `major` / `selection`) unchanged.

Expandable row interactivity (for awards with `count > 4`) is preserved as-is from the current implementation; only the container chrome changes.

## RosterGrid / RosterCard (proposed)

Card grid. The oversized jersey-number background is the existing visual anchor — keep it. Strip the heavy chrome and add a subtle rail-on-hover.

**Card outer:**
```
group relative block overflow-hidden rounded-2xl
transition-all duration-[300ms] ease-[cubic-bezier(0.22,1,0.36,1)]
hover:bg-white/[0.04] hover:-translate-y-1 cursor-pointer
```
(removed: `bg-surface-elevated`, `border border-white/[0.08]`, both shadow layers. `rounded-2xl` stays — it's needed to clip the jersey number.)

**Rail** — very subtle at rest, accent on hover:
```
absolute left-0 top-0 bottom-0 w-[2px] bg-white/[0.06]
group-hover:bg-accent transition-colors duration-200
```

**Jersey number background** — unchanged. Already uses `text-white/[0.04] group-hover:text-accent/[0.14]` which fits the refresh aesthetic.

**Avatar ring** — softened: `ring-1 ring-white/[0.06] group-hover:ring-accent/30` (was `group-hover:ring-white/[0.18]`). Avatar bg changed to `bg-surface-overlay/40` for consistency with SimilarPlayersCard.

**Position pill** — `bg-white/[0.05] ring-1 ring-white/[0.06]` (was `bg-white/[0.05] border border-white/[0.06]` — using `ring` for consistency).

**Stat row footer** — unchanged: `border-t border-white/[0.05]`, three or four stats depending on league.

---

## GamePage components

Components on `frontend/src/pages/GamePage.jsx`. The page renders top-to-bottom: matchup header → info strip → tab bar → tab content. The refresh strategy varies by element type — see the **Pattern application** table above for the rule.

### GameMatchupHeader (proposed)

Not a card — it's a layout block at the top of the page. Strategy: light-touch refresh focused on the playoff/Finals visual language, plus a subtle accent wrap for championship games.

**Outer wrapper:**
```
relative overflow-hidden rounded-2xl mb-10
```
For Finals only — atmospheric gradient wraps the entire header:
```
absolute inset-0 bg-gradient-to-b from-accent/[0.04] to-transparent pointer-events-none
```

**Center column changes:**
- **Game label** — for Finals, switch to `text-accent font-semibold uppercase tracking-[0.18em] text-[11px]` and flank with TrophyIcon (`w-3 h-3`). Regular playoff label stays at `text-sm font-medium text-text-secondary`.
- **Series score** — replace text-based "Lakers lead 3-1" with `<SeriesDots>` (two rows of 4 pips, see GameCard spec).
- Live pill + clock — unchanged.

**Left/right columns** (team logos, names, scores) — unchanged. They already work without card chrome.

### GameInfoCard (proposed)

Metadata strip. Drop the card chrome entirely; use a left accent rail + hairline-separated rows.

**Container:**
```
relative pl-4 mb-6
```
(removed: `bg-surface-elevated`, `border border-white/[0.08]`, `rounded-2xl`, `shadow-[0_4px_20px_rgba(0,0,0,0.3)]`)

**Left rail:**
```
absolute left-0 top-0 bottom-0 w-[2px] bg-accent/40 rounded-full
```

**Rows:**
```
flex items-center justify-between gap-4 py-3
border-b border-white/[0.05]   /* except last */
```

**Label** — tightened: `text-[10px] uppercase tracking-[0.18em] text-text-tertiary font-semibold` (was `text-xs uppercase tracking-wider`).

**Value** — unchanged: `text-sm font-medium text-text-primary text-right`.

### GameTabBar (no change required)

Already minimal and fits the refresh language: animated `bg-accent` underline indicator + `text-accent` active state + `text-text-secondary hover:text-text-primary` inactive. No chrome to remove. **Leave as-is.**

Optional: bump indicator from `h-0.5` to `h-[2px]` for a slightly bolder accent — but not required.

### GameRatingCard

**Deleted.** Production refactor `12ddeba` removed `GameRatingCard.jsx` and moved the game-level rating into a compact **`GameRatingBadge`** pill inside `GameMatchupHeader` (above the playoff logo in the center column), and surfaced team-level grades as a new **`★ RATING`** row at the top of `TeamComparison`'s stat list. See those two component sections for the refreshed treatments.

### GameRatingBadge (inside GameMatchupHeader, proposed)

Compact pill rendered above the playoff logo in the matchup header's center column.

**Pill:**
```
inline-flex items-center gap-2 px-3 py-1 rounded-full
bg-white/[0.04] ring-1 ring-white/[0.08]
```
(was `bg-surface-overlay border border-white/[0.1]` — swapped `border` → `ring` for refresh consistency, lightened bg)

**Content:** `★` (text-xs font-bold text-accent) + grade (text-sm font-bold tabular-nums, text-text-primary or text-loss for negative). The visible tier label was removed from production — `rating.tierLabel` is now only referenced in the `aria-label` for screen readers, not rendered. Mock matches.

`mockGameRating` in the mock still carries a `tierLabel` field so the data shape stays canonical, but nothing renders it.

### TeamComparison — RATING row (proposed)

When `homeRating` and `awayRating` are both provided (from the game's `gameRating.home.grade` / `gameRating.away.grade`), prepend a `★ RATING` row to the top of the comparison stat list (above PTS/FG%/REB/etc).

**Row** — same `StatRow` shape used for season averages, but the values are game-specific team grades (tabular `.toFixed(1)`). Lower-is-better = false.

**Separator** — hairline `border-t border-white/[0.06] mt-2 mb-1` below the rating row to visually distinguish "this game" stats from the "season averages" rows that follow.

### Quarter scoreboard (proposed)

Inline data table inside `OverviewTab.jsx`. Drop the card chrome; let the table's own hairline structure do the work.

**Container:**
```
relative mb-6
```
(removed: `bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]`)

**Header row** — strengthened bottom border from `border-white/[0.06]` to `border-white/[0.08]` so the table "starts" without the card edge.

**Internal hairlines** — unchanged: `border-t border-white/[0.04]` between home/away rows.

**Tabular nums** — explicitly applied to all quarter and total cells (kept on totals, added to quarter cells).

Tracking on the header labels bumped from `tracking-widest` to `tracking-[0.18em]` for consistency with other refresh kickers.

### Prediction Locked stripe (proposed)

Edge-case status card in `OverviewTab.jsx` (pre-game, prior playoff series game still pending). Keep the existing diagonal stripe pattern + radial glow — those ARE the atmosphere. Drop the bg-elevated chrome and add a left accent rail.

**Container:**
```
relative overflow-hidden rounded-2xl mb-6
```
(removed: `bg-surface-elevated border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.3)]`)

**Left rail (new):**
```
absolute left-0 top-0 bottom-0 w-[2px] bg-accent/60
```

**Diagonal stripe pattern** — unchanged (`repeating-linear-gradient(135deg, ...)` at `opacity-[0.05]`, was `0.06` — dropped slightly because no surface bg means stripes show on darker base).

**Radial glow** — unchanged.

**Icon container + heading + body text** — unchanged. The icon container keeps its `bg-accent/10 border border-accent/25` — its tiny scale means the inner border still reads as intentional, not chrome.

---

## GamePage tab content

Components inside `OverviewTab`, `AnalysisTab`, `PlaysTab`. The refresh strategy varies by element shape — see the **Pattern application** table at the top.

### TopPerformerCard (proposed)

List-item card used in a grid of 3 on OverviewTab (Top Performer / Top Scorer / Impact Player). The colored gradient slab on the left **is already the rail** — keep it. Drop only the outer chrome.

**Card outer:**
```
group relative flex items-stretch h-[108px] rounded-2xl overflow-hidden
transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]
hover:bg-white/[0.04] hover:-translate-y-0.5 cursor-pointer w-full
```
(removed: `bg-surface-elevated`, `border border-white/[0.08]`, `hover:bg-surface-overlay hover:border-white/[0.14]`)

**Gradient slab (the rail)** — unchanged:
```
width: 88px
background: linear-gradient(150deg, ${color}1f 0%, ${color}0a 100%)
borderRight: 1px solid ${color}26
```

**Rating column divider** — remove `border-l border-white/[0.08]` between the info zone and the rating column. The accent-colored rating numeral has enough weight on its own.

### PredictionCard (proposed)

Pre-game hero card. Drops the card chrome but **keeps the radial glow** (favored-team color, blurred) — that glow IS the atmosphere.

**Card container:**
```
relative overflow-hidden rounded-2xl
```
(removed: `bg-surface-elevated border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.35)]`)

**Top accent stripe** (new):
```
absolute top-0 left-0 right-0 h-[2px] bg-accent/60
```

**Radial glow** — unchanged. Positioned `-top-16 [side]: -3rem`, `blur-3xl opacity-25`, `radial-gradient(circle, ${favoredColor} 0%, transparent 70%)`.

**Section headers** (Injuries, Stats, Key Factors) — bumped from `text-[10px] uppercase tracking-wider` to `tracking-[0.18em]` for consistency with other refresh kickers. Hairline above each section unchanged (`border-t border-white/[0.06] pt-4`).

**Confidence pill** — swap `border border-white/[0.08]` to `ring-1 ring-white/[0.08]` for ring/pill consistency across the refresh.

### TeamComparison (proposed)

Hero/sectioned comparison card. Top accent stripe + atmospheric gradient.

**Container:**
```
relative overflow-hidden rounded-2xl mt-6 w-full
```
(removed: `bg-surface-elevated border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.35)]`)

**Top stripe** + **gradient** — same as GameRatingCard / PlayerAvgCard pattern (`bg-accent/60` + `from-accent/[0.04]`).

**Header restructure** — split into a small kicker + larger title:
```
text-[11px] uppercase tracking-[0.22em] text-text-tertiary  →  "Team Comparison"
text-2xl font-bold tracking-tight text-text-primary mt-1   →  "Season Averages"
```

**Team header strip** — `border-y border-white/[0.06]` (top + bottom) instead of single `border-b`. Visually anchors the section break.

**Section dividers between stat groups** — unchanged.

### BoxScore (proposed)

Data table — one per team. Drop the card chrome; let the table structure carry the layout.

**Container (per team):**
```
w-full
```
(removed: `bg-surface-elevated border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.35)] flex flex-col h-full`)

**Header row** — drop `px-5 py-4 border-b border-white/[0.06]`; use a single bottom hairline `pb-3 mb-2 border-b border-white/[0.08]` (stronger than internal table hairlines so the header reads as a section anchor).

**Sort pill** — keep accent ring/bg: `bg-accent/10 ring-1 ring-accent/20 text-accent` (was `border` → `ring`).

**Table** — internal `<thead>` / `<tbody>` structure unchanged. Each `<tr>` gets `border-b border-white/[0.03]` + `hover:bg-white/[0.02]`.

**Sort-active column tint** — the currently-sorted column's header stays `text-accent` (kept from current). The mock shows `PTS` as the default sort.

### PlayByPlay (proposed)

List of plays. Drop the outer card chrome on the play list. Scoring plays get a **team-colored left rail** instead of the current full-bg highlight — much lighter touch.

**Section header (icon + title)** — unchanged.

**Filter pills** — keep their pill chrome (form elements): `bg-white/[0.03] ring-1 ring-white/[0.06]` for inactive (was `border`), `bg-accent/15 ring-1 ring-accent/25 text-accent` for active. Use `ring` everywhere instead of `border` for consistency.

**Search input** — same: `bg-white/[0.03] ring-1 ring-white/[0.06]`.

**Play list container:**
```
relative
```
(removed: `bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] overflow-hidden`)

**Per-play row:**
```
relative flex items-start gap-3 py-3 pl-4 pr-3
transition-colors duration-150
hover:bg-white/[0.02]
border-b border-white/[0.04]   /* except last */
```

**Scoring play accent** — replaces the full-width tinted bg with a **team-colored left rail** (`absolute left-0 top-0 bottom-0 w-[2px]`) + a very faint bg tint (`bg-white/[0.015]`). The rail signals "scoring", the team color tells you which team scored, and it doesn't overpower the surrounding plays.

**Suggestion dropdown** — keep its own chrome (`bg-surface-elevated ring-1 ring-white/[0.08] shadow-[0_8px_24px_rgba(0,0,0,0.4)]`). It's a floating overlay, not a card on the page; it needs its own elevation to read correctly.

### AISummary (proposed)

Narrative/AI-generated content block. Apply the left accent rail + atmospheric gradient (similar to status stripes).

**Card container:**
```
relative overflow-hidden rounded-2xl pl-5
```
(removed: `bg-surface-elevated border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.35)]`)

**Left rail (new):**
```
absolute left-0 top-0 bottom-0 w-[2px] bg-accent/60
```

**Atmospheric gradient (new):**
```
absolute inset-0 bg-gradient-to-r from-accent/[0.04] via-transparent to-transparent pointer-events-none
```

**Header (icon + title + subtitle)** — unchanged.

**Bullet list** — unchanged. Each bullet keeps the `w-1.5 h-1.5 bg-accent rounded-full` mark.

**Footer** — drop `bg-surface-base/40`; keep `border-t border-white/[0.05]` as the only structural break for the "Generated using AI..." tagline.

**Locked / sign-in variant** — same chrome removal. Gradient curtain over ghost rows still works because the underlying card has no fill.

### GameChart / WinProbabilityChart (proposed)

Chart card on OverviewTab. Hero treatment with top stripe + atmospheric gradient.

**Container:**
```
relative overflow-hidden rounded-2xl mb-10
```
(removed: `bg-surface-elevated border border-white/[0.08] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]`)

**Top stripe** + **atmospheric gradient** — same accent treatment as GameRatingCard.

**View-mode select dropdown** — keep its own chrome (form element): swap `border` → `ring`, use `bg-white/[0.03] ring-1 ring-white/[0.08]` for the trigger and `bg-surface-primary` for the option list.

**Team legend** (new, optional) — small inline legend in the header right showing team-color dots + abbreviations. Helps when the chart loses the surface elevation.

**Chart axes + lines** — unchanged. The recharts render stays as-is; only the surrounding container changes.

---

## Reports (player & team activity feed)

`frontend/src/components/reports/` — used on Homepage / Pulse / TeamPage Highlights. A `ReportsList` container wraps `ReportRow` dispatchers that pick between four row variants: `InjuryReportRow`, `MoveReportRow`, `BirthdayReportRow`, `StreakReportRow`. Avatar atoms (`PlayerAvatar`, team logos, `NRBadge`) appear inside the rows.

### ReportsList (proposed)

List container with optional date grouping. Classic "list container" pattern — drop the chrome, hairline-divide the rows.

**Container (flat):**
```
flex flex-col divide-y divide-white/[0.04]
```
(was `rounded-2xl overflow-hidden bg-surface-elevated border border-white/[0.08] divide-y divide-white/[0.04]` — drop the `rounded-2xl`, `bg-surface-elevated`, `border`)

**Container (date-grouped):** wrap each group in a `<div>` with the group header above and the flat list below. Outer `space-y-4` between groups.

**Date group header** — matches the GameCard feed header pattern:
```
flex items-baseline justify-between pl-4 pr-3 pb-1.5
  ↳ h3: text-[10px] uppercase tracking-[0.22em] text-text-secondary font-semibold
  ↳ span (count): text-[10px] text-text-tertiary tabular-nums  →  "N updates"
```
(was `text-xs uppercase tracking-widest text-text-tertiary font-semibold px-1 mb-2` — tightened to match the other refresh date headers, plus added optional update count.)

### ReportRow chrome (shared by all 4 variants)

All four row types use the same outer wrapper. Refactor the shared chrome out so changes propagate.

**Row outer:**
```
group relative flex items-start gap-3 pl-4 pr-3 py-3
transition-colors duration-200
hover:bg-white/[0.03]
```
(was `flex items-start gap-3 px-3.5 py-3 hover:bg-surface-overlay` — softened hover from full surface-overlay to a subtle white tint, added `pl-4` to clear the hover rail)

**Hover rail (new):**
```
absolute left-0 top-0 bottom-0 w-[2px] bg-transparent
group-hover:bg-accent transition-colors duration-200
```

**Right-aligned timestamp** — unchanged: `text-xs text-text-tertiary shrink-0`.

### Avatar atoms — PlayerAvatar, team logos, NRBadge

All three currently use `bg-surface-overlay border border-white/[0.08]`. Refresh:
```
bg-surface-overlay/40 ring-1 ring-white/[0.06]
```
(consistent with the avatar treatment in SimilarPlayersCard, RosterCard — `ring` over `border`, softened bg)

Sizes unchanged: 9×9 for PlayerAvatar / TeamLogo, 6×6 for NRBadge and the inline team logos in MoveReportRow.

### Per-variant notes

- **InjuryReportRow** — status pill cascade (`prev → new`) unchanged. STATUS_CLASS colors (text-win / text-loss / text-accent) already on-pattern.
- **MoveReportRow** — `from → to` team logos inline. Drop `border border-white/[0.08]` on logos → `ring-1 ring-white/[0.06]`. Action label unchanged.
- **BirthdayReportRow** — minimal, ordinal age + 🎉. No chrome to change.
- **StreakReportRow** — team OR player subject, same row shape. Drop `border border-white/[0.08]` on the team-logo fallback initials div → `ring-1 ring-white/[0.06]`.

### Skeleton state

`ReportRowSkeleton` inside the existing `ReportsList` loading branch — drop the same container chrome (`bg-surface-elevated border + rounded-2xl`). Skeletons sit directly in a `divide-y` container, matching the loaded state's layout 1:1.

## Form elements inside refreshed cards

Filter pills, search inputs, select dropdowns, sort buttons — these are **interactive controls**, not cards. Keep their pill/ring chrome so they remain affordant:
- Use `ring-1 ring-white/[0.06]` (or `ring-accent/25` for active) instead of `border` everywhere — consistent visual weight, no layout shift.
- Backgrounds: `bg-white/[0.03]` at rest, `bg-white/[0.06]` on hover, `bg-accent/15` when active.
- This is the **only** place chrome stays in the refresh — controls earn it because they need to read as tap targets.

## Implementation order (when porting)

1. `GameCard` + `StatCard` — list-item rail pattern (biggest visual impact, in feeds everywhere).
2. `RosterCard` — same list-item rail pattern, smaller chrome delta.
3. `SimilarPlayersCard` — container chrome removal, row rails.
4. `PlayerAwardsCard` — container chrome removal, Legendary rail.
5. `PlayerAvgCard` — top stripe / gradient (one-off treatment, isolated to PlayerPage).
6. `GameMatchupHeader` + `GameInfoCard` + Quarter scoreboard — GamePage top-of-page refresh, ports together (visible on every game detail view).
7. Prediction Locked stripe — secondary GamePage card inside OverviewTab. (GameRatingCard was deleted — rating moved into `GameMatchupHeader` + `TeamComparison`, no separate port needed.)
8. `GameTabBar` — no change required; verify after surrounding components ship.
9. `TopPerformerCard` — list-item, smallest delta (slab stays, just drop outer chrome).
10. `PredictionCard` + `TeamComparison` + `GameChart` — OverviewTab hero cards. Top stripe + atmospheric gradient.
11. `BoxScore` — AnalysisTab data table. Chrome removal + sort pill ring conversion.
12. `PlayByPlay` — PlaysTab list. Container chrome removal + team-color scoring rail. Convert filter pills/search to ring chrome.
13. `AISummary` — left rail + atmospheric gradient.
14. `ReportsList` + 4 `ReportRow` variants — list container chrome removal, hover rail on rows, ring/softened-bg on avatar atoms. Used on Homepage / Pulse / TeamPage Highlights.

After porting, the `Card` and `Card hover` blocks at the top of `docs/DESIGN.md` should be replaced with this pattern, and this file (`docs/refresh-design.md`) deleted or marked historical.
