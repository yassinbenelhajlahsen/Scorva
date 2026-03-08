import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function StatCard({
  stats = [],
  opponent,
  date,
  gameId,
  league,
  isHome,
  opponentLogo,
  result,
  status,
  id,
}) {
  const isFinal = status?.includes("Final");
  const inProgress =
    status?.includes("In Progress") ||
    status?.includes("Halftime") ||
    status?.includes("End of Period");
  if (!stats.length) {
    return (
      <div className="bg-surface-elevated border border-white/[0.08] text-text-primary rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] w-full max-w-3xl p-6 text-center">
        <p className="text-text-tertiary text-sm">No stats available.</p>
      </div>
    );
  }

  const to = `/${league}/games/${gameId}#player-${id}`;

  return (
    <Link to={to} className="group block">
      <div className="relative bg-surface-elevated border border-white/[0.08] p-5 text-center mb-4 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5 hover:z-10 cursor-pointer max-w-sm mx-auto overflow-hidden">

        {/* Game info */}
        {(opponent || date) && (
          <div className="text-text-tertiary text-xs mb-4 text-center flex items-center justify-center gap-2">
            {inProgress && (
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="text-[10px] font-semibold uppercase tracking-widest text-live bg-live/10 px-2 py-0.5 rounded-full"
              >
                Live
              </motion.span>
            )}
            {isFinal && result && (
              <span
                className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  result === "W"
                    ? "text-win bg-win/10"
                    : "text-loss bg-loss/10"
                }`}
              >
                {result}
              </span>
            )}
            <span className="flex items-center gap-1 text-text-secondary text-xs">
              {isHome ? "vs." : "@"}
              {opponentLogo && (
                <img
                  src={opponentLogo}
                  alt={`${opponent} logo`}
                  className="w-4 h-4 object-contain mx-1"
                />
              )}
              {opponent}
              {date && <> · {date}</>}
            </span>
          </div>
        )}

        <ul className="flex flex-wrap justify-center gap-8 max-h-18 group-hover:max-h-[500px] overflow-hidden transition-[max-height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
          {stats.map((stat, i) => (
            <li key={i} className="flex flex-col items-center min-w-[52px]">
              <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-medium">{stat.label}</span>
              <span className="font-semibold text-2xl mt-1 text-text-primary">
                {stat.value}
                {stat.label.includes("%") && "%"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Link>
  );
}
