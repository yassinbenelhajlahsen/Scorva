CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_favorite_players" (
    "user_id" UUID NOT NULL,
    "player_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "user_favorite_players_pkey" PRIMARY KEY ("user_id","player_id")
);

CREATE TABLE "user_favorite_teams" (
    "user_id" UUID NOT NULL,
    "team_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "user_favorite_teams_pkey" PRIMARY KEY ("user_id","team_id")
);

ALTER TABLE "user_favorite_players" ADD CONSTRAINT "user_favorite_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_favorite_players" ADD CONSTRAINT "user_favorite_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_favorite_teams" ADD CONSTRAINT "user_favorite_teams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_favorite_teams" ADD CONSTRAINT "user_favorite_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
