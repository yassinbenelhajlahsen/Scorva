# Plan: Add Start Time to Scheduled Games

## Goal
Display the kickoff/tip-off time alongside the date for scheduled games.
- **GameCard** center: `Mar 12th @ 3PM` (or `Mar 12th @ 7:30PM` when not on the hour)
- **GamePage** info card: `March 12th, 2026 @ 6PM`
- Time is always shown in **ET (Eastern Time)**, never converted on the frontend.
- Time only appears when game status is `Scheduled` — hidden for live/final games.

---

## Source of Truth

`event.date` from the ESPN scoreboard API is a full ISO timestamp, e.g.:
- `"2025-03-07T23:30:00Z"` → `6:30PM ET`
- `"2025-06-09T00:00Z"` → `8:00PM ET` (EDT in June)

Currently in `eventProcessor.js` (line 306–308), `event.date` is converted via Luxon
to `yyyy-MM-dd` only — the time component is discarded. The `date` DB column is a
PostgreSQL `DATE` type and cannot store time.

---

## Do We Need a New Column?

**Yes.** The existing `date` column is `@db.Date` (no time). Add a new nullable column:

```prisma
start_time  String?   // e.g. "7:30PM ET", null if time unavailable
```

---

## Changes Required

### 1. Prisma Schema — `backend/prisma/schema.prisma`
Add to the `games` model:
```prisma
start_time  String?
```
Then run:
```bash
cd backend && node_modules/.bin/prisma migrate dev --name add-game-start-time
```

### 2. Backend Ingest — `backend/src/populate/src/eventProcessor.js`
After `localDate` is derived from `event.date`, also extract the time:

```js
// Convert UTC timestamp → ET, format as "7:30PM ET" or "7PM ET" (omit :00)
const dt = DateTime.fromISO(rawDate, { zone: "utc" }).setZone("America/New_York");
const hour = dt.hour % 12 || 12;
const minute = dt.minute;
const ampm = dt.hour < 12 ? "AM" : "PM";
const startTime = minute === 0
  ? `${hour}${ampm} ET`
  : `${hour}:${String(minute).padStart(2, "0")}${ampm} ET`;
```

Add `startTime` to `gamePayload`:
```js
const gamePayload = {
  // ...existing fields...
  startTime,
};
```

### 3. Upsert — `backend/src/populate/src/upsertGame.js`
Add `start_time` to the INSERT column list and VALUES, and include it in the
`ON CONFLICT DO UPDATE SET` block.

### 4. Live Sync — `backend/src/populate/liveSync.js` (`upsertGameScoreboard`)
No change needed. `start_time` is set once at ingest and never changes.

### 5. Games Service — `backend/src/services/gamesService.js`
No change needed — the service already selects `g.*` which includes the new column.

### 6. Game Info Service — `backend/src/services/gameInfoService.js`
Add `'startTime', g.start_time` to the `'game'` `json_build_object` in all three
functions: `getNbaGame`, `getNflGame`, `getNhlGame`.

---

## Frontend Changes

### 7. `frontend/src/utilities/formatDate.js`
Add a new exported helper that combines date + optional time:

```js
// Returns e.g. "Mar 12th @ 7:30PM ET" or just "Mar 12th" if no time / not scheduled
export function formatDateShortWithTime(dateInput, startTime) {
  const date = formatDateShort(dateInput);   // reuse existing helper
  if (!startTime) return date;
  return `${date} @ ${startTime}`;
}

// Returns e.g. "March 12th, 2026 @ 7:30PM ET" or just "March 12th, 2026"
export function formatDateWithTime(dateInput, startTime) {
  const date = formatDate(dateInput);        // reuse existing helper
  if (!startTime) return date;
  return `${date} @ ${startTime}`;
}
```

### 8. `frontend/src/components/cards/GameCard.jsx`
In the **center** section (currently line 78), replace:
```jsx
<span className="text-xs text-text-tertiary">
  {formatDateShort(game.date)}
</span>
```
With:
```jsx
<span className="text-xs text-text-tertiary">
  {!isFinal && !inProgress && game.start_time
    ? formatDateShortWithTime(game.date, game.start_time)
    : formatDateShort(game.date)}
</span>
```

### 9. `frontend/src/pages/GamePage.jsx`
On the Date row (currently line 227–228), replace:
```jsx
<span className="text-sm font-medium text-text-primary">{formatDate(game.date)}</span>
```
With:
```jsx
<span className="text-sm font-medium text-text-primary">
  {!isFinal && !inProgress && game.startTime
    ? formatDateWithTime(game.date, game.startTime)
    : formatDate(game.date)}
</span>
```

---

## Data Flow Summary

```
ESPN event.date (ISO UTC)
  → eventProcessor.js: extract ET time string ("7:30PM ET")
  → gamePayload.startTime
  → upsertGame.js: INSERT start_time
  → games.start_time column (String?)
  → gamesService: g.* (auto-included)
  → gameInfoService: 'startTime', g.start_time (added manually)
  → API response
  → GameCard: "Mar 12th @ 7:30PM ET"  (scheduled only)
  → GamePage: "March 12th, 2026 @ 7:30PM ET"  (scheduled only)
```

---

## Edge Cases
- **On-the-hour times**: omit `:00` — show `7PM ET` not `7:00PM ET`
- **Null time**: if `start_time` is null, fall back to date only (no `@`)
- **Live/Final games**: never show `start_time` — time is irrelevant once the game starts
- **Midnight UTC edge**: `00:00Z` is a valid game time (7–8 PM ET depending on DST), not a TBD marker
