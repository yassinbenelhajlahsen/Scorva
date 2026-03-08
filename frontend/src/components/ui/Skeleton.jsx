export default function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={`animate-pulse bg-white/[0.06] rounded-lg ${className}`}
      {...props}
    />
  );
}
