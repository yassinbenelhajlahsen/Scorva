export default function LoadingScreen() {
  return (
    <div className="flex flex-col justify-center items-center min-h-[60vh] gap-3">
      <div className="w-8 h-8 border-2 border-white/[0.08] border-t-accent rounded-full animate-spin" />
      <span className="text-text-tertiary text-sm tracking-wide">Loading...</span>
    </div>
  );
}
