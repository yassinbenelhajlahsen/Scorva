-- CreateTable
CREATE TABLE "player_awards" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "league" VARCHAR(10) NOT NULL,
    "season" VARCHAR(10) NOT NULL,
    "award_type" VARCHAR(50) NOT NULL,
    "award_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_awards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_awards_unique" ON "player_awards"("player_id", "league", "season", "award_type");

-- CreateIndex
CREATE INDEX "player_awards_player_idx" ON "player_awards"("player_id");

-- CreateIndex
CREATE INDEX "player_awards_league_season_idx" ON "player_awards"("league", "season");

-- AddForeignKey
ALTER TABLE "player_awards" ADD CONSTRAINT "player_awards_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
