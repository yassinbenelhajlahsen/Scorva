import { Link } from "react-router-dom";

export default function ErrorPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
      <div className="text-7xl font-bold tracking-tight text-text-primary/20 tabular-nums">404</div>
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Page Not Found</h1>
        <p className="text-text-secondary text-sm">The page you&apos;re looking for doesn&apos;t exist.</p>
      </div>
      <Link
        to="/"
        className="mt-2 inline-flex items-center gap-2 bg-accent text-white font-semibold py-3 px-6 rounded-full text-sm transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(232,134,58,0.3)]"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M3 12l7-7M3 12l7 7" />
        </svg>
        Return to Homepage
      </Link>
    </div>
  );
}
