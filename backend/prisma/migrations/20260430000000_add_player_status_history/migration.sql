-- CreateTable
CREATE TABLE "player_status_history" (
    "id" BIGSERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "league" VARCHAR(10) NOT NULL,
    "prev_status" VARCHAR(20),
    "prev_status_description" TEXT,
    "new_status" VARCHAR(20),
    "new_status_description" TEXT,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_psh_changed_at" ON "player_status_history"("changed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_psh_league_changed" ON "player_status_history"("league", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_psh_player" ON "player_status_history"("player_id");

-- AddForeignKey
ALTER TABLE "player_status_history"
  ADD CONSTRAINT "player_status_history_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "players"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
