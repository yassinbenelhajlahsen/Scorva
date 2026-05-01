-- AddColumn: ESPN-reported injury report timestamp.
-- Stable across sync cycles; used as the change-detection key in syncInjuries
-- so description-only churn doesn't bump player_status_history.changed_at.
ALTER TABLE "players" ADD COLUMN "status_changed_at" TIMESTAMPTZ;
