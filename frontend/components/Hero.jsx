import { Link } from "react-router-dom";

export default function Hero() {
  return (

      <section className="bg-gradient-to-r from-red-500 to-yellow-500 text-white text-center py-15 px-4 rounded-b-3xl shadow-lg">
        <h2 className="text-4xl font-bold mb-4">Welcome to Scorva</h2>
        <p className="text-lg max-w-xl mx-auto">
          Track NBA, NFL, and NHL games with real-time updates and historical
          stats.
        </p>
        <div className="mt-8">
          <Link
            to="/about"
            className="inline-block bg-white text-red-500 font-semibold py-4 px-8 rounded-lg shadow transform transition duration-300 hover:bg-gray-200 hover:scale-105"
          >
            About this project
          </Link>
        </div>
      </section>
  );
}
