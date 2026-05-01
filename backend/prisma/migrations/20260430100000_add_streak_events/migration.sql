CREATE TABLE streak_events (
  id              SERIAL PRIMARY KEY,
  league          VARCHAR(10)  NOT NULL,
  subject_type    VARCHAR(10)  NOT NULL CHECK (subject_type IN ('player','team')),
  subject_id      INT          NOT NULL,
  stat_label      VARCHAR(40)  NOT NULL,
  length          INT          NOT NULL,
  start_game_date DATE         NOT NULL,
  last_game_date  DATE         NOT NULL,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  detected_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT streak_events_unique
    UNIQUE (subject_type, subject_id, stat_label, start_game_date)
);

CREATE INDEX streak_events_feed_idx
  ON streak_events (league, last_game_date DESC);

CREATE INDEX streak_events_active_idx
  ON streak_events (league, subject_type, subject_id)
  WHERE is_active = TRUE;
