-- AddColumn: status fields to players
ALTER TABLE "players" ADD COLUMN "status" VARCHAR(20);
ALTER TABLE "players" ADD COLUMN "status_description" TEXT;
ALTER TABLE "players" ADD COLUMN "status_updated_at" TIMESTAMPTZ;

-- AddConstraint: valid status values (NULL = healthy/unknown)
ALTER TABLE "players" ADD CONSTRAINT "players_status_check"
  CHECK ("status" IS NULL OR "status" IN (
    'active','day-to-day','questionable','doubtful','out','ir','suspended'
  ));
