import { useEffect, useRef } from "react";
import { m, AnimatePresence } from "framer-motion";
import { useChat } from "../../context/ChatContext.jsx";
import MessageBubble from "./MessageBubble.jsx";

const SUGGESTED = [
  "Who leads the NBA in scoring this season?",
  "How have the Celtics been playing lately?",
  "Compare LeBron James and Stephen Curry",
];

const listVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function ChatMessages({ onSuggest }) {
  const { messages, isStreaming } = useChat();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto overscroll-y-contain scrollbar-thin px-4 py-4 flex flex-col">
      <AnimatePresence>
        {messages.length === 0 && (
          <m.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col py-2"
          >
            <m.div
              className="flex flex-col items-center text-center mb-6 pt-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="w-11 h-11 rounded-2xl bg-accent/[0.12] border border-accent/[0.15] flex items-center justify-center mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <p className="text-text-primary text-[15px] font-semibold tracking-tight">Hey, I'm Sid</p>
              <p className="text-text-tertiary text-xs mt-1">Scorva Intelligence Dashboard</p>
              <p className="text-text-tertiary/60 text-[11px] mt-2 leading-relaxed max-w-[240px]">
                Ask me anything about stats, matchups, player comparisons, and team form
              </p>
            </m.div>

            <m.div
              className="flex flex-col gap-2"
              variants={listVariants}
              initial="hidden"
              animate="visible"
            >
              {SUGGESTED.map((q) => (
                <m.button
                  key={q}
                  variants={itemVariants}
                  onClick={() => onSuggest(q)}
                  whileHover={{ x: 4, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 text-left text-sm text-text-secondary bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-accent/[0.25] rounded-xl px-3.5 py-2.5 transition-colors duration-200 group/chip"
                >
                  <span className="flex-1">{q}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-transparent group-hover/chip:text-accent/60 transition-colors duration-200 flex-shrink-0">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </m.button>
              ))}
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {messages.map((msg, i) => {
          const isLastAssistant =
            msg.role === "assistant" && i === messages.length - 1;
          return (
            <MessageBubble
              key={msg.id ?? i}
              role={msg.role}
              content={msg.content}
              isError={msg.isError}
              isStreaming={isStreaming && isLastAssistant}
              statusText={isStreaming && isLastAssistant ? msg.statusText : null}
            />
          );
        })}
      </AnimatePresence>

      <div ref={bottomRef} />
    </div>
  );
}
