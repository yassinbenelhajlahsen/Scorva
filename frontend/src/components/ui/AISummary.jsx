import { useEffect, useState } from "react";
import axios from "axios";

/**
 * AISummary Component
 *
 * Displays AI-generated game summary between quarter-by-quarter scores and box score.
 *
 * DESIGN GOALS:
 * - Clean, analytics-platform aesthetic (NOT chatbot-style)
 * - Lazy loading (only fetches when component mounts)
 * - Graceful error handling
 * - Loading skeleton for better UX
 * - Subtle footer attribution
 * - Bullet point formatting for easy scanning
 *
 * STATES:
 * - Loading: skeleton placeholder
 * - Success: display summary text
 * - Error: fallback message
 */

export default function AISummary({ gameId }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchSummary() {
      if (!gameId) return;

      try {
        setLoading(true);
        setError(false);

        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/games/${gameId}/ai-summary`
        );

        setSummary(response.data.summary);
      } catch (err) {
        console.error("Error fetching AI summary:", err);
        setError(true);
        setSummary("AI summary unavailable for this game.");
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, [gameId]);

  // Parse bullet points from summary text
  const parseBulletPoints = (text) => {
    if (!text) return [];

    // Split by common bullet point markers and clean up
    const lines = text
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        // Remove common bullet markers (-, •, *, numbers)
        return line.replace(/^[-•*]\s*/, "").replace(/^\d+\.\s*/, "");
      })
      .filter((line) => line.length > 0);

    return lines;
  };

  // Don't render anything if there's no gameId
  if (!gameId) return null;

  const bulletPoints = parseBulletPoints(summary);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 my-12">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Game Summary</h2>
          <p className="text-sm text-gray-400">Key insights from the matchup</p>
        </div>
      </div>

      {/* Summary Content Card */}
      <div className="bg-zinc-900/50 backdrop-blur-sm rounded-xl border border-zinc-700/50 shadow-2xl overflow-hidden">
        <div className="p-6 sm:p-8">
          {loading ? (
            // Loading skeleton
            <div className="space-y-4">
              <div className="flex gap-3 animate-pulse">
                <div className="w-2 h-2 bg-orange-500/50 rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-zinc-700/50 rounded w-full"></div>
                  <div className="h-4 bg-zinc-700/50 rounded w-5/6"></div>
                </div>
              </div>
              <div className="flex gap-3 animate-pulse">
                <div className="w-2 h-2 bg-orange-500/50 rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-zinc-700/50 rounded w-full"></div>
                  <div className="h-4 bg-zinc-700/50 rounded w-4/6"></div>
                </div>
              </div>
              <div className="flex gap-3 animate-pulse">
                <div className="w-2 h-2 bg-orange-500/50 rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-zinc-700/50 rounded w-full"></div>
                  <div className="h-4 bg-zinc-700/50 rounded w-3/6"></div>
                </div>
              </div>
            </div>
          ) : error ? (
            // Error state
            <div className="flex items-start gap-3 text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-base leading-relaxed">{summary}</p>
            </div>
          ) : bulletPoints.length > 0 ? (
            // Success state - display as bullet points
            <ul className="space-y-4">
              {bulletPoints.map((point, index) => (
                <li key={index} className="flex items-start gap-3 group">
                  <div className="w-2 h-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-full mt-2 flex-shrink-0 group-hover:scale-125 transition-transform duration-200"></div>
                  <p className="text-gray-200 text-base leading-relaxed flex-1">
                    {point}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            // Fallback for non-bullet format
            <div className="text-gray-200">
              <p className="text-base leading-relaxed">{summary}</p>
            </div>
          )}
        </div>

        {/* Attribution footer */}
        {!loading && (
          <div className="px-6 sm:px-8 py-4 bg-zinc-900/60 border-t border-zinc-700/30">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-gray-500 flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Generated using AI based on official game statistics
              </p>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
