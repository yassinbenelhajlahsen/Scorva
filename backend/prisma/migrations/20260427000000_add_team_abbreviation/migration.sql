-- Add abbreviation column to teams (e.g. "LAL", "GSW", "BOS").
-- Stored uppercased; index is case-insensitive for safety.
ALTER TABLE teams ADD COLUMN abbreviation VARCHAR(5);
CREATE INDEX idx_teams_abbreviation_lower ON teams (LOWER(abbreviation));
