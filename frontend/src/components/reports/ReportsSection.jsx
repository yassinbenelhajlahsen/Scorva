import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFns } from "../../lib/query.js";
import { useReports } from "../../hooks/data/useReports.js";
import ReportsList from "./ReportsList.jsx";
import leagueData from "../../utils/leagueData.js";

const LEAGUES = ["nba", "nfl", "nhl"];

export default function ReportsSection() {
  const queryClient = useQueryClient();
  const { reports, loading, error } = useReports({ limit: 5 });

  if (error || (!loading && reports.length === 0)) return null;

  function prefetchLeague(l) {
    queryClient.prefetchQuery({
      queryKey: queryKeys.reports(l, undefined, 20, 0),
      queryFn: queryFns.reports(l, undefined, 20, 0),
      staleTime: 10_000,
    });
  }

  return (
    <div className="mb-14">
      <h2 className="text-xs uppercase tracking-widest text-text-tertiary font-semibold mb-4">
        Reports
      </h2>

      <ReportsList reports={reports} groupByDate={false} loading={loading} skeletonCount={5} />

      {!loading && reports.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          {LEAGUES.map((l) => {
            const data = leagueData[l];
            return (
              <Link
                key={l}
                to={`/${l}?tab=reports`}
                onMouseEnter={() => prefetchLeague(l)}
                className="inline-flex items-center gap-2 bg-surface-elevated hover:bg-surface-overlay border border-white/[0.08] hover:border-white/[0.14] text-text-primary font-medium px-5 py-2.5 rounded-full text-sm transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              >
                {data?.logo && <img src={data.logo} alt="" className="w-4 h-4 object-contain" />}
                <span>View {l.toUpperCase()} Reports</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
