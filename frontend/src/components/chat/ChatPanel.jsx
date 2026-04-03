import { useEffect, useRef } from "react";
import { m, useAnimation } from "framer-motion";
import { useChat } from "../../context/ChatContext.jsx";
import ChatMessages from "./ChatMessages.jsx";
import ChatInput from "./ChatInput.jsx";
import { useChatActions } from "../../hooks/ai/useChatActions.js";

export default function ChatPanel({ onClose }) {
  const { resetConversation, isStreaming, messages } = useChat();
  const { sendMessage } = useChatActions();
  const restartControls = useAnimation();
  const panelRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Lock scroll on html + body so background page can't scroll while panel is open
  useEffect(() => {
    const isMobile = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 639px)").matches;
    if (!isMobile) return;
    const htmlEl = document.documentElement;
    const prevHtml = htmlEl.style.overflow;
    const prevBody = document.body.style.overflow;
    htmlEl.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      htmlEl.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  // Keep the panel anchored to the visual viewport on iOS — when the software keyboard
  // opens it shrinks the visual viewport while the layout viewport stays fixed, causing
  // fixed elements to slide partially off-screen and revealing the page background.
  // The visualViewport API lets us track the real visible area and compensate.
  useEffect(() => {
    const isMobile = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 639px)").matches;
    if (!isMobile || !window.visualViewport) return;
    const panel = panelRef.current;
    if (!panel) return;
    const vv = window.visualViewport;

    function update() {
      panel.style.top = `${vv.offsetTop}px`;
      panel.style.height = `${vv.height}px`;
    }

    update();
    vv.addEventListener("resize", update, { passive: true });
    vv.addEventListener("scroll", update, { passive: true });
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      panel.style.top = "";
      panel.style.height = "";
    };
  }, []);

  function handleSuggest(q) {
    sendMessage(q);
  }

  async function handleReset() {
    if (isStreaming) return;
    restartControls.set({ rotate: 0 });
    resetConversation();
  }

  return (
    <m.div
      initial={{ opacity: 0, x: 48, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, scale: 0.97 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      ref={panelRef}
      className="fixed top-0 right-0 bottom-0 z-[90] w-full sm:w-[380px] bg-surface-elevated border-l border-white/[0.08] shadow-[-40px_0_80px_rgba(0,0,0,0.55)] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 border-b border-white/[0.06] flex-shrink-0 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5">
          <div className="relative w-5 h-5 flex items-center justify-center flex-shrink-0">
            <span
              className="absolute inset-0 rounded-full bg-accent/30 animate-ping"
              style={{ animationDuration: "2.4s" }}
            />
            <span className="w-2 h-2 rounded-full bg-accent relative z-10" />
          </div>
          <span className="text-sm font-semibold text-text-primary tracking-tight">Scorva AI</span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={handleReset}
            disabled={isStreaming}
            title="New conversation"
            aria-label="New conversation"
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:bg-white/[0.06] transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed ${messages.length === 0 ? "invisible" : ""}`}
          >
            <m.svg
              animate={restartControls}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </m.svg>
          </button>

          <button
            onClick={onClose}
            aria-label="Close chat"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:bg-white/[0.06] transition-all duration-200"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="4" x2="16" y2="16" />
              <line x1="16" y1="4" x2="4" y2="16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <ChatMessages onSuggest={handleSuggest} />

      {/* Input */}
      <ChatInput />

      {/* Footer */}
      <p className="text-center text-[11px] text-text-tertiary/60 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-1 flex-shrink-0">
        AI-generated — verify important stats before relying on them
      </p>
    </m.div>
  );
}
