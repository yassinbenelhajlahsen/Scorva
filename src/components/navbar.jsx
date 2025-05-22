export default function Navbar() {
  return (
    <nav className="bg-black text-white px-6 py-4 flex justify-between items-center">
      <h1 className="text-xl font-bold">🏀 Sportify</h1>
      <ul className="flex gap-6 text-sm">
        <li className="hover:text-green-400 cursor-pointer">Games</li>
        <li className="hover:text-green-400 cursor-pointer">Stats</li>
        <li className="hover:text-green-400 cursor-pointer">Teams</li>
      </ul>
    </nav>
  );
}
