import { m, AnimatePresence } from "framer-motion";

export default function ChatFAB({ onClick, isOpen }) {
  return (
    <m.button
      onClick={onClick}
      aria-label={isOpen ? "Close AI chat" : "Open AI chat"}
      className="fixed bottom-6 right-6 z-[90] w-14 h-14 rounded-full bg-accent hover:bg-accent-hover text-white shadow-[0_4px_20px_rgba(232,134,58,0.4)] hover:shadow-[0_6px_32px_rgba(232,134,58,0.6)] transition-[background-color,box-shadow] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] flex items-center justify-center"
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.93 }}
    >
      {/* Beacon pulse — only when closed */}
      <AnimatePresence>
        {!isOpen && (
          <m.span
            className="absolute inset-0 rounded-full bg-accent pointer-events-none"
            initial={{ scale: 1, opacity: 0.35 }}
            animate={{ scale: 1.65, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeOut",
              repeatDelay: 0.8,
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={isOpen ? "close" : "chat"}
          initial={{ opacity: 0, rotate: -25, scale: 0.65 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 25, scale: 0.65 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {isOpen ? (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="4" x2="16" y2="16" />
              <line x1="16" y1="4" x2="4" y2="16" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )}
        </m.span>
      </AnimatePresence>
    </m.button>
  );
}
