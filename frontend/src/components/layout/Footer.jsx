export default function Footer() {
  return (
    <footer className="bg-zinc-900 text-gray-400 py-6 text-center mt-20 border-t border-zinc-700 px-4">
      <p className="text-sm max-w-4xl mx-auto">
        © 2025 Scorva — Built by Yassin Benelhajlahsen. Not affiliated with the
        NBA, NFL, NHL, any other sports league or organization.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mt-4">
        <a
          href="https://github.com/yassinbenelhajlahsen/Scorva"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-600 transition-colors text-sm"
        >
          🧑‍💻 View Source on GitHub
        </a>
        <a
          href="https://www.linkedin.com/in/yassin-benelhajlahsen/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-600 transition-colors text-sm"
        >
          💼 Connect with me on LinkedIn!
        </a>
      </div>
    </footer>
  );
}
