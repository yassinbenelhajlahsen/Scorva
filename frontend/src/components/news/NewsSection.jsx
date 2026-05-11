import { Fragment, useEffect, useState } from "react";
import { m } from "framer-motion";
import { useNews } from "../../hooks/data/useNews.js";
import { containerVariants, itemVariants } from "../../utils/motion.js";
import NewsCard from "./NewsCard.jsx";
import NewsCardCompact from "./NewsCardCompact.jsx";
import NewsCardSkeleton from "../skeletons/NewsCardSkeleton.jsx";
import NewsPreviewModal from "./NewsPreviewModal.jsx";

const MOBILE_COLLAPSED_COUNT = 4;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 639px)").matches;
  });

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export default function NewsSection() {
  const { articles, loading, error } = useNews();
  const [selected, setSelected] = useState(null);
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const [showAllMobile, setShowAllMobile] = useState(false);

  useEffect(() => {
    setExpanded(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    setShowAllMobile(false);
  }, [isMobile]);

  if (error || (!loading && articles.length === 0)) return null;

  const visible =
    isMobile && !showAllMobile
      ? articles.slice(0, MOBILE_COLLAPSED_COUNT)
      : articles;
  const showToggle = isMobile && articles.length > MOBILE_COLLAPSED_COUNT;

  return (
    <div className="mb-14">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[10px] uppercase tracking-[0.22em] text-text-secondary font-semibold">
          Headlines
        </h2>
        {!loading && articles.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] uppercase tracking-wide font-semibold text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
          >
            {expanded ? "Compact" : "Expand"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      ) : expanded ? (
        <m.div
          key="expanded"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {visible.map((article, i) => (
            <m.div key={`${article.league}-${i}`} variants={itemVariants}>
              <NewsCard article={article} onClick={() => setSelected(article)} />
            </m.div>
          ))}
        </m.div>
      ) : (() => {
        const half = Math.ceil(visible.length / 2);
        return (
          <m.div
            key="compact"
            className="grid grid-cols-1 sm:grid-cols-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {Array.from({ length: half }).map((_, rowIdx) => {
              const left = visible[rowIdx];
              const right = visible[rowIdx + half];
              const isLastRow = rowIdx === half - 1;
              const rowBorder = isLastRow ? "" : "border-b border-white/[0.04]";
              return (
                <Fragment key={`row-${rowIdx}`}>
                  <m.div className={`flex ${rowBorder}`} variants={itemVariants}>
                    <NewsCardCompact
                      article={left}
                      onClick={() => setSelected(left)}
                    />
                  </m.div>
                  <m.div
                    className={`flex sm:border-l sm:border-white/[0.04] ${rowBorder}`}
                    variants={itemVariants}
                  >
                    {right ? (
                      <NewsCardCompact
                        article={right}
                        onClick={() => setSelected(right)}
                      />
                    ) : null}
                  </m.div>
                </Fragment>
              );
            })}
          </m.div>
        );
      })()}

      {showToggle && !loading && (
        <button
          onClick={() => setShowAllMobile((v) => !v)}
          className="mt-3 w-full text-center text-xs font-semibold uppercase tracking-wide text-text-secondary py-3 rounded-xl ring-1 ring-white/[0.06] bg-white/[0.03] hover:ring-white/[0.14] hover:bg-white/[0.06] transition-colors cursor-pointer"
        >
          {showAllMobile ? "Show less" : "Show more"}
        </button>
      )}

      <NewsPreviewModal article={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
