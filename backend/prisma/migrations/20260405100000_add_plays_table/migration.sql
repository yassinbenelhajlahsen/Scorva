CREATE TABLE plays (
  id                SERIAL PRIMARY KEY,
  gameid            INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  espn_play_id      TEXT,
  sequence          INT NOT NULL,
  period            INT NOT NULL,
  clock             TEXT,
  description       TEXT NOT NULL,
  short_text        TEXT,
  home_score        INT,
  away_score        INT,
  scoring_play      BOOLEAN NOT NULL DEFAULT FALSE,
  team_id           INT REFERENCES teams(id) ON DELETE SET NULL,
  play_type         TEXT,
  drive_number      INT,
  drive_description TEXT,
  drive_result      TEXT,
  UNIQUE (gameid, sequence)
);

CREATE INDEX idx_plays_gameid_period   ON plays (gameid, period);
CREATE INDEX idx_plays_gameid_scoring  ON plays (gameid, scoring_play);
