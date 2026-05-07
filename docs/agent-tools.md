# Agent tools

Reference for the 24 tools available to **Sid** (the chat agent) defined in `backend/src/services/ai/chat/`.

- **Schemas** (OpenAI function definitions): [`chat/toolDefinitions.js`](../backend/src/services/ai/chat/toolDefinitions.js)
- **Dispatch** (name → handler): [`chat/toolsService.js`](../backend/src/services/ai/chat/toolsService.js)
- **Implementations**: [`chat/tools/`](../backend/src/services/ai/chat/tools/)
- **Prompt routing rules** (which question → which tool): [`chat/agentService.js`](../backend/src/services/ai/chat/agentService.js) `buildSystemPrompt`

> When adding/renaming/removing a tool, update this doc, the count in `chatToolsService.test.js` (`expect(TOOL_DEFINITIONS.length).toBe(N)`), and the prompt routing rules in `agentService.js`.

---

## Conventions

**Season formats** (all leagues store as `games.season` text):
- NBA / NHL: `"YYYY-YY"`, e.g. `"2023-24"`
- NFL: `"YYYY"`, e.g. `"2024"`

**Range-aware tools.** Tools listed in `RANGE_AWARE_TOOLS` (`toolsService.js`) opt out of the auto-fill that injects the current season into `args.season`. They support `seasonStart` / `seasonEnd` for multi-season queries. The auto-fill is also skipped whenever `seasonStart` or `seasonEnd` is present, so explicit ranges work even on non-range-aware tools.

**Data span.**
- Game / stats / plays data: 2015-16 → present for all leagues.
- Awards data goes back further: NBA MVP to 2001-02, NFL MVP to 2003, NHL Hart to 2005-06.
- Streak feed (`streak_events`) is precomputed by the streaks pipeline.
- For events before the database span, the prompt instructs Sid to say "the database doesn't go back that far" — never hallucinate.

**Entity links in responses.** The model emits `[Name](player|team|game:LEAGUE:ID)` sentinels using IDs from tool results. The frontend `MessageBubble` resolves these to React Router routes. Tool results therefore should always include numeric IDs (`player_id`, `team_id`, `game_id`) and league.

---

## Tool catalog

### Resolution / discovery

#### `search`
Fuzzy lookup across players, teams, and games by name. Use first to resolve names → IDs before calling detail tools.
- **Args**: `{ term }`
- **Note**: Does NOT find historical games by performance. Use `find_games` / `get_top_single_game_performances` for that.
- Service: [`services/meta/searchService.js`](../backend/src/services/meta/searchService.js)

#### `get_seasons`
List of seasons available for a league.
- **Args**: `{ league }`
- Service: [`services/meta/seasonsService.js`](../backend/src/services/meta/seasonsService.js)

#### `get_teams`
All teams in a league with IDs, names, conference, division.
- **Args**: `{ league }`
- Service: [`services/teams/teamsService.js`](../backend/src/services/teams/teamsService.js)

---

### Games

#### `get_games`
Recent / upcoming games slate, prioritized live → final → upcoming. Up to 12 results.
- **Args**: `{ league, teamId?, season? }`
- Service: [`services/games/gamesService.js`](../backend/src/services/games/gamesService.js)

#### `get_game_detail`
Full box score for a single game (top 8 players per team to keep payload small). Quarter scores, team records, plays.
- **Args**: `{ league, gameId }`
- Service: [`services/games/gameDetailService.js`](../backend/src/services/games/gameDetailService.js)

#### `find_games`
Game-level analytical search by combined score, margin, OT, date, team.
- **Args**: `{ league, season?, seasonStart?, seasonEnd?, teamId?, minTotal?, maxMargin?, minMargin?, overtime?, dateStart?, dateEnd?, sort?, limit? }`
- **Sort modes**: `total_desc` (default) | `total_asc` | `margin_desc` | `margin_asc` | `date_desc` | `date_asc`
- **Use for**: highest-scoring, biggest blowouts, closest games, OT games, games on a date.
- Tool: [`tools/findGames.js`](../backend/src/services/ai/chat/tools/findGames.js)

#### `get_head_to_head`
Recent head-to-head game history between two teams.
- **Args**: `{ league, teamId1, teamId2, limit? }` (default 10, max 20)
- Tool: [`tools/headToHead.js`](../backend/src/services/ai/chat/tools/headToHead.js)

#### `get_plays`
Search the `plays` table — single-game or cross-game.
- **Args**: `{ league, gameId?, playerName?, teamId?, period?, scoringOnly?, playType?, searchText?, limit? }` (default 30, hard cap 50)
- **Retention caveat**: For Final games, only scoring plays are retained. Cross-game queries (no `gameId`) only include Final games, so they are effectively scoring-only. Live and pre-game games retain all plays. Response includes `retention: 'all' | 'scoring_only'`.
- Tool: [`tools/plays.js`](../backend/src/services/ai/chat/tools/plays.js)

---

### Players

#### `get_player_detail`
**Unified player tool.** Behavior controlled by the `include` array:

| `include` value | Returns |
|---|---|
| `"detail"` (default) | Profile + season averages + last 12 games (auto-fills current season) |
| `"game_log"` | Full per-game log with optional `minStat` / `minValue` filter |
| `"career"` | Per-season summary + career-best games (no season needed) |

Multiple sections compose: `include: ["detail", "career"]` runs both in parallel.

- **Args**: `{ league, playerId, include?, season?, seasonStart?, seasonEnd?, minStat?, minValue?, gameLogLimit? }`
- **`minStat`**: NBA `points|assists|rebounds|steals|blocks|turnovers|minutes`; NFL `yds|td|interceptions`; NHL `g|a|shots|saves|pim`.
- **`gameLogLimit`**: default 30, hard cap 82.
- **To compare two players**: call this tool twice in parallel, lay out side by side. There is no separate comparison tool.
- Tool: [`tools/playerUnified.js`](../backend/src/services/ai/chat/tools/playerUnified.js) (delegates to `playerDetailService`, `tools/playerCareer.js`, `tools/playerGameLog.js`)

#### `get_top_single_game_performances`
Top single-game stat lines for a stat across one or more seasons.
- **Args**: `{ league, stat, seasonStart?, seasonEnd?, minValue?, playerId?, teamId?, limit? }` (default 10, max 25)
- **Stats**: NBA `points|assists|rebounds|steals|blocks|turnovers`; NFL `yds|td|interceptions`; NHL `g|a|shots|saves|pim`.
- **Use for**: "highest-scoring games", "60+ point nights", "career nights".
- **Includes regular + playoff** games.
- Tool: [`tools/topSingleGame.js`](../backend/src/services/ai/chat/tools/topSingleGame.js)

#### `get_stat_leaders`
Top players by per-game average of a stat. Single season or range.
- **Args**: `{ league, stat, season?, seasonStart?, seasonEnd?, limit? }` (default 10, max 50)
- **Stats**: NBA `points|assists|rebounds|steals|blocks|turnovers|minutes`; NFL `yds|td|interceptions`; NHL `g|a|shots|saves|pim`.
- **Min games**: 5 (HAVING clause).
- Tool: [`tools/statLeaders.js`](../backend/src/services/ai/chat/tools/statLeaders.js)

#### `get_similar_players`
Players whose statistical profile is most similar to a given player, via precomputed embeddings.
- **Args**: `{ league, playerId, season?, limit? }` (default 5, max 10)
- **NBA**: filtered by position group. NFL/NHL: filtered by position.
- Backed by `player_stat_embeddings` table (vector(14)). See `ARCHITECTURE.md#player-similarity-engine`.
- Tool: [`tools/similarPlayers.js`](../backend/src/services/ai/chat/tools/similarPlayers.js) → [`services/players/similarPlayersService.js`](../backend/src/services/players/similarPlayersService.js)

#### `get_player_team_history`
Career team timeline derived from per-game `stats.teamid`. Spans of consecutive games on a team.
- **Args**: `{ league, playerId }`
- **Caveat**: Trade dates are inferred (first game with new team), not the official transaction date. Span only covers the database range (back to 2015-16).
- Tool: [`tools/playerTeamHistory.js`](../backend/src/services/ai/chat/tools/playerTeamHistory.js)

#### `get_player_awards`
Awards lookup (MVP, All-NBA, Finals MVP, ROY, DPOY, Vezina, Selke, Calder, NFL MVP, OPOY, etc.).
- **Args**: `{ league?, playerId?, season?, awardType?, limit? }` — at least one filter required.
- **`awardType`** is a substring match against `award_type` codes (e.g. `mvp`, `all_nba`, `vezina`, `cpoy`).
- **Year → season mapping** (handled in prompt): NBA/NHL "2016 MVP" → season `"2015-16"`; NFL "2016 MVP" → `"2016"`.
- **Data span**: NBA MVP back to 2001-02, NFL MVP to 2003, NHL Hart to 2005-06.
- Tool: [`tools/playerAwards.js`](../backend/src/services/ai/chat/tools/playerAwards.js)

#### `get_advanced_stats`
**NBA-only** derived rate stats: TS%, eFG%, 3P%, FT%, FT rate. Computed from raw box scores by parsing `fg`/`threept`/`ft` text columns.
- **Args**: `{ league: "nba", playerId, season?, seasonStart?, seasonEnd? }`
- **Does NOT provide**: VORP, BPM, PER, win shares, RAPM, NHL Corsi/Fenwick, NFL EPA. Schema doesn't store the inputs. Tool returns an explanatory `note` so Sid surfaces this to the user.
- Tool: [`tools/advancedStats.js`](../backend/src/services/ai/chat/tools/advancedStats.js)

#### `get_clutch_performance`
Clutch SCORING plays for a player.
- **Args**: `{ league, playerId, season?, seasonStart?, seasonEnd?, limit? }` (default 50, max 100)
- **Window**: NBA last 5:00 of Q4/OT within 5 pts; NHL last 5:00 of P3/OT within 1 goal; NFL last 5:00 of Q4/OT within 8 pts.
- **CRITICAL caveat**: Final-game plays retain only scoring rows — clutch FG%, missed clutch shots, clutch turnovers, etc. **CANNOT** be computed historically. Tool only returns clutch makes. Filter is name-based (last name in `description`), so namesakes can produce false positives. Caveat is in every response so Sid surfaces it.
- Tool: [`tools/clutchPerformance.js`](../backend/src/services/ai/chat/tools/clutchPerformance.js)

---

### Teams

#### `get_team_stats`
Aggregate offensive stats and W/L record for a team in a season.
- **Args**: `{ league, teamId, season? }`
- Tool: [`tools/teamStats.js`](../backend/src/services/ai/chat/tools/teamStats.js)

#### `get_standings`
Current league standings, grouped by conference, with W/L.
- **Args**: `{ league, season? }`
- Service: [`services/standings/standingsService.js`](../backend/src/services/standings/standingsService.js)

#### `get_playoff_bracket`
Current or projected playoff bracket. Pre-playoffs returns projected matchups from current standings.
- **Args**: `{ league, season? }`
- Tool: [`tools/playoffBracket.js`](../backend/src/services/ai/chat/tools/playoffBracket.js) → wraps `getNbaPlayoffs` / `getNhlPlayoffs` / `getNflPlayoffs`

---

### Streaks & momentum

#### `get_streaks`
Query the precomputed `streak_events` feed (consecutive-games hot streaks for players and teams).
- **Args**: `{ league, subjectType?, subjectId?, statLabel?, activeOnly?, minLength?, limit? }` (default 10, max 25)
- **`subjectType`**: `"player"` or `"team"`.
- **`statLabel`** is a substring match (e.g. `"points"`, `"20+ points"`, `"win"`).
- Sorted by length DESC.
- Tool: [`tools/streaks.js`](../backend/src/services/ai/chat/tools/streaks.js)

---

### Injuries

#### `get_injuries`
Injury report. With `teamId` set, returns one team's injuries with season averages so Sid can reason about production impact. Without `teamId`, returns a league-wide cross-team view sorted by popularity.
- **Args**: `{ league, teamId?, status?, minPopularity?, season?, limit? }`
- **`status`** (league-wide mode): `out|ir|doubtful|questionable|day-to-day|suspended`.
- **`limit`** league-wide: default 25, max 50.
- Backed by `players.status` / `players.status_description` (populated by `ingestion/syncInjuries.js`).
- Tool: [`tools/injuries.js`](../backend/src/services/ai/chat/tools/injuries.js)

#### `get_player_status`
Cheap focused single-player availability check.
- **Args**: `{ league, playerId }`
- Returns `{ status: "active" }` for healthy players, otherwise the injury status row.

---

### External / unstructured

#### `web_search`
Sports news, injury timelines, trade rumors, reporter context. Always check `publishedDate` and prefer the most recent results.
- **Args**: `{ query }`
- **Use sparingly.** For roster/stat/record questions, prefer structured tools.
- Tool: [`tools/webSearch.js`](../backend/src/services/ai/chat/tools/webSearch.js)

#### `semantic_search`
Cosine similarity search over AI game summaries (`game_embeddings`, 1536-dim `text-embedding-3-small`).
- **Args**: `{ query, limit? }` (default 5, max 10)
- **ONLY for narrative/vibe queries** that structured tools can't answer ("dramatic comebacks", "overtime thrillers"). Never for records, leaders, game IDs, or single-game performances.
- Tool: [`tools/semanticSearch.js`](../backend/src/services/ai/chat/tools/semanticSearch.js)

---

## Status labels (UI)

When a tool runs, the agent emits an SSE `status` event. The label is mapped in `agentService.js#TOOL_STATUS_LABELS`. Add an entry there for any new tool so the chat UI shows friendly progress text instead of the raw tool name.

## Adding a new tool

1. Create `chat/tools/<name>.js` with the implementation. Read from `pool` directly or wrap an existing service.
2. Register the OpenAI schema in `chat/toolDefinitions.js`. Keep descriptions concrete — list the kinds of questions it answers — since this is what the model uses to choose.
3. Add a `case` in `chat/toolsService.js#executeTool`.
4. If the tool supports multi-season ranges, add the name to `RANGE_AWARE_TOOLS` to opt out of season auto-fill.
5. Add a status label to `TOOL_STATUS_LABELS` in `agentService.js`.
6. Add an explicit routing rule in `buildSystemPrompt` — "for X questions, use `<tool>`" — otherwise the model may fall back to `web_search` or `semantic_search`.
7. Bump `TOOL_DEFINITIONS.length` in `__tests__/services/chatToolsService.test.js`.
8. Mock the new tool file in that same test (the existing tools use `jest.unstable_mockModule` for each tool).
9. Update this doc.
