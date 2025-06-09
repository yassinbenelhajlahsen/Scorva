import {Link} from "react-router-dom";

export default function errorPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
                <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
                <Link
                  to="/"
                  className="mt-6 inline-block bg-white text-red-500 font-semibold py-4 px-8 rounded-lg shadow transform transition-transform duration-300 hover:bg-gray-200 hover:scale-105"
                >
                  Return to Homepage
                </Link>
              </div>
    )
}