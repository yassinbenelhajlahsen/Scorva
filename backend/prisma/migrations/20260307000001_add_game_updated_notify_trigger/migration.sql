-- Create trigger function to notify SSE clients when a game row is updated
CREATE OR REPLACE FUNCTION notify_game_updated()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('game_updated', COALESCE(NEW.eventid::text, '0'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to games table (fires after any UPDATE)
DROP TRIGGER IF EXISTS game_updated_trigger ON games;
CREATE TRIGGER game_updated_trigger
  AFTER UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION notify_game_updated();
