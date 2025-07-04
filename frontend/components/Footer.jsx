export default function Footer() {
  return (
    <footer className="bg-zinc-900 text-gray-400 py-6 text-center mt-20 border-t border-zinc-700">
      <p className="text-sm">
        © 2025 Scorva — Built by Yassin Benelhajlahsen. Not affiliated with the
        NBA, NFL, NHL, any other sports league or organization.
      </p>

      <p className="text-sm mt-2">
        <a
          href="https://github.com/yassinbenelhajlahsen/Scorva"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-600 p-4"
        >
          🧑‍💻 View Source on GitHub
        </a>
        <a
          href="https://www.linkedin.com/in/yassin-benelhajlahsen/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-600"
        >
          💼 Connect with me on Linkedin!
        </a>
      </p>
    </footer>
  );
}
