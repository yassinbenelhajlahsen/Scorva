import { useEffect } from "react";
import { createPortal } from "react-dom";
import { m, AnimatePresence } from "framer-motion";
import leagueData from "../../utils/leagueData.js";
import { relativeTime } from "../../utils/relativeTime.js";

export default function NewsPreviewModal({ article, onClose }) {
  useEffect(() => {
    if (!article) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [article, onClose]);

  return createPortal(
    <AnimatePresence>
      {article && (
        <m.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-[max(1rem,calc(1rem+env(safe-area-inset-top)))] pb-[max(1rem,calc(1rem+env(safe-area-inset-bottom)))]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <m.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <m.div
            className="relative w-full max-w-lg bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] overflow-hidden"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="touch-target absolute top-3 right-3 z-10 rounded-full bg-black/40 backdrop-blur text-white/70 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Image */}
            {article.imageUrl && (
              <div className="aspect-[16/9] overflow-hidden">
                <img
                  src={article.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Content */}
            <div className="p-6 flex flex-col gap-4">
              {/* League + time */}
              <div className="flex items-center gap-2">
                <img
                  src={leagueData[article.league]?.logo}
                  alt={article.league}
                  className={`${article.league === "nhl" ? "w-6 h-6" : "w-4 h-4"} object-contain`}
                />
                <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
                  {leagueData[article.league]?.name}
                </span>
                {article.published && (
                  <>
                    <span className="text-text-tertiary/40 text-xs">&middot;</span>
                    <span className="text-xs text-text-tertiary">
                      {relativeTime(article.published)}
                    </span>
                  </>
                )}
              </div>

              <h2 className="text-lg font-bold text-text-primary leading-snug">
                {article.headline}
              </h2>

              {article.description && (
                <p className="text-sm text-text-secondary leading-relaxed">
                  {article.description}
                </p>
              )}

              {article.url && (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 self-start bg-accent text-white font-semibold px-5 py-2.5 rounded-full transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-accent-hover hover:shadow-[0_0_24px_rgba(232,134,58,0.3)] text-sm mt-1"
                >
                  <span>Read Full Article</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
