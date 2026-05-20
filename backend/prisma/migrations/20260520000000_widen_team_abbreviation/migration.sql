-- Widen teams.abbreviation from VARCHAR(5) to VARCHAR(10).
-- ESPN occasionally emits longer abbreviations for special-event/placeholder
-- competitors (e.g. TBD playoff slots, international tournaments), which
-- crashed upcoming-games processing with `value too long for type character varying(5)`.
ALTER TABLE teams ALTER COLUMN abbreviation TYPE VARCHAR(10);
