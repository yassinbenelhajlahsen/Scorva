ALTER TABLE stats ADD COLUMN rating NUMERIC(6,1);

ALTER TABLE plays ADD COLUMN shot_distance_ft SMALLINT;

CREATE TABLE play_participants (
  id              SERIAL PRIMARY KEY,
  play_id         INT NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  player_id       INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL,
  espn_athlete_id VARCHAR(20),
  CONSTRAINT play_participants_unique UNIQUE (play_id, player_id, role)
);
CREATE INDEX play_participants_player_idx ON play_participants(player_id);

CREATE TABLE play_ratings (
  id             SERIAL PRIMARY KEY,
  play_id        INT NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  player_id      INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id        INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  role           VARCHAR(20) NOT NULL,
  base_value     NUMERIC(4,1) NOT NULL,
  wpa_delta      NUMERIC(5,4),
  weighted_value NUMERIC(4,1) NOT NULL,
  CONSTRAINT play_ratings_unique UNIQUE (play_id, player_id, role)
);
CREATE INDEX play_ratings_player_game_idx ON play_ratings(player_id, game_id);
CREATE INDEX play_ratings_game_value_idx  ON play_ratings(game_id, weighted_value DESC);
