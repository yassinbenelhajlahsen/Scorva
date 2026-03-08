-- Drop unused trigram indexes on teams
DROP INDEX IF EXISTS idx_teams_name_trgm;
DROP INDEX IF EXISTS idx_teams_shortname_trgm;

-- Drop duplicate unique constraints (keeping _unique variants)
DROP INDEX IF EXISTS teams_espnid_league_uniq;
DROP INDEX IF EXISTS players_espn_playerid_league_uniq;

-- Drop single-column eventid unique (composite games_eventid_league_uniq covers upserts)
DROP INDEX IF EXISTS games_eventid_unique;

-- Drop single-column indexes made redundant by composite indexes
DROP INDEX IF EXISTS idx_games_awayteamid;
DROP INDEX IF EXISTS idx_games_hometeamid;

-- Drop stats unique made redundant by primary key on same columns
DROP INDEX IF EXISTS stats_gameid_playerid_unique;
