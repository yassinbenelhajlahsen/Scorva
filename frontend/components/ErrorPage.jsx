import { Link } from "react-router-dom";

export default function ErrorPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-4xl font-bold text-gray-800">404 - Page Not Found</h1>
      <Link
        to="/"
        className="mt-6 inline-block bg-gradient-to-r from-red-500 to-yellow-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md transform transition-transform duration-300 hover:scale-105 hover:shadow-lg"
      >
        ← Return to Homepage
      </Link>
    </div>
  );
}
