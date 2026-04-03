import { useState, useRef, useEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
import { useChat } from "../../context/ChatContext.jsx";
import { useChatActions } from "../../hooks/ai/useChatActions.js";

export default function ChatInput() {
  const { isStreaming } = useChat();
  const { sendMessage, cancelStream } = useChatActions();
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [text]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    sendMessage(trimmed);
    setText("");
  }

  return (
    <div className="px-3 pb-3 pt-2 border-t border-white/[0.06] flex-shrink-0">
      <div className="flex items-end gap-2 bg-white/[0.05] ring-1 ring-white/[0.08] rounded-xl px-3 py-2 transition-[box-shadow,background-color] duration-200 focus-within:bg-white/[0.07] focus-within:ring-white/[0.2]">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about NBA, NFL, or NHL…"
          rows={1}
          disabled={isStreaming}
          className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary/70 text-base resize-none outline-none leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200"
          style={{ maxHeight: 96 }}
        />

        <AnimatePresence mode="wait" initial={false}>
          {isStreaming ? (
            <m.button
              key="stop"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              onClick={cancelStream}
              aria-label="Stop generating"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.88 }}
              className="relative flex-shrink-0 w-7 h-7 rounded-lg bg-[#ff453a]/10 hover:bg-[#ff453a]/20 border border-[#ff453a]/25 hover:border-[#ff453a]/50 flex items-center justify-center transition-colors duration-200"
            >
              <span
                className="absolute inset-0 rounded-lg border border-[#ff453a]/40 animate-ping pointer-events-none"
                style={{ animationDuration: "1.8s" }}
              />
              <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor" className="text-[#ff453a] relative z-10">
                <rect x="0" y="0" width="9" height="9" rx="1.5" />
              </svg>
            </m.button>
          ) : text.trim() ? (
            <m.button
              key="send"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              onClick={submit}
              aria-label="Send message"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="flex-shrink-0 w-7 h-7 rounded-lg bg-accent hover:bg-accent-hover flex items-center justify-center transition-colors duration-200"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </m.button>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
