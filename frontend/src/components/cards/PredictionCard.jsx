import { useState } from "react";
import { m } from "framer-motion";
import { Link } from "react-router-dom";
import PlayerStatusBadge from "../player/PlayerStatusBadge.jsx";
import slugify from "../../utils/slugify.js";

const DEFAULT_HOME_COLOR = "#e8863a";
const DEFAULT_AWAY_COLOR = "#60A5FA";

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function colorDistance(a, b) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function relativeLuminance(hex) {
  return hexToRgb(hex)
    .map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}

function resolveColors(rawHome, rawAway) {
  const DARK_THRESHOLD = 0.04;
  const home = rawHome ?? DEFAULT_HOME_COLOR;
  const away = rawAway ?? DEFAULT_AWAY_COLOR;
  const resolvedHome =
    relativeLuminance(home) < DARK_THRESHOLD ? "#ffffff" : home;
  const resolvedAway =
    relativeLuminance(away) < DARK_THRESHOLD ? "#ffffff" : away;
  if (colorDistance(resolvedHome, resolvedAway) < 60) {
    return [DEFAULT_HOME_COLOR, DEFAULT_AWAY_COLOR];
  }
  return [resolvedHome, resolvedAway];
}

// Icons for key factor types
function FactorIcon({ type }) {
  const cls = "w-3.5 h-3.5 flex-shrink-0";
  if (type === "home") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    );
  }
  if (type === "offense") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 2v11h3v9l7-12h-4l4-8z" />
      </svg>
    );
  }
  if (type === "defense") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
      </svg>
    );
  }
  if (type === "form") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
      </svg>
    );
  }
  if (type === "h2h") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
      </svg>
    );
  }
  if (type === "record") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.28 5 8zm14 0c0 1.28-.84 2.4-2 2.82V7h2v1z" />
      </svg>
    );
  }
  if (type === "injury") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 8h-3V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H5c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h3v3c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2v-3h3c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2z" />
      </svg>
    );
  }
  return null;
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PlayerAvatar({ imageUrl, name }) {
  const [errored, setErrored] = useState(false);
  const showImage = imageUrl && !errored;
  return (
    <div className="w-7 h-7 rounded-full bg-surface-overlay ring-1 ring-white/[0.08] flex items-center justify-center overflow-hidden flex-shrink-0">
      {showImage ? (
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <span className="text-[9px] font-semibold text-text-secondary tracking-wide">
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}

function InjuryList({ injuries, league }) {
  if (!injuries?.players?.length) {
    return <p className="text-[11px] text-text-tertiary italic">No injuries reported</p>;
  }
  const players = injuries.players.slice(0, 3);
  const overflow = injuries.players.length - players.length;
  return (
    <div className="flex flex-col gap-1">
      {players.map((p) => (
        <Link
          key={p.id}
          to={`/${league}/players/${slugify(p.name)}`}
          className="flex items-center gap-2 min-w-0 px-1.5 py-1 -mx-1.5 rounded-lg hover:bg-white/[0.04] transition-colors group"
        >
          <PlayerAvatar imageUrl={p.imageUrl} name={p.name} />
          <span className="text-xs font-medium text-text-primary truncate flex-1 min-w-0 group-hover:text-accent transition-colors">
            {p.name}
          </span>
          <PlayerStatusBadge
            status={p.status}
            size="sm"
            title={p.statusDescription || undefined}
          />
        </Link>
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-text-tertiary px-1.5">
          +{overflow} more
        </span>
      )}
    </div>
  );
}

function FormDots({ form, color }) {
  return (
    <div className="flex items-center gap-1">
      {form.map((win, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full"
          style={{
            background: win ? color : "rgba(255,255,255,0.15)",
            boxShadow: win ? `0 0 4px ${color}80` : "none",
          }}
        />
      ))}
    </div>
  );
}

function StatRow({ label, homeVal, awayVal, homeColor, awayColor }) {
  if (homeVal == null || awayVal == null) return null;
  const total = homeVal + awayVal;
  const homeWidth = total > 0 ? (homeVal / total) * 100 : 50;
  // For defense, lower is better — we flip the bar visually
  const isDefense = label === "DEF";
  const homeBarWidth = isDefense
    ? ((total - homeVal) / total) * 100
    : homeWidth;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 text-right tabular-nums font-semibold text-text-primary">
        {homeVal.toFixed(1)}
      </span>
      <span className="w-7 text-center text-[10px] uppercase tracking-wider text-text-tertiary flex-shrink-0">
        {label}
      </span>
      {/* Bar — bidirectional */}
      <div className="flex-1 h-1 rounded-full overflow-hidden flex">
        <m.div
          className="h-full"
          style={{ background: homeColor }}
          initial={{ width: 0 }}
          animate={{ width: `${homeBarWidth}%` }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="flex-1 h-full" style={{ background: awayColor, opacity: 0.6 }} />
      </div>
      <span className="w-7 text-center text-[10px] uppercase tracking-wider text-text-tertiary flex-shrink-0">
        {label}
      </span>
      <span className="w-10 tabular-nums font-semibold text-text-primary">
        {awayVal.toFixed(1)}
      </span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      {/* Team header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/[0.06]" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-14 bg-white/[0.06] rounded-full" />
            <div className="h-2.5 w-10 bg-white/[0.04] rounded-full" />
          </div>
        </div>
        <div className="h-8 w-8 bg-white/[0.04] rounded-full" />
        <div className="flex items-center gap-3">
          <div className="space-y-1.5 items-end flex flex-col">
            <div className="h-3.5 w-14 bg-white/[0.06] rounded-full" />
            <div className="h-2.5 w-10 bg-white/[0.04] rounded-full" />
          </div>
          <div className="w-10 h-10 rounded-full bg-white/[0.06]" />
        </div>
      </div>
      {/* Probability bar */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <div className="h-6 w-10 bg-white/[0.08] rounded" />
          <div className="h-6 w-10 bg-white/[0.08] rounded" />
        </div>
        <div className="h-3 bg-white/[0.06] rounded-full" />
      </div>
      {/* Stats */}
      <div className="space-y-2 pt-2">
        <div className="h-3 bg-white/[0.05] rounded-full" />
        <div className="h-3 bg-white/[0.05] rounded-full" />
      </div>
    </div>
  );
}

function formatRecord(record, league) {
  if (!record) return "—";
  const { wins, losses, otl } = record;
  return league === "nhl"
    ? `${wins}-${losses - (otl || 0)}-${otl || 0}`
    : `${wins}-${losses}`;
}

export default function PredictionCard({ prediction, loading, league, homeColor: rawHomeColor, awayColor: rawAwayColor }) {
  const [homeColor, awayColor] = resolveColors(rawHomeColor, rawAwayColor);

  const homeProb = prediction?.homeTeam.winProbability ?? 50;
  const awayProb = prediction?.awayTeam.winProbability ?? 50;
  const homeFavored = homeProb >= awayProb;

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/15 flex-shrink-0">
            {/* Target/crosshair — "we're predicting a winner" */}
            <svg className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-text-primary">Pre-Game Forecast</h2>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] overflow-hidden">
        <div className="p-5 sm:p-6">
          {loading ? (
            <LoadingSkeleton />
          ) : prediction ? (
            <>
              {/* ── Team header row ── */}
              <div className="flex items-center justify-between mb-5">
                {/* Home team */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <img
                    src={prediction.homeTeam.logoUrl}
                    alt={prediction.homeTeam.shortName}
                    className="w-10 h-10 object-contain flex-shrink-0"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate leading-tight">
                      {prediction.homeTeam.shortName}
                    </p>
                    <p className="text-[11px] text-text-tertiary leading-tight">
                      {formatRecord(prediction.homeTeam.record, league)}
                      {prediction.homeTeam.homeRecord && (
                        <span className="ml-1 opacity-60">
                          ({formatRecord(prediction.homeTeam.homeRecord, league)} home)
                        </span>
                      )}
                    </p>
                    {prediction.homeTeam.recentForm?.length > 0 && (
                      <div className="mt-1">
                        <FormDots form={prediction.homeTeam.recentForm} color={homeColor} />
                      </div>
                    )}
                  </div>
                </div>

                {/* VS divider */}
                <div className="flex flex-col items-center px-2 flex-shrink-0">
                  <span className="text-[10px] uppercase tracking-widest text-text-tertiary">vs</span>
                </div>

                {/* Away team */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-end">
                  <div className="min-w-0 text-right">
                    <p className="text-sm font-bold text-text-primary truncate leading-tight">
                      {prediction.awayTeam.shortName}
                    </p>
                    <p className="text-[11px] text-text-tertiary leading-tight">
                      {formatRecord(prediction.awayTeam.record, league)}
                      {prediction.awayTeam.awayRecord && (
                        <span className="ml-1 opacity-60">
                          ({formatRecord(prediction.awayTeam.awayRecord, league)} away)
                        </span>
                      )}
                    </p>
                    {prediction.awayTeam.recentForm?.length > 0 && (
                      <div className="mt-1 flex justify-end">
                        <FormDots form={prediction.awayTeam.recentForm} color={awayColor} />
                      </div>
                    )}
                  </div>
                  <img
                    src={prediction.awayTeam.logoUrl}
                    alt={prediction.awayTeam.shortName}
                    className="w-10 h-10 object-contain flex-shrink-0"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                </div>
              </div>

              {/* ── Bidirectional probability bar ── */}
              <div className="mb-5">
                {/* Percentage labels */}
                <div className="flex justify-between items-baseline mb-1.5">
                  <span
                    className="text-2xl font-bold tabular-nums leading-none"
                    style={{ color: homeFavored ? homeColor : "rgba(255,255,255,0.35)" }}
                  >
                    {homeProb}%
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                    {homeFavored ? `${prediction.homeTeam.shortName} favored` : `${prediction.awayTeam.shortName} favored`}
                  </span>
                  <span
                    className="text-2xl font-bold tabular-nums leading-none"
                    style={{ color: !homeFavored ? awayColor : "rgba(255,255,255,0.35)" }}
                  >
                    {awayProb}%
                  </span>
                </div>
                {/* Single bidirectional bar */}
                <div className="h-3 rounded-full overflow-hidden flex">
                  <m.div
                    className="h-full"
                    style={{ background: homeColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${homeProb}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <div className="flex-1 h-full" style={{ background: awayColor, opacity: 0.7 }} />
                </div>
              </div>

              {/* ── Injuries ── */}
              {((prediction.homeTeam.injuries?.players?.length ?? 0) > 0 ||
                (prediction.awayTeam.injuries?.players?.length ?? 0) > 0) && (
                <div className="border-t border-white/[0.06] pt-4 mb-4">
                  <p className="text-[10px] uppercase tracking-wider text-text-tertiary mb-2.5">Injuries</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-text-tertiary mb-1.5 truncate">
                        {prediction.homeTeam.shortName}
                      </p>
                      <InjuryList injuries={prediction.homeTeam.injuries} league={league} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-text-tertiary mb-1.5 truncate">
                        {prediction.awayTeam.shortName}
                      </p>
                      <InjuryList injuries={prediction.awayTeam.injuries} league={league} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Stats comparison ── */}
              {(prediction.homeTeam.offRating != null || prediction.homeTeam.defRating != null) && (
                <div className="border-t border-white/[0.06] pt-4 mb-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-text-tertiary mb-2.5">Stats</p>
                  <StatRow
                    label="OFF"
                    homeVal={prediction.homeTeam.offRating}
                    awayVal={prediction.awayTeam.offRating}
                    homeColor={homeColor}
                    awayColor={awayColor}
                  />
                  <StatRow
                    label="DEF"
                    homeVal={prediction.homeTeam.defRating}
                    awayVal={prediction.awayTeam.defRating}
                    homeColor={homeColor}
                    awayColor={awayColor}
                  />
                </div>
              )}

              {/* ── Key factors ── */}
              {prediction.keyFactors?.length > 0 && (
                <div className="border-t border-white/[0.06] pt-4">
                  <p className="text-[10px] uppercase tracking-wider text-text-tertiary mb-2.5">Key Factors</p>
                  <ul className="space-y-2">
                    {prediction.keyFactors.map((factor, i) => {
                      // Support both old shape (string) and new shape ({ text, type })
                      const text = typeof factor === "string" ? factor : factor.text;
                      const type = typeof factor === "string" ? "home" : factor.type;
                      return (
                        <li key={i} className="flex items-center gap-2.5">
                          <span className="text-accent flex-shrink-0">
                            <FactorIcon type={type} />
                          </span>
                          <span className="text-sm text-text-secondary leading-snug">{text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </div>

      </div>
    </div>
  );
}
