-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "games" (
    "id" SERIAL NOT NULL,
    "league" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hometeamid" INTEGER,
    "awayteamid" INTEGER,
    "homescore" INTEGER,
    "awayscore" INTEGER,
    "venue" TEXT,
    "broadcast" TEXT,
    "firstqtr" TEXT,
    "secondqtr" TEXT,
    "thirdqtr" TEXT,
    "fourthqtr" TEXT,
    "ot1" TEXT,
    "ot2" TEXT,
    "ot3" TEXT,
    "ot4" TEXT,
    "status" TEXT,
    "season" TEXT,
    "eventid" INTEGER,
    "winnerid" INTEGER,
    "ai_summary" TEXT,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "teamid" INTEGER,
    "position" TEXT,
    "height" TEXT,
    "image_url" TEXT,
    "jerseynum" INTEGER,
    "weight" TEXT,
    "dob" TEXT,
    "draftinfo" TEXT,
    "league" TEXT NOT NULL,
    "espn_playerid" INTEGER,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stats" (
    "id" SERIAL NOT NULL,
    "gameid" INTEGER NOT NULL,
    "playerid" INTEGER NOT NULL,
    "points" INTEGER,
    "assists" INTEGER,
    "rebounds" INTEGER,
    "blocks" INTEGER,
    "steals" INTEGER,
    "fg" TEXT,
    "threept" TEXT,
    "ft" TEXT,
    "turnovers" INTEGER,
    "plusminus" INTEGER,
    "minutes" INTEGER,
    "yds" INTEGER,
    "sacks" TEXT,
    "td" INTEGER,
    "interceptions" INTEGER,
    "g" INTEGER,
    "a" INTEGER,
    "saves" INTEGER,
    "savepct" TEXT,
    "ga" INTEGER,
    "toi" TEXT,
    "shots" INTEGER,
    "sm" INTEGER,
    "bs" INTEGER,
    "pn" INTEGER,
    "pim" INTEGER,
    "ht" INTEGER,
    "tk" INTEGER,
    "gv" INTEGER,
    "fouls" INTEGER,
    "cmpatt" TEXT,

    CONSTRAINT "stats_pkey" PRIMARY KEY ("gameid","playerid")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "shortname" TEXT,
    "league" TEXT NOT NULL,
    "location" TEXT,
    "logo_url" TEXT,
    "record" TEXT,
    "espnid" INTEGER,
    "homerecord" TEXT,
    "awayrecord" TEXT,
    "conf" TEXT,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "games_eventid_unique" ON "games"("eventid");

-- CreateIndex
CREATE INDEX "games_awayteamid_date_idx" ON "games"("awayteamid", "date");

-- CreateIndex
CREATE INDEX "games_teamid_date_idx" ON "games"("hometeamid", "date");

-- CreateIndex
CREATE INDEX "idx_games_awayteamid" ON "games"("awayteamid");

-- CreateIndex
CREATE INDEX "idx_games_hometeamid" ON "games"("hometeamid");

-- CreateIndex
CREATE UNIQUE INDEX "games_date_teams_league_unique" ON "games"("date", "hometeamid", "awayteamid", "league");

-- CreateIndex
CREATE UNIQUE INDEX "games_eventid_league_uniq" ON "games"("eventid", "league");

-- CreateIndex
CREATE UNIQUE INDEX "unique_game_combo" ON "games"("date", "hometeamid", "awayteamid", "league");

-- CreateIndex
CREATE INDEX "idx_players_name_trgm" ON "players" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "players_teamid_idx" ON "players"("teamid");

-- CreateIndex
CREATE UNIQUE INDEX "players_espn_playerid_league_uniq" ON "players"("espn_playerid", "league");

-- CreateIndex
CREATE UNIQUE INDEX "players_espnid_league_unique" ON "players"("espn_playerid", "league");

-- CreateIndex
CREATE UNIQUE INDEX "stats_gameid_playerid_unique" ON "stats"("gameid", "playerid");

-- CreateIndex
CREATE INDEX "idx_teams_name_trgm" ON "teams" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_teams_shortname_trgm" ON "teams" USING GIN ("shortname" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "teams_espnid_league_uniq" ON "teams"("espnid", "league");

-- CreateIndex
CREATE UNIQUE INDEX "teams_espnid_league_unique" ON "teams"("espnid", "league");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_awayteamid_fkey" FOREIGN KEY ("awayteamid") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_hometeamid_fkey" FOREIGN KEY ("hometeamid") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_teamid_fkey" FOREIGN KEY ("teamid") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stats" ADD CONSTRAINT "stats_gameid_fkey" FOREIGN KEY ("gameid") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stats" ADD CONSTRAINT "stats_playerid_fkey" FOREIGN KEY ("playerid") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
