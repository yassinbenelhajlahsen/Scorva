import { useEffect, useState } from "react";
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
      ) : (
        <m.div
          key="compact"
          className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6 sm:divide-x sm:divide-white/[0.04]"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {visible.slice(0, Math.ceil(visible.length / 2)).map((article, i) => (
              <m.div key={`${article.league}-${i}`} variants={itemVariants}>
                <NewsCardCompact
                  article={article}
                  onClick={() => setSelected(article)}
                />
              </m.div>
            ))}
          </div>
          <div className="flex flex-col divide-y divide-white/[0.04] sm:pl-6">
            {visible.slice(Math.ceil(visible.length / 2)).map((article, i) => (
              <m.div key={`${article.league}-${i}`} variants={itemVariants}>
                <NewsCardCompact
                  article={article}
                  onClick={() => setSelected(article)}
                />
              </m.div>
            ))}
          </div>
        </m.div>
      )}

      {showToggle && !loading && (
        <button
          onClick={() => setShowAllMobile((v) => !v)}
          className="mt-3 w-full text-center text-xs font-semibold uppercase tracking-wide text-text-secondary py-3 rounded-xl border border-white/[0.08] bg-surface-elevated hover:bg-surface-overlay hover:border-white/[0.14] transition-colors cursor-pointer"
        >
          {showAllMobile ? "Show less" : "Show more"}
        </button>
      )}

      <NewsPreviewModal article={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
