import { m } from "framer-motion";

export default function ChatTypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-0.5 py-1">
      {[0, 1, 2].map((i) => (
        <m.span
          key={i}
          className="block w-1.5 h-1.5 rounded-full bg-text-tertiary"
          animate={{ scale: [1, 1.5, 1], opacity: [0.35, 1, 0.35] }}
          transition={{
            duration: 0.85,
            repeat: Infinity,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
