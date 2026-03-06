-- Drop redundant date-based unique constraints
-- Games will now be deduplicated by eventid + league instead
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_date_teams_league_unique";
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "unique_game_combo";
