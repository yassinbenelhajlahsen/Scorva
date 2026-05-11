// Throwaway visual exploration — left-rail refresh applied across components.
// Route: /_mocks/cards

// ---------------- Mock data ----------------

const mockGame = {
  id: "f1", league: "nba", status: "Final",
  hometeamid: 1, awayteamid: 2, winnerid: 1,
  homescore: 105, awayscore: 98,
  home_shortname: "Lakers", away_shortname: "Celtics",
  home_logo: "https://a.espncdn.com/i/teamlogos/nba/500/lal.png",
  away_logo: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png",
  date: "2026-05-14", type: "final",
  game_label: "NBA Finals · Game 4",
  home_series_wins: 2, away_series_wins: 2,
  firstqtr: "24-22", secondqtr: "28-26", thirdqtr: "25-24", fourthqtr: "28-26",
  grade: 9.4,
};

const mockStat = {
  stats: [
    { label: "PTS", value: 38 }, { label: "REB", value: 9 },
    { label: "AST", value: 7 }, { label: "FG%", value: 56 },
  ],
  opponent: "BOS",
  opponentLogo: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png",
  date: "May 10", isHome: true, result: "W", status: "Final",
  gameType: "playoff", ratingGrade: 9.1,
  gameLabel: "East Semifinals · Game 5",
};

const mockAverages = { points: 27.4, rebounds: 7.8, assists: 6.2, fgPct: 51 };

const mockSimilarPlayers = [
  { id: 1, name: "Jayson Tatum", position: "F", teamShortName: "BOS", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/4065648.png" },
  { id: 2, name: "Jaylen Brown", position: "G/F", teamShortName: "BOS", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/3917376.png" },
  { id: 3, name: "Kawhi Leonard", position: "F", teamShortName: "LAC", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/6450.png" },
  { id: 4, name: "Paul George", position: "F", teamShortName: "PHI", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/4251.png" },
];

const mockAwardGroups = {
  legendary: [
    { type: "MVP", label: "Most Valuable Player", count: 4, seasons: ["2022-23", "2021-22", "2020-21", "2018-19"] },
    { type: "FINALS_MVP", label: "Finals MVP", count: 3, seasons: ["2022-23", "2018-19", "2017-18"] },
  ],
  major: [
    { type: "CHAMPION", label: "NBA Champion", count: 3, seasons: ["2022-23", "2018-19", "2017-18"] },
    { type: "DPOY", label: "Defensive Player of the Year", count: 1, seasons: ["2019-20"] },
    { type: "SCORING_TITLE", label: "Scoring Champion", count: 2, seasons: ["2021-22", "2019-20"] },
  ],
  selection: [
    { type: "ALL_NBA", label: "All-NBA Team", count: 9, seasons: ["2024-25", "2023-24", "2022-23", "2021-22", "2020-21", "2019-20", "2018-19", "2017-18", "2016-17"] },
    { type: "ALL_STAR", label: "All-Star", count: 11, seasons: ["2025-26"] },
    { type: "ALL_DEFENSIVE", label: "All-Defensive Team", count: 6, seasons: ["2024-25"] },
  ],
};

const mockRoster = [
  { id: 1, name: "LeBron James", jerseynum: 23, position: "F", image_url: "https://a.espncdn.com/i/headshots/nba/players/full/1966.png", averages: { points: 24.5, rebounds: 7.3, assists: 8.1, fgPct: 53 }, status: null },
  { id: 2, name: "Anthony Davis", jerseynum: 3, position: "C/F", image_url: "https://a.espncdn.com/i/headshots/nba/players/full/6583.png", averages: { points: 23.2, rebounds: 12.6, assists: 3.4, fgPct: 56 }, status: "questionable" },
  { id: 3, name: "Austin Reaves", jerseynum: 15, position: "G", image_url: "https://a.espncdn.com/i/headshots/nba/players/full/4433134.png", averages: { points: 15.8, rebounds: 4.4, assists: 5.5, fgPct: 47 }, status: null },
];

const mockGameDetail = {
  status: "Final",
  score: {
    home: 105, away: 98,
    quarters: { q1: "24-22", q2: "28-26", q3: "25-24", q4: "28-26", ot: [] },
  },
  currentPeriod: null, clock: null,
  gameLabel: "NBA Finals · Game 4",
  seriesScore: { homeWins: 2, awayWins: 2 },
  gameType: "final",
  date: "May 14, 2026",
  venue: "Crypto.com Arena, Los Angeles, CA",
  broadcast: "ABC",
};

const mockHomeTeam = {
  info: {
    name: "Los Angeles Lakers", shortName: "Lakers", abbreviation: "LAL",
    logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/lal.png",
    color: "#552583",
  },
};

const mockAwayTeam = {
  info: {
    name: "Boston Celtics", shortName: "Celtics", abbreviation: "BOS",
    logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png",
    color: "#007A33",
  },
};

const mockGameRating = {
  grade: 8.7, tierLabel: "Great",
  home: { grade: 7.9 }, away: { grade: 8.4 },
};

// ---- Tab-content mock data ----

const mockTopPerformers = [
  {
    title: "Top Performer", color: "#e8863a",
    player: { name: "LeBron James", position: "F · Lakers",
      imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/1966.png",
      stats: [{ label: "PTS", value: 32 }, { label: "REB", value: 8 }, { label: "AST", value: 12 }],
      ratingGrade: 9.2 },
  },
  {
    title: "Top Scorer", color: "#4f8eff",
    player: { name: "Jayson Tatum", position: "F · Celtics",
      imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/4065648.png",
      stats: [{ label: "PTS", value: 34 }, { label: "REB", value: 6 }, { label: "AST", value: 4 }],
      ratingGrade: 8.6 },
  },
  {
    title: "Impact Player", color: "#34c759",
    player: { name: "Anthony Davis", position: "C · Lakers",
      imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/6583.png",
      stats: [{ label: "PTS", value: 24 }, { label: "REB", value: 14 }, { label: "BLK", value: 5 }],
      ratingGrade: 8.4 },
  },
];

const mockPrediction = {
  homeTeam: {
    shortName: "Lakers", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/lal.png",
    record: "48-23", homeRecord: "28-8",
    recentForm: ["W", "W", "L", "W", "W"],
    winProbability: 62, offRating: 118.4, defRating: 110.2,
  },
  awayTeam: {
    shortName: "Celtics", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png",
    record: "44-26", awayRecord: "18-18",
    recentForm: ["L", "W", "W", "L", "W"],
    winProbability: 38, offRating: 114.8, defRating: 113.6,
  },
  keyFactors: [
    { text: "Lakers 8-2 in last 10 home games", type: "home" },
    { text: "Tatum questionable — game-time decision", type: "away" },
    { text: "Lakers shoot 41% from 3 at home vs 35% on road", type: "home" },
  ],
};

const mockTeamComparisonRows = [
  { label: "PTS/G", home: 116.2, away: 112.8, lowerBetter: false },
  { label: "REB/G", home: 44.8, away: 42.1, lowerBetter: false },
  { label: "AST/G", home: 27.3, away: 24.6, lowerBetter: false },
  { label: "OPP PTS/G", home: 110.4, away: 109.8, lowerBetter: true },
  { label: "FG%", home: 49.2, away: 47.8, lowerBetter: false },
];

const mockBoxScoreTeam = {
  name: "Los Angeles Lakers", abbreviation: "LAL",
  players: [
    { name: "LeBron James", pos: "F", min: 38, pts: 32, reb: 8, ast: 12, fg: "12-22", rating: 9.2 },
    { name: "Anthony Davis", pos: "C", min: 35, pts: 24, reb: 14, ast: 3, fg: "10-17", rating: 8.4 },
    { name: "Austin Reaves", pos: "G", min: 31, pts: 18, reb: 5, ast: 4, fg: "7-13", rating: 7.6 },
    { name: "D'Angelo Russell", pos: "G", min: 28, pts: 15, reb: 3, ast: 6, fg: "5-12", rating: 7.1 },
    { name: "Rui Hachimura", pos: "F", min: 24, pts: 11, reb: 6, ast: 1, fg: "4-9", rating: 6.8 },
  ],
};

const mockPlays = [
  { id: 1, period: 4, clock: "0:12", team: "LAL", desc: "James 3PT made 25ft (assist by Davis)", score: "105-98", scoring: true },
  { id: 2, period: 4, clock: "0:34", team: "BOS", desc: "Tatum offensive rebound", score: null, scoring: false },
  { id: 3, period: 4, clock: "0:45", team: "BOS", desc: "Brown 3PT missed 27ft", score: null, scoring: false },
  { id: 4, period: 4, clock: "1:02", team: "LAL", desc: "Davis layup (assist by James)", score: "102-98", scoring: true },
  { id: 5, period: 4, clock: "1:24", team: "BOS", desc: "Tatum step-back 3PT made (assist by White)", score: "100-98", scoring: true },
];

const mockAISummaryBullets = [
  "Lakers held the Celtics to 41% from the field, their lowest mark in the series, with Davis altering 9 shots at the rim.",
  "LeBron's 32-point triple-double was the dagger — he scored 14 in the fourth, including the go-ahead three with 12 seconds left.",
  "Boston shot just 28% from three after starting the series at 41% — a regression that has plagued them in elimination spots.",
];

const LEAGUE_LOGOS = {
  nba: "https://a.espncdn.com/i/teamlogos/leagues/500/nba.png",
  nfl: "https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png",
  nhl: "https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png",
};
const LEAGUE_NAMES = { nba: "NBA", nfl: "NFL", nhl: "NHL" };

const mockNews = [
  { league: "nba", headline: "Lakers stun Celtics 105-98 in Game 4, even Finals series 2-2", imageUrl: null, published: "2026-05-11T10:00:00Z", description: "Anthony Davis altered 9 shots at the rim and LeBron James hit the go-ahead three with 12 seconds left." },
  { league: "nfl", headline: "Mahomes signs 5-year, $325M extension with Chiefs through 2031", imageUrl: null, published: "2026-05-11T08:30:00Z" },
  { league: "nhl", headline: "Panthers eliminate Maple Leafs in Game 7, advance to East Finals", imageUrl: null, published: "2026-05-10T22:15:00Z" },
  { league: "nba", headline: "Shai Gilgeous-Alexander wins MVP unanimously, first since Curry 2016", imageUrl: null, published: "2026-05-10T15:00:00Z" },
  { league: "nfl", headline: "Bills release veteran WR after disagreement over snap share", imageUrl: null, published: "2026-05-10T11:00:00Z" },
  { league: "nhl", headline: "Connor Bedard signs 8-year max extension with Blackhawks", imageUrl: null, published: "2026-05-09T20:30:00Z" },
];

const mockReports = [
  {
    id: "r1", type: "injury", date: "2026-05-11T14:32:00Z",
    player: { name: "Tyrese Haliburton", slug: "tyrese-haliburton", league: "nba", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/4396906.png" },
    prevStatus: "questionable", newStatus: "out", newStatusDescription: "Right hamstring",
  },
  {
    id: "r2", type: "move", date: "2026-05-11T11:08:00Z",
    player: { name: "Russell Westbrook", slug: "russell-westbrook", league: "nba", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/3468.png" },
    action: "trade", league: "nba",
    fromTeam: { abbreviation: "LAC", name: "Clippers", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/lac.png" },
    toTeam: { abbreviation: "DEN", name: "Nuggets", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/den.png" },
  },
  {
    id: "r3", type: "streak", date: "2026-05-11T03:15:00Z",
    player: { name: "Shai Gilgeous-Alexander", slug: "shai-gilgeous-alexander", league: "nba", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/4278073.png" },
    streakLength: 12, statLabel: "30+ point", emoji: "🔥",
  },
  {
    id: "r4", type: "birthday", date: "2026-05-10T08:00:00Z",
    player: { name: "Stephen Curry", slug: "stephen-curry", league: "nba", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/3975.png" },
    age: 38,
  },
  {
    id: "r5", type: "streak", date: "2026-05-10T02:45:00Z",
    team: { name: "Boston Celtics", abbreviation: "BOS", league: "nba", slug: "boston-celtics", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png" },
    streakLength: 8, statLabel: "win", emoji: "🔥",
  },
  {
    id: "r6", type: "injury", date: "2026-05-09T22:00:00Z",
    player: { name: "Joel Embiid", slug: "joel-embiid", league: "nba", imageUrl: "https://a.espncdn.com/i/headshots/nba/players/full/3059318.png" },
    prevStatus: "out", newStatus: "questionable", newStatusDescription: "Left knee",
  },
];

// ---------------- Shared helpers ----------------

function formatShort(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TrophyIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden>
      <path d="M232 64h-32V56a16 16 0 0 0-16-16H72a16 16 0 0 0-16 16v8H24a16 16 0 0 0-16 16v32a40 40 0 0 0 40 40h11a64.18 64.18 0 0 0 53 36.43V216H88a8 8 0 0 0 0 16h80a8 8 0 0 0 0-16h-24v-27.57A64.18 64.18 0 0 0 197 152h11a40 40 0 0 0 40-40V80a16 16 0 0 0-16-16zM48 128a24 24 0 0 1-24-24V80h32v32a64.3 64.3 0 0 0 .57 8.49A24.27 24.27 0 0 1 48 128zm184-24a24 24 0 0 1-24 24a24.27 24.27 0 0 1-8.57-1.51A64.3 64.3 0 0 0 200 112V80h32z" />
    </svg>
  );
}

function SeriesDots({ home, away, total = 4 }) {
  const h = Number(home ?? 0);
  const a = Number(away ?? 0);
  if (h + a === 0) return null;
  return (
    <div className="flex items-center justify-center gap-2.5 mt-1.5">
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span key={`h${i}`} className={`w-1.5 h-1.5 rounded-full ${i < h ? "bg-text-primary" : "bg-white/15"}`} />
        ))}
      </div>
      <span className="text-[9px] uppercase tracking-[0.15em] text-text-tertiary">vs</span>
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span key={`a${i}`} className={`w-1.5 h-1.5 rounded-full ${i < a ? "bg-text-primary" : "bg-white/15"}`} />
        ))}
      </div>
    </div>
  );
}

// ---------------- GameCard (refresh) ----------------

function RailGameCard({ game }) {
  const isFinal = game.status.includes("Final");
  const inProgress = game.status.includes("In Progress");
  const isPlayoff = game.type === "playoff" || game.type === "final";
  const isChampionship = game.type === "final";
  const homeWon = isFinal && game.hometeamid === game.winnerid;
  const awayWon = isFinal && game.awayteamid === game.winnerid;
  const margin = isFinal ? Math.abs(game.homescore - game.awayscore) : 0;
  const scoreColor = (w, l) => !isFinal ? "text-text-primary" : w ? "text-win" : l ? "text-loss" : "text-text-tertiary";
  const quarters = [game.firstqtr, game.secondqtr, game.thirdqtr, game.fourthqtr].filter((q) => q != null);
  const rail = isChampionship
    ? "w-[3px] bg-accent"
    : inProgress
      ? "w-[2px] bg-live animate-[pulse_2s_ease-in-out_infinite]"
      : "w-[2px] bg-white/15 group-hover:bg-white/30 transition-colors duration-200";

  return (
    <div className="group relative transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer hover:bg-white/[0.04] hover:-translate-y-0.5 max-w-md mx-auto">
      <div className={`absolute left-0 top-0 bottom-0 ${rail}`} />
      {(inProgress || isChampionship) && (
        <div className={`absolute inset-0 bg-gradient-to-r ${inProgress ? "from-live/[0.05]" : "from-accent/[0.06]"} to-transparent pointer-events-none`} />
      )}
      <div className="relative p-5 text-center">
        <div className="flex items-center justify-between gap-4 h-[120px]">
          <div className="flex flex-col items-center flex-1 gap-1.5">
            <img src={game.home_logo} alt="" className="w-12 h-12 object-contain" />
            <div className="text-sm font-semibold text-text-primary">{game.home_shortname}</div>
            <div className={`text-lg font-bold tabular-nums flex items-baseline gap-1 ${scoreColor(homeWon, awayWon)}`}>
              {game.homescore}
              {homeWon && margin > 0 && <span className="text-[10px] text-text-tertiary font-medium">+{margin}</span>}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center flex-shrink-0 w-[90px] gap-0.5 h-full overflow-hidden">
            <span className="text-xs text-text-tertiary tabular-nums">{formatShort(game.date)}</span>
            {isFinal && game.grade != null && (
              <div className="flex flex-col items-center mt-1">
                <span className={`font-bold text-2xl tabular-nums leading-none ${game.grade < 0 ? "text-loss" : "text-accent"}`}>
                  {game.grade.toFixed(1)}
                </span>
                <span className="text-[8px] uppercase tracking-widest text-text-tertiary mt-0.5 font-medium">Rating</span>
              </div>
            )}
            <p className="text-xs text-text-tertiary mt-1">Final</p>
          </div>
          <div className="flex flex-col items-center flex-1 gap-1.5">
            <img src={game.away_logo} alt="" className="w-12 h-12 object-contain" />
            <div className="text-sm font-semibold text-text-primary">{game.away_shortname}</div>
            <div className={`text-lg font-bold tabular-nums flex items-baseline gap-1 ${scoreColor(awayWon, homeWon)}`}>
              {game.awayscore}
              {awayWon && margin > 0 && <span className="text-[10px] text-text-tertiary font-medium">+{margin}</span>}
            </div>
          </div>
        </div>
        {quarters.length > 0 && (
          <div className="overflow-hidden transition-[max-height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] max-h-0 group-hover:max-h-[300px]">
            <div className="mt-3 font-mono text-sm border-t border-white/[0.06] pt-3">
              <div className="flex items-center gap-x-3 text-[10px] uppercase tracking-widest text-text-tertiary pb-2 border-b border-white/[0.06]">
                <span className="flex-1 min-w-0 text-left">Team</span>
                {quarters.map((_, i) => <span key={i} className="w-7 text-center shrink-0">{i + 1}</span>)}
                <span className="w-7 text-center shrink-0 font-semibold text-text-secondary">T</span>
              </div>
              <div className="flex items-center gap-x-3 py-2">
                <span className="flex-1 min-w-0 text-left font-semibold text-text-primary truncate text-xs">{game.home_shortname}</span>
                {quarters.map((q, i) => <span key={i} className="w-7 text-center shrink-0 text-text-secondary text-xs tabular-nums">{q?.split("-")[0] ?? "–"}</span>)}
                <span className={`w-7 text-center shrink-0 font-bold tabular-nums text-xs ${scoreColor(homeWon, awayWon)}`}>{game.homescore}</span>
              </div>
              <div className="border-t border-white/[0.04]" />
              <div className="flex items-center gap-x-3 py-2">
                <span className="flex-1 min-w-0 text-left font-semibold text-text-primary truncate text-xs">{game.away_shortname}</span>
                {quarters.map((q, i) => <span key={i} className="w-7 text-center shrink-0 text-text-secondary text-xs tabular-nums">{q?.split("-")[1] ?? "–"}</span>)}
                <span className={`w-7 text-center shrink-0 font-bold tabular-nums text-xs ${scoreColor(awayWon, homeWon)}`}>{game.awayscore}</span>
              </div>
            </div>
          </div>
        )}
        {isPlayoff && game.game_label && (
          <div className={`mt-2 pt-2 border-t ${isChampionship ? "border-accent/30" : "border-white/[0.04]"}`}>
            <p className={`flex items-center justify-center gap-1.5 text-center tracking-wide ${isChampionship ? "text-accent font-semibold uppercase tracking-[0.15em] text-[11px]" : "text-xs text-text-tertiary font-medium"}`}>
              {isChampionship && <TrophyIcon className="w-3 h-3" />}
              {game.game_label}
              {isChampionship && <TrophyIcon className="w-3 h-3" />}
            </p>
            <SeriesDots home={game.home_series_wins} away={game.away_series_wins} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- StatCard (refresh) ----------------

function RailStatCard({ stat }) {
  const isPlayoff = stat.gameType === "playoff" || stat.gameType === "final";
  const isChampionship = stat.gameType === "final";
  const rail = isChampionship
    ? "w-[3px] bg-accent"
    : isPlayoff
      ? "w-[2px] bg-accent/70 group-hover:bg-accent transition-colors duration-200"
      : stat.result === "W"
        ? "w-[2px] bg-win/60 group-hover:bg-win transition-colors duration-200"
        : "w-[2px] bg-loss/60 group-hover:bg-loss transition-colors duration-200";

  return (
    <div className="group relative transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer max-w-sm mx-auto hover:bg-white/[0.04] hover:-translate-y-0.5">
      <div className={`absolute left-0 top-0 bottom-0 ${rail}`} />
      <div className="relative flex items-stretch">
        <div className="flex-1 min-w-0 p-5 text-center">
          <div className="text-text-tertiary text-xs mb-4 flex items-center justify-center gap-2">
            <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${stat.result === "W" ? "text-win bg-win/10" : "text-loss bg-loss/10"}`}>
              {stat.result}
            </span>
            <span className="flex items-center gap-1 text-text-secondary text-xs">
              vs.
              <img src={stat.opponentLogo} alt="" className="w-4 h-4 object-contain mx-1" />
              {stat.opponent} · {stat.date}
            </span>
          </div>
          <ul className="flex flex-wrap justify-center gap-8">
            {stat.stats.map((s, i) => (
              <li key={i} className="flex flex-col items-center min-w-[52px]">
                <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-medium">{s.label}</span>
                <span className="font-semibold text-2xl mt-1 text-text-primary tabular-nums">
                  {s.value}{s.label.includes("%") && "%"}
                </span>
              </li>
            ))}
          </ul>
          {isPlayoff && (
            <div className={`mt-3 pt-3 border-t ${isChampionship ? "border-accent/30" : "border-white/[0.06]"} flex items-center justify-center gap-1.5`}>
              {isChampionship && <TrophyIcon className="w-3 h-3 text-accent" />}
              <span className={`tracking-wide ${isChampionship ? "text-accent font-semibold uppercase tracking-[0.15em] text-[11px]" : "text-xs text-text-tertiary font-medium"}`}>
                {stat.gameLabel}
              </span>
              {isChampionship && <TrophyIcon className="w-3 h-3 text-accent" />}
            </div>
          )}
        </div>
        <div className="shrink-0 px-3.5 py-3 flex flex-col items-center justify-center">
          <span className="text-accent font-bold text-3xl tabular-nums leading-none">{stat.ratingGrade.toFixed(1)}</span>
          <span className="text-[9px] uppercase tracking-widest text-text-tertiary mt-1.5 font-medium">Rating</span>
        </div>
      </div>
    </div>
  );
}

// ---------------- PlayerAvgCard (refresh) ----------------

function RefreshedPlayerAvgCard({ averages, season }) {
  const stats = [
    { label: "PTS", value: averages.points }, { label: "REB", value: averages.rebounds },
    { label: "AST", value: averages.assists }, { label: "FG%", value: averages.fgPct },
  ];
  return (
    <div className="relative overflow-hidden rounded-2xl w-full">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/60" />
      <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.06] via-transparent to-transparent pointer-events-none" />
      <div className="relative">
        <div className="text-accent text-[11px] uppercase tracking-[0.22em] font-semibold text-center pt-4 pb-3 border-b border-white/[0.05]">
          {season} Regular Season
        </div>
        <div className="px-6 py-7">
          <ul className="flex flex-wrap gap-y-6 justify-around w-full">
            {stats.map((s, i) => (
              <li key={i} className="flex flex-col items-center flex-1 min-w-[72px]">
                <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-medium">{s.label}</span>
                <span className="font-bold text-4xl mt-1.5 text-text-primary tabular-nums">
                  {s.value ?? "--"}{s.label.includes("%") && "%"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---------------- SimilarPlayersCard (refresh) ----------------

function RefreshedSimilarPlayersCard({ players }) {
  return (
    <div className="w-full max-w-sm">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-tertiary mb-3 pl-3">
        Similar Players
      </h3>
      <div className="flex flex-col">
        {players.map((player, idx) => (
          <a
            key={player.id}
            href="#"
            onClick={(e) => e.preventDefault()}
            className={`group relative flex items-center gap-3 pl-3 pr-3 py-3 transition-colors duration-200 hover:bg-white/[0.03] ${idx < players.length - 1 ? "border-b border-white/[0.04]" : ""}`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-transparent group-hover:bg-accent transition-colors duration-200" />
            <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-overlay/40 border border-white/[0.06] shrink-0">
              <img src={player.imageUrl} alt={player.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary text-sm font-semibold leading-tight truncate group-hover:text-accent transition-colors duration-150">
                {player.name}
              </p>
              <p className="text-text-tertiary text-xs mt-0.5 truncate">
                {[player.position, player.teamShortName].filter(Boolean).join(" · ")}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ---------------- PlayerAwardsCard (refresh) ----------------

const TIER_STYLES = {
  legendary: { name: "text-sm font-semibold text-text-primary", count: "text-[22px] font-semibold text-accent leading-none tabular-nums tracking-[-0.02em]" },
  major: { name: "text-[13px] font-medium text-text-primary", count: "text-base font-medium text-text-primary leading-none tabular-nums" },
  selection: { name: "text-xs text-text-secondary", count: "text-[13px] font-medium text-text-secondary leading-none tabular-nums" },
};

function AwardRow({ award, tier }) {
  const styles = TIER_STYLES[tier];
  const yearsText = award.count <= 4 ? award.seasons.join(", ") : `${award.seasons[award.seasons.length - 1]} – ${award.seasons[0]}`;
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-white/[0.06] last:border-b-0">
      <span className={styles.name}>{award.label}</span>
      <span className="flex-1 min-w-0 text-[11px] tabular-nums text-right truncate text-text-tertiary">{yearsText}</span>
      <span className={`${styles.count} min-w-[2rem] text-right shrink-0`}>{award.count}</span>
    </div>
  );
}

function AwardSection({ title, awards, tier, accentRail }) {
  if (!awards.length) return null;
  return (
    <div className={`relative ${accentRail ? "pl-4" : ""}`}>
      {accentRail && <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-accent rounded-full" />}
      <div className={`text-[10px] uppercase tracking-[0.18em] mb-3 font-semibold ${accentRail ? "text-accent" : "text-text-tertiary"}`}>
        {title}
      </div>
      <div className="flex flex-col">
        {awards.map((award) => <AwardRow key={award.type} award={award} tier={tier} />)}
      </div>
    </div>
  );
}

function RefreshedPlayerAwardsCard({ groups }) {
  return (
    <div className="w-full max-w-2xl">
      <div className="text-[11px] uppercase tracking-[0.22em] text-text-tertiary mb-6 pl-3 font-semibold">
        Career Honors
      </div>
      <div className="flex flex-col gap-7">
        <AwardSection title="Legendary" awards={groups.legendary} tier="legendary" accentRail />
        <AwardSection title="Major Honors" awards={groups.major} tier="major" />
        <AwardSection title="Selections" awards={groups.selection} tier="selection" />
      </div>
    </div>
  );
}

// ---------------- RosterGrid (refresh) ----------------

function StatusPill({ status }) {
  const tones = {
    questionable: "text-amber-400 bg-amber-400/10 ring-amber-400/30",
    out: "text-loss bg-loss/10 ring-loss/30",
    available: "text-win bg-win/10 ring-win/30",
  };
  const tone = tones[status] || tones.questionable;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md ring-1 ${tone} text-[10px] font-semibold uppercase tracking-[0.08em]`}>
      {status}
    </span>
  );
}

function RefreshedRosterCard({ player }) {
  const [firstName, ...rest] = player.name.split(" ");
  const lastName = rest.join(" ");
  const stats = [
    { label: "PTS", value: player.averages.points }, { label: "REB", value: player.averages.rebounds },
    { label: "AST", value: player.averages.assists }, { label: "FG%", value: player.averages.fgPct, suffix: "%" },
  ];
  return (
    <a href="#" onClick={(e) => e.preventDefault()} className="group relative block overflow-hidden rounded-2xl transition-all duration-[300ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/[0.04] hover:-translate-y-1 cursor-pointer">
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/[0.06] group-hover:bg-accent transition-colors duration-200" />
      {player.jerseynum != null && (
        <span aria-hidden="true" className="absolute -top-3 -right-1 text-[96px] font-black tracking-[-0.04em] text-white/[0.04] group-hover:text-accent/[0.14] transition-colors duration-[300ms] tabular-nums leading-none select-none pointer-events-none">
          {player.jerseynum}
        </span>
      )}
      <div className="relative flex flex-col gap-4 p-5">
        <div className="flex items-center gap-4">
          <img src={player.image_url} alt={player.name} className="w-20 h-20 rounded-full object-cover bg-surface-overlay/40 ring-1 ring-white/[0.06] group-hover:ring-accent/30 transition-all duration-[300ms] shrink-0" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-medium text-text-tertiary tracking-wide truncate">{firstName}</span>
              <h3 className="text-[17px] font-semibold text-text-primary tracking-tight truncate">{lastName || firstName}</h3>
            </div>
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/[0.05] ring-1 ring-white/[0.06] text-text-secondary text-[10px] font-semibold uppercase tracking-[0.08em]">
                {player.position}
              </span>
              {player.status && <StatusPill status={player.status} />}
            </div>
          </div>
        </div>
        <div className="flex justify-around gap-2 pt-3 border-t border-white/[0.05]">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary">{s.label}</span>
              <span className="mt-0.5 text-[15px] font-bold tabular-nums text-text-primary">
                {s.value ?? "—"}{s.value != null && s.suffix}
              </span>
            </div>
          ))}
        </div>
      </div>
    </a>
  );
}

// ---------------- GameMatchupHeader (refresh) ----------------

function RefreshedGameMatchupHeader({ homeTeam, awayTeam, game, league, isFinal, gameRating }) {
  const isChampionship = game.gameType === "final";
  const isPlayoff = game.gameType === "playoff" || isChampionship;
  const playoffLogo = isPlayoff ? `/${league.toUpperCase()}/${league.toUpperCase()}${isChampionship ? "Final" : "Playoff"}.webp` : null;
  const homeWon = isFinal && game.score.home > game.score.away;
  const awayWon = isFinal && game.score.away > game.score.home;
  const scoreColor = (won, lost) => won ? "text-win" : lost ? "text-loss" : "text-text-primary";

  return (
    <div className="relative overflow-hidden rounded-2xl mb-10">
      {isChampionship && <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.04] to-transparent pointer-events-none" />}
      <div className="relative grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-8 sm:gap-16 py-8 px-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:justify-self-end">
          <img src={homeTeam.info.logoUrl} alt="" className="w-20 h-20 sm:w-28 sm:h-28 object-contain" />
          <div className="text-center sm:text-left">
            <span className="block text-2xl sm:text-4xl font-bold tracking-tight text-text-primary">{homeTeam.info.shortName}</span>
            <div className={`text-3xl sm:text-5xl font-bold tabular-nums mt-1 ${scoreColor(homeWon, awayWon)}`}>{game.score.home}</div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          {gameRating?.grade != null && <GameRatingBadge rating={gameRating} />}
          {playoffLogo && (
            <div className="h-24 w-48 flex items-center justify-center">
              <img src={playoffLogo} alt={game.gameLabel} className="max-h-full max-w-full object-contain" />
            </div>
          )}
          {game.gameLabel && (
            <p className={`flex items-center justify-center gap-1.5 ${isChampionship ? "text-accent font-semibold uppercase tracking-[0.18em] text-[11px]" : "text-sm font-medium text-text-secondary"}`}>
              {isChampionship && <TrophyIcon className="w-3 h-3" />}
              {game.gameLabel}
              {isChampionship && <TrophyIcon className="w-3 h-3" />}
            </p>
          )}
          {game.seriesScore && <SeriesDots home={game.seriesScore.homeWins} away={game.seriesScore.awayWins} />}
          {isFinal && <p className="text-xs text-text-tertiary mt-1">Final</p>}
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:justify-self-start">
          <div className="text-center sm:text-right order-2 sm:order-1">
            <span className="block text-2xl sm:text-4xl font-bold tracking-tight text-text-primary">{awayTeam.info.shortName}</span>
            <div className={`text-3xl sm:text-5xl font-bold tabular-nums mt-1 ${scoreColor(awayWon, homeWon)}`}>{game.score.away}</div>
          </div>
          <img src={awayTeam.info.logoUrl} alt="" className="w-20 h-20 sm:w-28 sm:h-28 object-contain order-1 sm:order-2" />
        </div>
      </div>
    </div>
  );
}

// ---------------- GameInfoCard (refresh) ----------------

function RefreshedGameInfoCard({ game }) {
  const rows = [
    { label: "Date", value: game.date },
    { label: "Status", value: game.status },
    { label: "Location", value: game.venue },
    ...(game.broadcast ? [{ label: "Broadcast", value: game.broadcast }] : []),
  ];
  return (
    <div className="relative pl-4 mb-6">
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent/40 rounded-full" />
      <div className="flex flex-col">
        {rows.map(({ label, value }, i) => (
          <div key={label} className={`flex items-center justify-between gap-4 py-3 ${i < rows.length - 1 ? "border-b border-white/[0.05]" : ""}`}>
            <span className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary font-semibold shrink-0">{label}</span>
            <span className="text-sm font-medium text-text-primary text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- GameTabBar ----------------

function MockGameTabBar({ activeTab = "overview" }) {
  const tabs = [
    { id: "overview", label: "Overview" }, { id: "analysis", label: "Analysis" }, { id: "plays", label: "Plays" },
  ];
  return (
    <div className="relative flex border-b border-white/[0.06] mb-6">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <div key={tab.id} className={`relative px-3 pb-2.5 pt-2 text-sm font-medium -mb-px ${isActive ? "text-accent" : "text-text-secondary"}`}>
            {tab.label}
            {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />}
          </div>
        );
      })}
    </div>
  );
}

// ---------------- GameRatingBadge (used in GameMatchupHeader) ----------------
// Pill rendered above the playoff logo in the center column.

function GameRatingBadge({ rating }) {
  if (!rating || rating.grade == null) return null;
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] ring-1 ring-white/[0.08]"
      aria-label={`Game rating ${rating.grade.toFixed(1)} out of 10${rating.tierLabel ? `, ${rating.tierLabel}` : ""}`}
    >
      <span className="text-xs font-bold text-accent" aria-hidden>★</span>
      <span className={`text-sm font-bold tabular-nums ${rating.grade < 0 ? "text-loss" : "text-text-primary"}`}>
        {rating.grade.toFixed(1)}
      </span>
    </div>
  );
}

// ---------------- Quarter scoreboard (refresh) ----------------

function RefreshedQuarterScoreboard({ homeTeam, awayTeam, game, quarterKeys = ["q1", "q2", "q3", "q4"] }) {
  const homeWon = game.score.home > game.score.away;
  const awayWon = !homeWon;
  const scoreColor = (won, lost) => won ? "text-win" : lost ? "text-loss" : "text-text-primary";
  return (
    <div className="relative mb-6">
      <div className="font-mono text-sm w-full">
        <div className="flex items-center gap-x-4 text-[10px] uppercase tracking-[0.18em] text-text-tertiary pb-3 border-b border-white/[0.08]">
          <span className="flex-1 min-w-0">Team</span>
          {quarterKeys.map((_, i) => <span key={i} className="w-10 text-center shrink-0">{i + 1}</span>)}
          <span className="w-10 text-center shrink-0 font-semibold text-text-secondary">T</span>
        </div>
        <div className="flex items-center gap-x-4 py-3">
          <span className="flex-1 min-w-0 font-semibold text-text-primary truncate">{homeTeam.info.shortName}</span>
          {quarterKeys.map((q) => <span key={q} className="w-10 text-center shrink-0 text-text-secondary tabular-nums">{game.score.quarters[q]?.split("-")[0] ?? "–"}</span>)}
          <span className={`w-10 text-center shrink-0 font-bold tabular-nums ${scoreColor(homeWon, awayWon)}`}>{game.score.home}</span>
        </div>
        <div className="border-t border-white/[0.04]" />
        <div className="flex items-center gap-x-4 py-3">
          <span className="flex-1 min-w-0 font-semibold text-text-primary truncate">{awayTeam.info.shortName}</span>
          {quarterKeys.map((q) => <span key={q} className="w-10 text-center shrink-0 text-text-secondary tabular-nums">{game.score.quarters[q]?.split("-")[1] ?? "–"}</span>)}
          <span className={`w-10 text-center shrink-0 font-bold tabular-nums ${scoreColor(awayWon, homeWon)}`}>{game.score.away}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------- Prediction Locked stripe (refresh) ----------------

function RefreshedPredictionLocked() {
  return (
    <div className="relative overflow-hidden rounded-2xl mb-6">
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent/60" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.8) 0 1px, transparent 1px 12px)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-20" style={{ background: "radial-gradient(circle, #e8863a 0%, transparent 70%)" }} />
      <div className="relative flex items-start gap-4 p-5">
        <div className="shrink-0 w-11 h-11 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="4" y="11" width="16" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary tracking-tight">Prediction Locked</h3>
          <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">Prediction available after the previous game in this series finishes.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------- TopPerformerCard (refresh) ----------------
// List-item card with a colored gradient slab on the left as the visual
// signature. Drops outer chrome but KEEPS the slab — it's already the rail.

function RefreshedTopPerformerCard({ title, color, player }) {
  return (
    <a href="#" onClick={(e) => e.preventDefault()} className="group relative flex items-stretch h-[108px] rounded-2xl overflow-hidden transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/[0.04] hover:-translate-y-0.5 cursor-pointer w-full">
      <div className="w-[88px] shrink-0 flex flex-col items-center justify-center gap-1.5 px-2" style={{
        background: `linear-gradient(150deg, ${color}1f 0%, ${color}0a 100%)`,
        borderRight: `1px solid ${color}26`,
      }}>
        <img src={player.imageUrl} alt={player.name} className="w-12 h-12 object-cover rounded-full" style={{ boxShadow: `0 0 0 2px ${color}33` }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <span className="text-[9px] uppercase tracking-widest font-semibold text-center leading-tight" style={{ color }}>
          {title}
        </span>
      </div>
      <div className="flex-1 flex items-stretch min-w-0">
        <div className="flex-1 flex flex-col justify-between pl-3.5 pr-2 py-3 min-w-0">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors duration-200 truncate">{player.name}</div>
            <div className="text-xs text-text-tertiary mt-0.5 truncate">{player.position}</div>
          </div>
          {player.stats?.length > 0 && (
            <div className="flex items-end gap-3.5">
              {player.stats.slice(0, 4).map(({ label, value }) => (
                <div key={label} className="flex flex-col items-start">
                  <span className="text-sm font-bold text-text-primary tabular-nums leading-none">{value}</span>
                  <span className="text-[9px] uppercase tracking-widest text-text-tertiary mt-0.5">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {player.ratingGrade != null && (
          <div className="shrink-0 pl-3 pr-3.5 py-3 flex flex-col items-center justify-center">
            <span className="text-accent font-black text-3xl tabular-nums leading-none">{player.ratingGrade.toFixed(1)}</span>
            <span className="text-[9px] uppercase tracking-widest text-text-tertiary mt-1">Rating</span>
          </div>
        )}
      </div>
    </a>
  );
}

// ---------------- PredictionCard (refresh) ----------------
// Hero card. Drops bg-elevated/border/shadow. Keeps radial glow (atmosphere).
// Top accent stripe replaces the card frame. Sectioned with hairlines.

function FormDots({ form, color }) {
  return (
    <div className="flex items-center gap-1">
      {form.map((r, i) => (
        <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: r === "W" ? color : "rgba(255,255,255,0.12)" }} />
      ))}
    </div>
  );
}

function RefreshedPredictionCard({ prediction }) {
  const homeColor = "#552583";
  const awayColor = "#007A33";
  const homeProb = prediction.homeTeam.winProbability;
  const awayProb = prediction.awayTeam.winProbability;
  const homeFavored = homeProb >= awayProb;
  const favoredColor = homeFavored ? homeColor : awayColor;
  const margin = Math.abs(homeProb - awayProb);
  const confidence = margin >= 30 ? "High Confidence" : margin >= 12 ? "Lean" : "Toss-up";

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/15 flex-shrink-0">
            <svg className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Pre-Game Forecast</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] ring-1 ring-white/[0.08] text-[10px] uppercase tracking-[0.12em] font-medium text-text-secondary">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: favoredColor }} />
          {confidence}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/60" />
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 w-56 h-56 rounded-full blur-3xl opacity-25" style={{
          background: `radial-gradient(circle, ${favoredColor} 0%, transparent 70%)`,
          [homeFavored ? "left" : "right"]: "-3rem",
        }} />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <img src={prediction.homeTeam.logoUrl} alt="" className="w-10 h-10 object-contain shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-primary truncate leading-tight">{prediction.homeTeam.shortName}</p>
                <p className="text-[11px] text-text-tertiary leading-tight tabular-nums">{prediction.homeTeam.record} <span className="opacity-60">({prediction.homeTeam.homeRecord} home)</span></p>
                <div className="mt-1"><FormDots form={prediction.homeTeam.recentForm} color={homeColor} /></div>
              </div>
            </div>
            <div className="flex flex-col items-center px-2 shrink-0">
              <span className="text-[10px] uppercase tracking-widest text-text-tertiary">vs</span>
            </div>
            <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-end">
              <div className="min-w-0 text-right">
                <p className="text-sm font-bold text-text-primary truncate leading-tight">{prediction.awayTeam.shortName}</p>
                <p className="text-[11px] text-text-tertiary leading-tight tabular-nums">{prediction.awayTeam.record} <span className="opacity-60">({prediction.awayTeam.awayRecord} away)</span></p>
                <div className="mt-1 flex justify-end"><FormDots form={prediction.awayTeam.recentForm} color={awayColor} /></div>
              </div>
              <img src={prediction.awayTeam.logoUrl} alt="" className="w-10 h-10 object-contain shrink-0" />
            </div>
          </div>

          <div className="mb-5">
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: homeFavored ? homeColor : "rgba(255,255,255,0.35)" }}>{homeProb}%</span>
              <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                {homeFavored ? prediction.homeTeam.shortName : prediction.awayTeam.shortName} favored
              </span>
              <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: !homeFavored ? awayColor : "rgba(255,255,255,0.35)" }}>{awayProb}%</span>
            </div>
            <div className="relative h-3 rounded-full overflow-hidden flex ring-1 ring-white/[0.06]">
              <div className="h-full" style={{ background: homeColor, width: `${homeProb}%` }} />
              <div className="flex-1 h-full" style={{ background: awayColor, opacity: 0.7 }} />
              <div aria-hidden className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-5 bg-white/30" />
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-[10px] uppercase tracking-wider text-text-tertiary mb-2.5">Key Factors</p>
            <ul className="space-y-1.5">
              {prediction.keyFactors.map((factor, i) => {
                const tint = factor.type === "home" ? homeColor : factor.type === "away" ? awayColor : null;
                return (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary leading-relaxed">
                    {tint && <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: tint }} />}
                    <span>{factor.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- TeamComparison (refresh) ----------------

function ComparisonRow({ row, homeColor, awayColor }) {
  const homeBetter = row.lowerBetter ? row.home < row.away : row.home > row.away;
  const awayBetter = !homeBetter;
  const total = row.home + row.away;
  const homePct = (row.home / total) * 100;
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={`w-14 text-right text-sm tabular-nums shrink-0 ${homeBetter ? "font-bold text-text-primary" : "text-text-tertiary"}`}>{row.home}</span>
      <div className="flex-1 flex items-center gap-1 h-2">
        <div className="flex-1 flex justify-end">
          <div className="h-full rounded-l-full" style={{ width: `${homePct}%`, background: homeBetter ? homeColor : "rgba(255,255,255,0.08)" }} />
        </div>
        <div className="flex-1">
          <div className="h-full rounded-r-full" style={{ width: `${100 - homePct}%`, background: awayBetter ? awayColor : "rgba(255,255,255,0.08)" }} />
        </div>
      </div>
      <span className={`w-14 text-left text-sm tabular-nums shrink-0 ${awayBetter ? "font-bold text-text-primary" : "text-text-tertiary"}`}>{row.away}</span>
      <span className="absolute mx-auto left-0 right-0 text-center text-[10px] uppercase tracking-[0.16em] text-text-tertiary font-semibold pointer-events-none">
        {row.label}
      </span>
    </div>
  );
}

function RefreshedTeamComparison({ homeTeam, awayTeam, rows, homeRating, awayRating }) {
  const hasRating = homeRating != null && awayRating != null;
  const ratingRow = hasRating
    ? { label: "★ RATING", home: homeRating, away: awayRating, lowerBetter: false }
    : null;
  const allRows = hasRating ? [ratingRow, ...rows] : rows;
  return (
    <div className="relative overflow-hidden rounded-2xl mt-6 w-full">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/60" />
      <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.04] to-transparent pointer-events-none" />
      <div className="relative p-6 sm:p-8">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-text-tertiary font-semibold">Team Comparison</p>
          <h3 className="text-2xl font-bold tracking-tight text-text-primary mt-1">Season Averages</h3>
        </div>
        <div className="flex items-center justify-between gap-4 py-4 mt-4 border-y border-white/[0.06]">
          <div className="flex items-center gap-3 flex-1">
            <img src={homeTeam.info.logoUrl} alt="" className="w-9 h-9 object-contain" />
            <span className="text-sm font-bold text-text-primary">{homeTeam.info.shortName}</span>
          </div>
          <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-[0.18em]">vs</span>
          <div className="flex items-center gap-3 flex-1 justify-end">
            <span className="text-sm font-bold text-text-primary">{awayTeam.info.shortName}</span>
            <img src={awayTeam.info.logoUrl} alt="" className="w-9 h-9 object-contain" />
          </div>
        </div>
        <div className="mt-4 space-y-1 relative">
          {allRows.map((row, i) => (
            <div key={row.label} className="relative">
              <ComparisonRow row={row} homeColor={homeTeam.info.color} awayColor={awayTeam.info.color} />
              {hasRating && i === 0 && <div className="border-t border-white/[0.06] mt-2 mb-1" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- BoxScore (refresh) ----------------

function RefreshedBoxScore({ team }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3 pb-3 mb-2 border-b border-white/[0.08]">
        <h4 className="text-base font-semibold text-text-primary">{team.name}</h4>
        <button className="touch-target flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 ring-1 ring-accent/20 text-[11px] font-medium text-accent hover:bg-accent/20 transition-colors duration-150">
          PTS ↓
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[600px] w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.05]">
              <th className="py-2 pr-3 text-[10px] uppercase tracking-[0.18em] text-text-tertiary font-semibold">Player</th>
              <th className="py-2 px-2 text-[10px] uppercase tracking-[0.18em] text-text-tertiary font-semibold text-right">RTG</th>
              <th className="py-2 px-2 text-[10px] uppercase tracking-[0.18em] text-text-tertiary font-semibold text-right">MIN</th>
              <th className="py-2 px-2 text-[10px] uppercase tracking-[0.18em] text-accent font-semibold text-right">PTS</th>
              <th className="py-2 px-2 text-[10px] uppercase tracking-[0.18em] text-text-tertiary font-semibold text-right">REB</th>
              <th className="py-2 px-2 text-[10px] uppercase tracking-[0.18em] text-text-tertiary font-semibold text-right">AST</th>
              <th className="py-2 pl-2 text-[10px] uppercase tracking-[0.18em] text-text-tertiary font-semibold text-right">FG</th>
            </tr>
          </thead>
          <tbody>
            {team.players.map((p) => (
              <tr key={p.name} className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors duration-150">
                <td className="py-2.5 pr-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-medium text-text-primary">{p.name}</span>
                    <span className="text-[10px] text-text-tertiary">{p.pos}</span>
                  </div>
                </td>
                <td className="py-2.5 px-2 text-right text-sm font-bold tabular-nums text-accent">{p.rating.toFixed(1)}</td>
                <td className="py-2.5 px-2 text-right text-sm tabular-nums text-text-secondary">{p.min}</td>
                <td className="py-2.5 px-2 text-right text-sm font-bold tabular-nums text-text-primary">{p.pts}</td>
                <td className="py-2.5 px-2 text-right text-sm tabular-nums text-text-secondary">{p.reb}</td>
                <td className="py-2.5 px-2 text-right text-sm tabular-nums text-text-secondary">{p.ast}</td>
                <td className="py-2.5 pl-2 text-right text-sm tabular-nums text-text-secondary">{p.fg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------- PlayByPlay (refresh) ----------------

function FilterPill({ label, active }) {
  return (
    <button className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 ${active ? "bg-accent/15 text-accent ring-1 ring-accent/25" : "bg-white/[0.03] text-text-secondary hover:bg-white/[0.06] hover:text-text-primary"}`}>
      {label}
    </button>
  );
}

function PlayRow({ play, isLastOfPeriod }) {
  const teamColor = play.team === "LAL" ? "#552583" : "#007A33";
  return (
    <div className={`relative flex items-start gap-3 py-3 pl-4 pr-3 transition-colors duration-150 hover:bg-white/[0.02] ${play.scoring ? "bg-white/[0.015]" : ""} ${!isLastOfPeriod ? "border-b border-white/[0.04]" : ""}`}>
      {play.scoring && <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: teamColor }} />}
      <div className="shrink-0 flex flex-col items-center w-14 text-text-tertiary">
        <span className="text-[10px] uppercase tracking-widest font-semibold">Q{play.period}</span>
        <span className="text-xs tabular-nums">{play.clock}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary leading-snug">{play.desc}</p>
      </div>
      {play.score && (
        <div className="shrink-0 text-right">
          <span className="text-sm font-bold tabular-nums text-text-primary">{play.score}</span>
        </div>
      )}
    </div>
  );
}

function RefreshedPlayByPlay({ plays }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/15 flex-shrink-0">
          <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-text-primary">Play by Play</h2>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none min-w-0">
          <FilterPill label="All" active />
          <FilterPill label="Scoring" />
          <FilterPill label="Q1" />
          <FilterPill label="Q2" />
          <FilterPill label="Q3" />
          <FilterPill label="Q4" />
        </div>
        <div className="relative w-full sm:w-56 sm:shrink-0 h-9">
          <div className="absolute inset-0 flex items-center">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Filter by player…" className="w-full bg-white/[0.03] ring-1 ring-white/[0.06] rounded-full text-xs text-text-primary placeholder:text-text-tertiary pl-9 pr-3 py-2 focus:outline-none focus:ring-accent/40 transition-all duration-150" />
          </div>
        </div>
      </div>
      <div className="relative">
        {plays.map((play, idx) => (
          <PlayRow key={play.id} play={play} isLastOfPeriod={idx === plays.length - 1} />
        ))}
      </div>
    </div>
  );
}

// ---------------- AISummary (refresh) ----------------

function RefreshedAISummary({ bullets }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/15 flex-shrink-0">
          <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Game Summary</h2>
          <p className="text-xs text-text-tertiary mt-0.5">AI-generated insights from this matchup</p>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-2xl pl-5">
        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-accent/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="relative p-6 sm:p-8">
          <ul className="space-y-4">
            {bullets.map((text, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-accent rounded-full mt-2 flex-shrink-0" />
                <p className="text-text-secondary text-sm leading-relaxed flex-1">{text}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative px-6 sm:px-8 py-3 border-t border-white/[0.05]">
          <p className="text-[11px] text-text-tertiary">Generated using AI based on official game statistics</p>
        </div>
      </div>
    </div>
  );
}

// ---------------- GameChart (refresh) ----------------

function RefreshedGameChart() {
  return (
    <div className="relative overflow-hidden rounded-2xl mb-10">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/60" />
      <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.04] to-transparent pointer-events-none" />
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="relative inline-flex items-center">
            <select className="appearance-none bg-white/[0.03] ring-1 ring-white/[0.08] rounded-xl text-text-primary text-sm font-semibold px-3 py-1.5 pr-7 min-h-[36px] cursor-pointer hover:ring-white/[0.16] focus:outline-none focus:ring-accent/40">
              <option className="bg-surface-primary">Win Probability</option>
              <option className="bg-surface-primary">Point Differential</option>
            </select>
            <svg className="pointer-events-none absolute right-2 w-3 h-3 text-text-tertiary" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#552583]" />LAL</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#007A33]" />BOS</span>
          </div>
        </div>
        <div className="relative h-[220px] w-full overflow-hidden rounded-lg">
          <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-text-tertiary tabular-nums">
            {[100, 75, 50, 25, 0].map((v) => (
              <div key={v} className="flex items-center gap-3">
                <span className="w-8 text-right">{v}%</span>
                <div className="flex-1 h-px bg-white/[0.04]" />
              </div>
            ))}
          </div>
          <svg className="absolute inset-0 ml-12 mr-2" viewBox="0 0 600 220" preserveAspectRatio="none">
            <path d="M0,110 C100,90 150,70 200,75 C280,82 320,60 380,45 C440,32 500,18 600,12" stroke="#552583" strokeWidth="2.5" fill="none" />
            <path d="M0,110 C100,130 150,150 200,145 C280,138 320,160 380,175 C440,188 500,202 600,208" stroke="#007A33" strokeWidth="2.5" fill="none" opacity="0.7" />
            <line x1="0" y1="110" x2="600" y2="110" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="3,3" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ---------------- Reports (refresh) ----------------
// List container with optional date grouping. Rows are <Link>s with player/team
// avatar, content, and right-aligned relative time. Each row gets a transparent
// left rail that brightens to accent on hover.

function MockPlayerAvatar({ player }) {
  if (player?.imageUrl) {
    return (
      <img
        src={player.imageUrl}
        alt={player.name}
        className="w-9 h-9 rounded-full object-cover bg-surface-overlay/40 ring-1 ring-white/[0.06] shrink-0"
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
    );
  }
  const initials = (player?.name || "?").split(/\s+/).map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-surface-overlay/40 ring-1 ring-white/[0.06] flex items-center justify-center text-[10px] font-semibold text-text-tertiary shrink-0">
      {initials}
    </div>
  );
}

function MockTeamLogo({ team }) {
  if (team?.logoUrl) {
    return (
      <img src={team.logoUrl} alt={team.name} className="w-9 h-9 rounded-full object-contain bg-surface-overlay/40 ring-1 ring-white/[0.06] shrink-0" onError={(e) => { e.currentTarget.style.display = "none"; }} />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-surface-overlay/40 ring-1 ring-white/[0.06] flex items-center justify-center text-[10px] font-semibold text-text-tertiary shrink-0">
      {(team?.abbreviation || "?").slice(0, 3).toUpperCase()}
    </div>
  );
}

function MockNRBadge() {
  return (
    <div className="w-6 h-6 rounded-full bg-surface-overlay/40 ring-1 ring-white/[0.06] flex items-center justify-center text-[9px] font-semibold text-text-tertiary" aria-label="Not on Roster">
      NR
    </div>
  );
}

function relativeTimeMock(iso) {
  const now = new Date("2026-05-11T15:00:00Z").getTime();
  const then = new Date(iso).getTime();
  const diffM = Math.floor((now - then) / 60000);
  if (diffM < 60) return `${diffM}m ago`;
  if (diffM < 1440) return `${Math.floor(diffM / 60)}h ago`;
  return `${Math.floor(diffM / 1440)}d ago`;
}

const STATUS_CLASS = {
  active: "text-win", questionable: "text-accent", doubtful: "text-accent",
  out: "text-loss", ir: "text-loss", suspended: "text-loss", "day-to-day": "text-accent",
};
const STATUS_LABEL = { ir: "Injured Reserve" };

function StatusPillReport({ status }) {
  if (!status) return <span className="text-win">Active</span>;
  const display = STATUS_LABEL[status] || status;
  const baseCls = STATUS_CLASS[status] ?? "text-text-secondary";
  const cls = STATUS_LABEL[status] ? baseCls : `${baseCls} capitalize`;
  return <span className={cls}>{display}</span>;
}

function RowChrome({ children }) {
  return (
    <a href="#" onClick={(e) => e.preventDefault()} className="group relative flex items-start gap-3 pl-4 pr-3 py-3 transition-colors duration-200 hover:bg-white/[0.03]">
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-transparent group-hover:bg-accent transition-colors duration-200" />
      {children}
    </a>
  );
}

function MockInjuryRow({ report }) {
  return (
    <RowChrome>
      <MockPlayerAvatar player={report.player} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary">{report.player.name}</div>
        <div className="text-[13px] text-text-secondary mt-0.5">
          {report.prevStatus === report.newStatus ? (
            <StatusPillReport status={report.newStatus} />
          ) : (
            <>
              <StatusPillReport status={report.prevStatus} />
              <span className="text-text-tertiary mx-1">→</span>
              <StatusPillReport status={report.newStatus} />
            </>
          )}
          {report.newStatusDescription && (
            <span className="text-text-tertiary"> · {report.newStatusDescription}</span>
          )}
        </div>
      </div>
      <span className="text-xs text-text-tertiary shrink-0">{relativeTimeMock(report.date)}</span>
    </RowChrome>
  );
}

function MockMoveRow({ report }) {
  const ACTION_LABEL = { sign: "Signed", waive: "Waived", trade: "Traded" };
  return (
    <RowChrome>
      <MockPlayerAvatar player={report.player} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary">{report.player.name}</div>
        <div className="flex items-center gap-2 mt-1">
          {report.fromTeam ? (
            <img src={report.fromTeam.logoUrl} alt={report.fromTeam.name} className="w-6 h-6 rounded-full object-contain bg-surface-overlay/40 ring-1 ring-white/[0.06]" />
          ) : <MockNRBadge />}
          <span className="text-text-tertiary text-xs">→</span>
          {report.toTeam ? (
            <img src={report.toTeam.logoUrl} alt={report.toTeam.name} className="w-6 h-6 rounded-full object-contain bg-surface-overlay/40 ring-1 ring-white/[0.06]" />
          ) : <MockNRBadge />}
          <span className="text-[11px] uppercase tracking-wider text-text-tertiary ml-1">
            {ACTION_LABEL[report.action] ?? report.action}
          </span>
        </div>
      </div>
      <span className="text-xs text-text-tertiary shrink-0">{relativeTimeMock(report.date)}</span>
    </RowChrome>
  );
}

function MockBirthdayRow({ report }) {
  const ordinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  return (
    <RowChrome>
      <MockPlayerAvatar player={report.player} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary">{report.player.name}</div>
        <div className="text-[13px] text-text-secondary mt-0.5">
          Happy {ordinal(report.age)} Birthday <span aria-hidden>🎉</span>
        </div>
      </div>
      <span className="text-xs text-text-tertiary shrink-0">{relativeTimeMock(report.date)}</span>
    </RowChrome>
  );
}

function MockStreakRow({ report }) {
  const isTeam = !!report.team;
  const subject = isTeam ? report.team : report.player;
  return (
    <RowChrome>
      {isTeam ? <MockTeamLogo team={report.team} /> : <MockPlayerAvatar player={report.player} />}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary">{subject.name}</div>
        <div className="text-[13px] text-text-secondary mt-0.5">
          {report.streakLength}-game {report.statLabel} streak {report.emoji && <span aria-hidden>{report.emoji}</span>}
        </div>
      </div>
      <span className="text-xs text-text-tertiary shrink-0">{relativeTimeMock(report.date)}</span>
    </RowChrome>
  );
}

function MockReportRow({ report }) {
  switch (report.type) {
    case "injury":   return <MockInjuryRow report={report} />;
    case "move":     return <MockMoveRow report={report} />;
    case "birthday": return <MockBirthdayRow report={report} />;
    case "streak":   return <MockStreakRow report={report} />;
    default:         return null;
  }
}

function MockReportsList({ reports, groupByDate = false }) {
  if (!groupByDate) {
    return (
      <div className="flex flex-col divide-y divide-white/[0.04]">
        {reports.map((r) => <MockReportRow key={r.id} report={r} />)}
      </div>
    );
  }
  const dateKey = (iso) => iso.slice(0, 10);
  const dateHeader = (iso) => {
    const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const groups = [];
  let currentKey = null;
  for (const r of reports) {
    const k = dateKey(r.date);
    if (k !== currentKey) { groups.push({ key: k, items: [] }); currentKey = k; }
    groups[groups.length - 1].items.push(r);
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="flex items-baseline justify-between pl-4 pr-3 pb-1.5">
            <h3 className="text-[10px] uppercase tracking-[0.22em] text-text-secondary font-semibold">
              {dateHeader(g.items[0].date)}
            </h3>
            <span className="text-[10px] text-text-tertiary tabular-nums">{g.items.length} update{g.items.length === 1 ? "" : "s"}</span>
          </div>
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {g.items.map((r) => <MockReportRow key={r.id} report={r} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- News (refresh) ----------------

const leaguePlaceholderGradient = {
  nba: "from-[#1a1a0a] to-[#2a1f08]",
  nfl: "from-[#0a100a] to-[#0d1f10]",
  nhl: "from-[#0a0d1a] to-[#0d1428]",
};

function MockNewsCard({ article, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full h-full text-left flex flex-col rounded-2xl overflow-hidden cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/[0.04] hover:-translate-y-0.5"
    >
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-transparent group-hover:bg-accent transition-colors duration-200 z-10" />
      <div className="aspect-[16/9] overflow-hidden">
        {article.imageUrl ? (
          <img src={article.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${leaguePlaceholderGradient[article.league] ?? "from-[#111114] to-[#1a1a1f]"} flex items-center justify-center`}>
            <img src={LEAGUE_LOGOS[article.league]} alt={article.league} className="w-10 h-10 object-contain opacity-20" />
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2.5">
        <p className="text-sm font-semibold text-text-primary leading-snug line-clamp-2">{article.headline}</p>
        <div className="flex items-center gap-2">
          <img src={LEAGUE_LOGOS[article.league]} alt={article.league} className={`${article.league === "nhl" ? "w-[1.5rem] h-[1.5rem]" : "w-3.5 h-3.5"} object-contain`} />
          <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">{LEAGUE_NAMES[article.league]}</span>
          {article.published && (
            <>
              <span className="text-text-tertiary/40 text-[11px]">·</span>
              <span className="text-[11px] text-text-tertiary">{relativeTimeMock(article.published)}</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function MockNewsCardCompact({ article, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full text-left flex items-center gap-3 pl-4 pr-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-white/[0.03] focus:outline-none"
    >
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-transparent group-hover:bg-accent transition-colors duration-200" />
      <div className="shrink-0 w-6 h-6 flex items-center justify-center">
        <img src={LEAGUE_LOGOS[article.league]} alt={article.league} className={`${article.league === "nhl" ? "w-6 h-6" : "w-4 h-4"} object-contain`} />
      </div>
      <p className="flex-1 min-w-0 text-sm font-medium text-text-primary leading-snug line-clamp-2">{article.headline}</p>
      {article.published && (
        <span className="shrink-0 text-[11px] text-text-tertiary tabular-nums">{relativeTimeMock(article.published)}</span>
      )}
    </button>
  );
}

function MockNewsSection({ articles, mode = "expanded" }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[10px] uppercase tracking-[0.22em] text-text-secondary font-semibold">Headlines</h2>
        <button className="text-[11px] uppercase tracking-wide font-semibold text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer">
          {mode === "expanded" ? "Compact" : "Expand"}
        </button>
      </div>
      {mode === "expanded" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {articles.map((article, i) => (
            <MockNewsCard key={i} article={article} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6 sm:divide-x sm:divide-white/[0.04]">
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {articles.slice(0, Math.ceil(articles.length / 2)).map((article, i) => (
              <MockNewsCardCompact key={i} article={article} />
            ))}
          </div>
          <div className="flex flex-col divide-y divide-white/[0.04] sm:pl-6">
            {articles.slice(Math.ceil(articles.length / 2)).map((article, i) => (
              <MockNewsCardCompact key={i} article={article} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MockNewsPreviewModal({ article }) {
  return (
    <div className="relative w-full max-w-lg mx-auto rounded-2xl overflow-hidden ring-1 ring-white/[0.08] bg-surface-elevated shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/60 z-10" />
      <button className="touch-target absolute top-3 right-3 z-10 rounded-full bg-black/40 backdrop-blur text-white/70 hover:text-white transition-colors p-1.5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className={`aspect-[16/9] overflow-hidden bg-gradient-to-br ${leaguePlaceholderGradient[article.league]} flex items-center justify-center`}>
        <img src={LEAGUE_LOGOS[article.league]} alt={article.league} className="w-16 h-16 object-contain opacity-20" />
      </div>
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <img src={LEAGUE_LOGOS[article.league]} alt={article.league} className={`${article.league === "nhl" ? "w-6 h-6" : "w-4 h-4"} object-contain`} />
          <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">{LEAGUE_NAMES[article.league]}</span>
          {article.published && (
            <>
              <span className="text-text-tertiary/40 text-xs">·</span>
              <span className="text-xs text-text-tertiary">{relativeTimeMock(article.published)}</span>
            </>
          )}
        </div>
        <h2 className="text-lg font-bold text-text-primary leading-snug">{article.headline}</h2>
        {article.description && (
          <p className="text-sm text-text-secondary leading-relaxed">{article.description}</p>
        )}
        <a href="#" onClick={(e) => e.preventDefault()} className="inline-flex items-center gap-2 self-start bg-accent text-white font-semibold px-5 py-2.5 rounded-full transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-accent-hover hover:shadow-[0_0_24px_rgba(232,134,58,0.3)] text-sm mt-1">
          <span>Read Full Article</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}

// ---------------- Layout helpers ----------------

function SectionHeader({ kicker, title, sub }) {
  return (
    <div className="space-y-1 pb-2">
      <p className="text-[10px] uppercase tracking-[0.22em] text-text-tertiary font-semibold">{kicker}</p>
      <h2 className="text-lg font-semibold tracking-tight text-text-primary">{title}</h2>
      {sub && <p className="text-sm text-text-secondary">{sub}</p>}
    </div>
  );
}

// ---------------- Page ----------------

export default function MockCards() {
  return (
    <div className="min-h-screen bg-surface-primary text-text-primary py-12 px-6">
      <div className="max-w-[1400px] mx-auto space-y-16">
        <header className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.25em] text-text-tertiary">Visual exploration · left-rail refresh</p>
          <h1 className="text-3xl font-semibold tracking-tight">Refresh — across components</h1>
          <p className="text-text-secondary text-sm max-w-3xl">
            Specs in <code>docs/refresh-design.md</code>. Hover each card to see the interaction state.
          </p>
        </header>

        <section className="space-y-4">
          <SectionHeader kicker="01" title="GameCard" sub="Left rail · NBA Finals example. Right-column rating (matches StatCard treatment) when game.grade is set. Hover expands the quarter breakdown." />
          <RailGameCard game={mockGame} />
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="02" title="StatCard" sub="Playoff example — accent rail brightens on hover." />
          <RailStatCard stat={mockStat} />
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="03" title="PlayerAvgCard" sub="Hero card — no rail. Top accent stripe + atmospheric gradient." />
          <div className="max-w-md mx-auto"><RefreshedPlayerAvgCard averages={mockAverages} season="2025-26" /></div>
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="04" title="SimilarPlayersCard" sub="List container — no chrome. Each row gets an accent rail on hover." />
          <div className="max-w-sm mx-auto"><RefreshedSimilarPlayersCard players={mockSimilarPlayers} /></div>
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="05" title="PlayerAwardsCard" sub="Sectioned list. Legendary section gets an accent rail to elevate it." />
          <div className="max-w-2xl mx-auto"><RefreshedPlayerAwardsCard groups={mockAwardGroups} /></div>
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="06" title="RosterGrid" sub="Card grid — chrome removed. Oversized jersey number stays as the visual anchor. Subtle rail-on-hover." />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockRoster.map((p) => <RefreshedRosterCard key={p.id} player={p} />)}
          </div>
        </section>

        <div className="pt-12 border-t border-accent/20">
          <p className="text-[10px] uppercase tracking-[0.25em] text-accent font-semibold mb-1">GamePage · top of page</p>
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Header, info, tabs, rating, scoreboard</h2>
        </div>

        <section className="space-y-4">
          <SectionHeader kicker="07" title="GameMatchupHeader" sub="NBA Finals state — game rating badge (★ + tier) in the center column, trophy + accent label, series dots, subtle accent gradient wrap." />
          <RefreshedGameMatchupHeader homeTeam={mockHomeTeam} awayTeam={mockAwayTeam} game={mockGameDetail} league="nba" isFinal gameRating={mockGameRating} />
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="08" title="GameInfoCard" sub="Metadata strip — left accent rail + hairline-separated rows." />
          <div className="max-w-2xl mx-auto"><RefreshedGameInfoCard game={mockGameDetail} /></div>
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="09" title="GameTabBar" sub="Already minimal — accent underline indicator. Kept as-is." />
          <div className="max-w-2xl mx-auto"><MockGameTabBar activeTab="overview" /></div>
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="10" title="Quarter scoreboard" sub="Data table — chrome removed. Header underline + inner hairlines are the structure." />
          <div className="max-w-2xl mx-auto"><RefreshedQuarterScoreboard homeTeam={mockHomeTeam} awayTeam={mockAwayTeam} game={mockGameDetail} /></div>
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="11" title="Prediction Locked stripe" sub="Pre-game edge case. Existing diagonal stripes + radial glow kept — they're the atmosphere. Adds left accent rail." />
          <div className="max-w-2xl mx-auto"><RefreshedPredictionLocked /></div>
        </section>

        <div className="pt-12 border-t border-accent/20">
          <p className="text-[10px] uppercase tracking-[0.25em] text-accent font-semibold mb-1">GamePage · tab content</p>
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Overview / Analysis / Plays</h2>
        </div>

        <section className="space-y-4">
          <SectionHeader kicker="12" title="TopPerformerCard" sub="List-item card. Drops outer chrome but KEEPS the colored gradient slab on the left — it's already the rail." />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {mockTopPerformers.map((t) => <RefreshedTopPerformerCard key={t.title} title={t.title} color={t.color} player={t.player} />)}
          </div>
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="13" title="PredictionCard" sub="Pre-game hero. Top accent stripe + radial glow (kept — it's the atmosphere). Sectioned with internal hairlines." />
          <div className="max-w-2xl mx-auto"><RefreshedPredictionCard prediction={mockPrediction} /></div>
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="14" title="TeamComparison" sub="Hero/sectioned comparison. Top accent stripe + bidirectional stat bars with team colors. ★ RATING row now sits at the top above the season stats (game-specific team grades from gameRating)." />
          <div className="max-w-3xl mx-auto"><RefreshedTeamComparison homeTeam={mockHomeTeam} awayTeam={mockAwayTeam} rows={mockTeamComparisonRows} homeRating={mockGameRating.home.grade} awayRating={mockGameRating.away.grade} /></div>
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="15" title="BoxScore (single team)" sub="Data table — chrome removed. Header underline + scoring-column accent + zebra hover. PTS column tinted accent (the sort key)." />
          <div className="max-w-3xl mx-auto"><RefreshedBoxScore team={mockBoxScoreTeam} /></div>
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="16" title="PlayByPlay" sub="List container — no chrome. Scoring plays get a team-color left rail; non-scoring plays sit flat. Filter pills + search retain their pill chrome (form elements)." />
          <div className="max-w-3xl mx-auto"><RefreshedPlayByPlay plays={mockPlays} /></div>
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="17" title="AISummary" sub="Narrative block — left accent rail + atmospheric gradient. Footer hairline replaces the bg-surface-base/40 strip." />
          <div className="max-w-3xl mx-auto"><RefreshedAISummary bullets={mockAISummaryBullets} /></div>
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="18" title="GameChart (Win Probability)" sub="Chart card — top accent stripe + atmospheric gradient. Dropdown keeps its own pill chrome (form element). Mock SVG curve in place of recharts." />
          <div className="max-w-3xl mx-auto"><RefreshedGameChart /></div>
        </section>

        <div className="pt-12 border-t border-accent/20">
          <p className="text-[10px] uppercase tracking-[0.25em] text-accent font-semibold mb-1">Reports</p>
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Player & team activity feed</h2>
        </div>

        <section className="space-y-4">
          <SectionHeader kicker="19" title="ReportRow variants" sub="Injury, Move, Birthday, Streak (player & team) — all share the same row chrome. Hover reveals an accent rail on the left." />
          <div className="max-w-2xl mx-auto">
            <MockReportsList reports={mockReports} />
          </div>
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="20" title="ReportsList — date grouped" sub="Group header pattern matches GameCard feed: kicker + right-aligned update count. Rows divided by hairlines instead of card chrome." />
          <div className="max-w-2xl mx-auto">
            <MockReportsList reports={mockReports} groupByDate />
          </div>
        </section>

        <div className="pt-12 border-t border-accent/20">
          <p className="text-[10px] uppercase tracking-[0.25em] text-accent font-semibold mb-1">Homepage · News</p>
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Headlines feed</h2>
        </div>

        <section className="space-y-4">
          <SectionHeader kicker="21" title="NewsSection — Expanded" sub="4-col grid of featured cards. Chrome dropped; image stays as the visual anchor, hover reveals an accent rail + subtle lift." />
          <MockNewsSection articles={mockNews.slice(0, 4)} mode="expanded" />
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="22" title="NewsSection — Compact" sub="2-col list of headline rows. Drops the bg-white/[0.06] container that previously faked separators via gap-px; uses divide-x + divide-y hairlines directly. Rows get the same hover rail as ReportRow." />
          <MockNewsSection articles={mockNews} mode="compact" />
        </section>

        <section className="space-y-4 pt-8 border-t border-white/[0.06]">
          <SectionHeader kicker="23" title="NewsPreviewModal" sub="Modal overlay — keeps surface fill + shadow elevation (modals genuinely need chrome to read as occluding the page). Border swapped to ring; top accent stripe added." />
          <MockNewsPreviewModal article={mockNews[0]} />
        </section>

        <section className="space-y-3 pt-8 border-t border-white/[0.06] text-sm text-text-secondary leading-relaxed">
          <h2 className="text-base font-semibold text-text-primary">Pattern summary</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li><strong className="text-text-primary">List-item cards</strong> (GameCard, StatCard, RosterCard, TopPerformerCard) — left rail as state delimiter, brightens on hover. TopPerformerCard's gradient slab IS the rail.</li>
            <li><strong className="text-text-primary">List containers</strong> (SimilarPlayersCard, PlayByPlay) — chrome removed; rows get rail-on-hover or team-color rail when meaningful (scoring plays).</li>
            <li><strong className="text-text-primary">Sectioned lists</strong> (PlayerAwardsCard) — chrome removed; an internal section can use a rail to elevate it.</li>
            <li><strong className="text-text-primary">Hero/standalone cards</strong> (PlayerAvgCard, GameRatingCard, PredictionCard, TeamComparison, GameChart) — no rail. Top accent stripe + atmospheric gradient + accent heading. Existing radial glows (PredictionCard) stay as part of the atmosphere.</li>
            <li><strong className="text-text-primary">Metadata strips</strong> (GameInfoCard) — chrome removed; left accent rail + hairline-separated rows.</li>
            <li><strong className="text-text-primary">Atmospheric layout blocks</strong> (GameMatchupHeader) — not a card, but Finals games get a subtle accent gradient wrap.</li>
            <li><strong className="text-text-primary">Narrative blocks</strong> (AISummary) — left accent rail + atmospheric gradient; footer hairline replaces footer chrome.</li>
            <li><strong className="text-text-primary">Status stripes</strong> (Prediction Locked) — keep existing diagonal stripes + radial glow; add left accent rail.</li>
            <li><strong className="text-text-primary">Data tables</strong> (Quarter scoreboard, BoxScore) — chrome removed; header underline + inner hairlines as the structure. Accent-tinted sort/sticky column.</li>
            <li><strong className="text-text-primary">Form elements</strong> (filter pills, search inputs, select dropdowns inside PlayByPlay/GameChart) — keep their pill/ring chrome. They're not cards; they're interactive controls and need affordance.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
