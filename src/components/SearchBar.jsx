export default function SearchBar({ query, setQuery }) {
    return (
    <div className="relative w-full sm:w-auto max-w-sm flex-grow">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teams, games, players..."
          className="w-full px-4 py-2 rounded-full bg-zinc-800 text-white placeholder-gray-400 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
        />
      </div>
    )
}

