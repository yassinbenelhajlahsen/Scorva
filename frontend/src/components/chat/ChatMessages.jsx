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
    <AnimatePresence mode="wait" initial={false}>
      {messages.length === 0 ? (
        <m.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-y-auto px-4 py-6 flex flex-col"
        >
          <m.div
            className="mb-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-text-secondary text-sm font-medium mb-1">Ask me anything</p>
            <p className="text-text-tertiary text-xs leading-relaxed">
              Stats, matchups, player comparisons, team form
            </p>
          </m.div>

          <m.div
            className="flex flex-col gap-2"
            variants={listVariants}
            initial="hidden"
            animate="visible"
          >
            <m.p variants={itemVariants} className="text-text-tertiary text-[11px] uppercase tracking-widest mb-0.5 text-center mt-5">
              Suggestions
            </m.p>
            {SUGGESTED.map((q) => (
              <m.button
                key={q}
                variants={itemVariants}
                onClick={() => onSuggest(q)}
                whileHover={{ x: 4, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } }}
                whileTap={{ scale: 0.98 }}
                className="text-left text-sm text-text-secondary bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.15] rounded-xl px-3.5 py-2.5 transition-colors duration-200"
              >
                {q}
              </m.button>
            ))}
          </m.div>
        </m.div>
      ) : (
        <m.div
          key="messages"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-y-auto px-4 py-4"
        >
          {messages.map((msg, i) => {
            const isLastAssistant =
              msg.role === "assistant" && i === messages.length - 1;
            return (
              <MessageBubble
                key={i}
                role={msg.role}
                content={msg.content}
                isError={msg.isError}
                isStreaming={isStreaming && isLastAssistant}
              />
            );
          })}
          <div ref={bottomRef} />
        </m.div>
      )}
    </AnimatePresence>
  );
}
