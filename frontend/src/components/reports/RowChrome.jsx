import { Link } from "react-router-dom";

export function RowChrome({ children, to }) {
  return (
    <Link to={to} className="group relative flex items-start gap-3 pl-4 pr-3 py-3 transition-colors duration-200 hover:bg-white/[0.03]">
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-transparent group-hover:bg-accent transition-colors duration-200" />
      {children}
    </Link>
  );
}
