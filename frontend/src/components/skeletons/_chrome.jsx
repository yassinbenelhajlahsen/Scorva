export function SkeletonCard({ children, className = "", railClass = "bg-white/15" }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${railClass}`} />
      <div className="absolute inset-0 bg-gradient-to-r from-white/[0.04] to-transparent pointer-events-none" />
      <div className="relative">{children}</div>
    </div>
  );
}

export function SkeletonRow({ children, className = "" }) {
  return (
    <div className={`relative flex items-center gap-3 pl-4 pr-3 py-3 ${className}`}>
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-transparent" />
      {children}
    </div>
  );
}
