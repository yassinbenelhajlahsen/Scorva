export default function Footer() {
  return (
    <footer className="bg-zinc-900 text-gray-400 py-6 text-center mt-20 border-t border-zinc-700">
      <p className="text-sm">
        © 2025 Sportify — Built by Yassin Benelhajlahsen.
        Not affiliated with the NBA, NFL, NHL or any other sports league.
      </p>
      
      <p className="text-sm mt-2">
        <a
          href="https://github.com/yassinbenelhajlahsen/sportify"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-600 p-4"
        >
          🧑‍💻 View Source on GitHub 
        </a>
        <a
          href="https://www.linkedin.com/in/yassinbenelhajlahsen/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-600"
        >
          💼  Connect with me on Linkedin! 
          </a>
        </p>
    </footer>
  );
}
