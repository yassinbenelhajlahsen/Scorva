export default function PlayerAvatar({ player }) {
  if (player?.imageUrl) {
    return (
      <img
        src={player.imageUrl}
        alt={player.name}
        className="w-9 h-9 rounded-full object-cover bg-surface-overlay border border-white/[0.08] shrink-0"
        loading="lazy"
      />
    );
  }
  const initials = (player?.name || "?")
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-surface-overlay border border-white/[0.08] flex items-center justify-center text-[10px] font-semibold text-text-tertiary shrink-0">
      {initials}
    </div>
  );
}
