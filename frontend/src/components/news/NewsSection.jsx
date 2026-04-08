import { useState } from "react";
import { m } from "framer-motion";
import { useNews } from "../../hooks/data/useNews.js";
import { containerVariants, itemVariants } from "../../utils/motion.js";
import NewsCard from "./NewsCard.jsx";
import NewsCardSkeleton from "../skeletons/NewsCardSkeleton.jsx";
import NewsPreviewModal from "./NewsPreviewModal.jsx";

export default function NewsSection() {
  const { articles, loading, error } = useNews();
  const [selected, setSelected] = useState(null);

  if (error || (!loading && articles.length === 0)) return null;

  return (
    <div className="mb-14">
      <h2 className="text-xs uppercase tracking-widest text-text-tertiary font-semibold mb-4">
        Headlines
      </h2>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <m.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {articles.map((article, i) => (
            <m.div key={`${article.league}-${i}`} variants={itemVariants}>
              <NewsCard article={article} onClick={() => setSelected(article)} />
            </m.div>
          ))}
        </m.div>
      )}

      <NewsPreviewModal article={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
