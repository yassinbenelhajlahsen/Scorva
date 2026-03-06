-- Drop redundant date-based unique constraints
-- Games will now be deduplicated by eventid + league instead
DROP INDEX IF EXISTS "games_date_teams_league_unique";
DROP INDEX IF EXISTS "unique_game_combo";

-- Keep the eventid-based constraint which prevents timezone-related duplicates
-- @@unique([eventid, league], map: "games_eventid_league_uniq") is already present
