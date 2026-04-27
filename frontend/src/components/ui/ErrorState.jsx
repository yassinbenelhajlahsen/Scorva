export default function ErrorState({
  message = "Something went wrong. Please try again.",
  onRetry,
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4 sm:px-6">
      <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-8 w-full max-w-md text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-loss/60 mx-auto mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="text-sm text-text-secondary mb-5">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="touch-target bg-surface-overlay text-text-primary text-sm font-medium px-5 py-2.5 rounded-full border border-white/[0.08] hover:border-white/[0.14] hover:bg-white/[0.06] transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
