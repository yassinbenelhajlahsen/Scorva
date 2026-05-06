import { m } from "framer-motion";
import { Link } from "react-router-dom";
import ChatTypingIndicator from "./ChatTypingIndicator.jsx";
import { useChat } from "../../context/ChatContext.jsx";

const LEAGUES = new Set(["nba", "nfl", "nhl"]);

// Resolve a sentinel target like "player:nba:20171" → "/nba/players/20171".
// Returns null if the target is malformed or uses an unknown scheme — the link
// then falls through to plain text so we never render broken anchors.
function resolveTarget(target) {
  const m1 = /^(player|team|game):([a-z]+):([A-Za-z0-9_-]+)$/.exec(target);
  if (!m1) return null;
  const [, kind, league, id] = m1;
  if (!LEAGUES.has(league)) return null;
  if (kind === "player") return `/${league}/players/${id}`;
  if (kind === "team") return `/${league}/teams/${id}`;
  if (kind === "game") return `/${league}/games/${id}`;
  return null;
}

// Splits inline text into bold spans, sentinel links, and plain text. The single
// regex captures both `**bold**` and `[label](scheme:league:id)` so we walk the
// string once and preserve order.
const INLINE_RE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

function renderInline(text, onLinkClick) {
  return text.split(INLINE_RE).map((part, i) => {
    if (!part) return part;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const [, label, target] = link;
      const path = resolveTarget(target);
      if (path) {
        return (
          <Link
            key={i}
            to={path}
            onClick={onLinkClick}
            className="text-accent hover:underline"
          >
            {label}
          </Link>
        );
      }
      return label;
    }
    return part;
  });
}

function renderContent(text, onLinkClick) {
  const lines = text.split("\n");
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-*] /.test(trimmed)) {
      if (current?.type !== "ul") {
        current = { type: "ul", lines: [] };
        blocks.push(current);
      }
      current.lines.push(trimmed.replace(/^[-*] /, ""));
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (current?.type !== "ol") {
        current = { type: "ol", lines: [] };
        blocks.push(current);
      }
      current.lines.push(trimmed.replace(/^\d+\.\s/, ""));
    } else if (trimmed === "") {
      current = null;
    } else {
      if (current?.type !== "p") {
        current = { type: "p", lines: [] };
        blocks.push(current);
      }
      current.lines.push(trimmed);
    }
  }

  return blocks.map((block, i) => {
    if (block.type === "ul") {
      return (
        <ul key={i}>
          {block.lines.map((l, j) => <li key={j}>{renderInline(l, onLinkClick)}</li>)}
        </ul>
      );
    }
    if (block.type === "ol") {
      return (
        <ol key={i}>
          {block.lines.map((l, j) => <li key={j}>{renderInline(l, onLinkClick)}</li>)}
        </ol>
      );
    }
    return (
      <p key={i}>
        {block.lines.flatMap((l, j) =>
          j > 0 ? [<br key={`br-${j}`} />, ...renderInline(l, onLinkClick)] : renderInline(l, onLinkClick)
        )}
      </p>
    );
  });
}

export default function MessageBubble({ role, content, isError, isStreaming, statusText }) {
  const isUser = role === "user";
  const isEmpty = !content;
  const chat = useChat();
  const onLinkClick = chat?.closePanel;

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
            : "bg-white/[0.035] border border-white/[0.06] text-text-secondary rounded-2xl rounded-bl-sm",
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
          <div className="chat-markdown">{renderContent(content, onLinkClick)}</div>
        )}
      </div>
    </m.div>
  );
}
