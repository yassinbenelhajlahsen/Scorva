export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] mt-24">
      <div className="max-w-[1200px] mx-auto px-6 py-10 flex flex-col items-center gap-4">
        <p className="text-text-tertiary text-sm text-center">
          &copy; 2025 Scorva — Built by Yassin Benelhajlahsen. Not affiliated with the NBA, NFL, NHL, or any other sports league.
        </p>
        <div className="flex items-center gap-6">
          <a
            href="https://github.com/yassinbenelhajlahsen/Scorva"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-text-primary transition-colors duration-200 text-sm"
          >
            GitHub
          </a>
          <span className="w-px h-3 bg-white/[0.12]" />
          <a
            href="https://www.linkedin.com/in/yassin-benelhajlahsen/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-text-primary transition-colors duration-200 text-sm"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}
