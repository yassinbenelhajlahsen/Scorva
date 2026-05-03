export default function NavbarSearch() {
  return (
    <button
      type="button"
      aria-label="Open search"
      className="touch-target flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors duration-200"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
      </svg>
    </button>
  );
}
