import { m } from "framer-motion";
import ChatTypingIndicator from "./ChatTypingIndicator.jsx";

function renderContent(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function MessageBubble({ role, content, isError, isStreaming, statusText }) {
  const isUser = role === "user";
  const isEmpty = !content;

  return (
    <m.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2`}
    >
      <div
        className={[
          "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed break-words",
          isUser
            ? "bg-accent/[0.16] border border-accent/[0.28] text-text-primary rounded-2xl rounded-br-sm"
            : isError
            ? "bg-surface-overlay border border-loss/[0.2] text-loss rounded-2xl rounded-bl-sm"
            : "bg-white/[0.04] border border-white/[0.07] text-text-secondary rounded-2xl rounded-bl-sm",
        ].join(" ")}
      >
        {isStreaming && isEmpty ? (
          <div className="flex flex-col gap-1.5">
            <ChatTypingIndicator />
            {statusText && (
              <m.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="text-[11px] text-text-tertiary"
                key={statusText}
              >
                {statusText}
              </m.p>
            )}
          </div>
        ) : (
          renderContent(content)
        )}
      </div>
    </m.div>
  );
}
