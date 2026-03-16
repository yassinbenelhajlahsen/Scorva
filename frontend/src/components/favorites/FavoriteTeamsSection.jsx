import { m } from "framer-motion";
import { Link } from "react-router-dom";
import GameCard from "../cards/GameCard.jsx";
import slugify from "../../utilities/slugify.js";
import { itemVariants } from "../../utilities/motion.js";

export default function FavoriteTeamsSection({ teams }) {
  return (
    <div>
      <h2 className="text-xs uppercase tracking-widest text-text-tertiary font-semibold mb-4">Favorite Teams</h2>
      <div className="flex flex-col gap-3">
        {teams.map((team) => (
          <m.div
            key={team.id}
            variants={itemVariants}
            className="w-full bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 flex flex-col sm:flex-row gap-5 items-stretch"
          >
            <Link
              to={`/${team.league}/teams/${slugify(team.name)}`}
              className="flex items-center gap-4 shrink-0 hover:opacity-80 transition-opacity w-full sm:w-52"
            >
              <img
                loading="lazy"
                src={team.logo_url || "/images/placeholder.png"}
                alt={team.name}
                className="w-14 h-14 object-contain"
              />
              <div>
                <p className="text-xs text-text-tertiary">{team.location}</p>
                <p className="text-sm font-semibold text-text-primary">{team.name}</p>
                <p className="text-xs text-text-secondary mt-1">{team.record}</p>
              </div>
            </Link>

            <div className="hidden sm:block w-px bg-white/[0.06] self-stretch shrink-0" />

            <div className="flex flex-wrap gap-3 flex-1 min-w-0 pt-1">
              {team.recentGames.length === 0 ? (
                <p className="text-text-tertiary text-xs self-center">No recent games</p>
              ) : (
                team.recentGames.map((game) => (
                  <div key={game.id} className="flex-1 min-w-[13rem]">
                    <GameCard game={game} />
                  </div>
                ))
              )}
            </div>
          </m.div>
        ))}
      </div>
    </div>
  );
}
