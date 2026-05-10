import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import buildSeasonUrl from "../../utils/buildSeasonUrl.js";
import teamUrl from "../../utils/teamUrl.js";
import formatDate from "../../utils/formatDate.js";
import { queryKeys, queryFns } from "../../lib/query.js";
import PlayerStatusBadge from "./PlayerStatusBadge.jsx";
import StreakBadge from "../ui/StreakBadge.jsx";
import PlayerRankings from "./PlayerRankings.jsx";

export default function PlayerHero({
  league,
  name,
  imageUrl,
  team,
  jerseyNumber,
  position,
  height,
  weight,
  dob,
  draftInfo,
  status,
  statusDescription,
  streak,
  showStatus,
  isFavorited,
  onToggleFavorite,
  selectedSeason,
  rankings,
}) {
  const qc = useQueryClient();
  const teamSlug = teamUrl(league, team).split("/").pop();
  const teamHref = buildSeasonUrl(teamUrl(league, team), selectedSeason);
  const accent = team?.primary_color;
  const hasRankings = !!rankings;

  const handleTeamHover = () => {
    if (window.matchMedia?.("(hover: hover)").matches) {
      qc.prefetchQuery({
        queryKey: queryKeys.team(league, teamSlug),
        queryFn: queryFns.team(league, teamSlug),
        staleTime: 10_000,
      });
    }
  };

  const nameBlock = (
    <div className="flex items-center gap-3">
      <h1
        className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary mb-6 md:mb-0"
        style={accent ? { textShadow: `0 0 28px ${accent}33` } : undefined}
      >
        {name}
      </h1>
      <button
        onClick={onToggleFavorite}
        aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
        className="touch-target transition-all duration-200 hover:scale-110 active:scale-95"
      >
        <svg
          className={`w-7 h-7 ${
            isFavorited
              ? "fill-yellow-400 text-yellow-400"
              : "fill-none text-text-tertiary hover:text-yellow-400"
          }`}
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
          />
        </svg>
      </button>
    </div>
  );

  const rowJustify = hasRankings ? "justify-start" : "justify-center md:justify-start";

  const detailsBlock = (
    <div className="flex flex-col gap-3 items-start min-w-0 flex-1">
      {team && (
        <Link
          to={teamHref}
          onMouseEnter={handleTeamHover}
          className="group inline-flex items-center gap-2.5 transition-colors duration-200"
        >
          {team.logoUrl && (
            <img
              src={team.logoUrl}
              alt=""
              className="w-7 h-7 object-contain shrink-0"
            />
          )}
          <span className="text-base font-semibold text-text-primary group-hover:text-accent transition-colors duration-200">
            {team.name}
          </span>
        </Link>
      )}

      <div className={`flex flex-wrap items-center ${rowJustify} gap-x-2 gap-y-1 text-sm text-text-secondary`}>
        {jerseyNumber && (
          <span className="font-semibold text-text-primary tabular-nums">
            #{jerseyNumber}
          </span>
        )}
        {position && (
          <>
            <span aria-hidden className="text-text-tertiary">·</span>
            <span>{position}</span>
          </>
        )}
        {(height || weight) && (
          <>
            <span aria-hidden className="text-text-tertiary">·</span>
            <span>
              {height}
              {height && weight ? " " : ""}
              {weight}
            </span>
          </>
        )}
      </div>

      {(dob || draftInfo) && (
        <div className={`flex flex-wrap items-center ${rowJustify} gap-x-2 gap-y-1 text-xs text-text-tertiary`}>
          {dob && (
            <span>
              <span className="text-text-secondary">{formatDate(dob)}</span>
            </span>
          )}
          {dob && draftInfo && <span aria-hidden>·</span>}
          {draftInfo && (
            <span>
              <span className="text-text-secondary">{draftInfo}</span>
            </span>
          )}
        </div>
      )}

      {showStatus && (status || streak) && (
        <div className="flex flex-col gap-1">
          <div className={`flex flex-wrap items-center ${rowJustify} gap-2`}>
            <PlayerStatusBadge status={status} />
            <StreakBadge streak={streak} />
          </div>
          {statusDescription && (
            <p className="text-xs text-text-secondary leading-snug mt-2">{statusDescription}</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 mb-4 md:mb-0">
      <img
        src={imageUrl || "/images/placeholder.png"}
        alt={name}
        className="w-40 h-40 md:w-48 md:h-48 object-cover rounded-3xl ring-1 ring-white/[0.08] shrink-0"
      />

      {hasRankings ? (
        <div className="flex flex-col w-full md:flex-1 min-w-0 gap-3">
          <div className="flex justify-center md:justify-start">{nameBlock}</div>
          <div className="flex flex-row items-start gap-4 md:gap-6">
            {detailsBlock}
            <div className="shrink-0 w-[140px] sm:w-[170px]">
              <PlayerRankings rankings={rankings} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 items-center md:items-start min-w-0 flex-1">
          <div className="flex items-center gap-3">{nameBlock}</div>
          {team && (
            <Link
              to={teamHref}
              onMouseEnter={handleTeamHover}
              className="group inline-flex items-center gap-2.5 transition-colors duration-200"
            >
              {team.logoUrl && (
                <img src={team.logoUrl} alt="" className="w-7 h-7 object-contain shrink-0" />
              )}
              <span className="text-base font-semibold text-text-primary group-hover:text-accent transition-colors duration-200">
                {team.name}
              </span>
            </Link>
          )}
          <div className={`flex flex-wrap items-center justify-center md:justify-start gap-x-2 gap-y-1 text-sm text-text-secondary`}>
            {jerseyNumber && (
              <span className="font-semibold text-text-primary tabular-nums">#{jerseyNumber}</span>
            )}
            {position && (
              <>
                <span aria-hidden className="text-text-tertiary">·</span>
                <span>{position}</span>
              </>
            )}
            {(height || weight) && (
              <>
                <span aria-hidden className="text-text-tertiary">·</span>
                <span>{height}{height && weight ? " " : ""}{weight}</span>
              </>
            )}
          </div>
          {(dob || draftInfo) && (
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2 gap-y-1 text-xs text-text-tertiary">
              {dob && <span><span className="text-text-secondary">{formatDate(dob)}</span></span>}
              {dob && draftInfo && <span aria-hidden>·</span>}
              {draftInfo && <span><span className="text-text-secondary">{draftInfo}</span></span>}
            </div>
          )}
          {showStatus && (status || streak) && (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <PlayerStatusBadge status={status} />
                <StreakBadge streak={streak} />
              </div>
              {statusDescription && (
                <p className="text-xs text-text-secondary leading-snug">{statusDescription}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
