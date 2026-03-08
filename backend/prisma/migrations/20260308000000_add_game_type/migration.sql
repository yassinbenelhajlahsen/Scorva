-- AddColumn: type to games
ALTER TABLE "games" ADD COLUMN "type" VARCHAR(20) NOT NULL DEFAULT 'regular';

-- AddConstraint: valid type values
ALTER TABLE "games" ADD CONSTRAINT "games_type_check"
  CHECK ("type" IN ('regular','preseason','playoff','final','makeup','other'));

-- Backfill existing rows from game_label
-- Championships first (most specific)
UPDATE "games" SET "type" = 'final'
  WHERE game_label IS NOT NULL
    AND (LOWER(game_label) LIKE '%nba finals%'
      OR LOWER(game_label) LIKE '%stanley cup%'
      OR LOWER(game_label) LIKE '%super bowl%');

-- Preseason
UPDATE "games" SET "type" = 'preseason'
  WHERE game_label = 'Preseason';

-- Makeup games
UPDATE "games" SET "type" = 'makeup'
  WHERE game_label IS NOT NULL
    AND LOWER(game_label) LIKE '%makeup%'
    AND "type" = 'regular';

-- Catch-all: any remaining non-null label = playoff round
UPDATE "games" SET "type" = 'playoff'
  WHERE game_label IS NOT NULL
    AND "type" = 'regular';
