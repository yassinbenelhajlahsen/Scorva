import { useRef, useEffect } from "react";
import { AnimatePresence, m } from "framer-motion";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import { useFavoritesPanel } from "../../context/FavoritesPanelContext.jsx";
import { supabase } from "../../lib/supabase.js";

const UserIcon = () => (
  <svg
    className="h-4 w-4 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
    />
  </svg>
);

const StarIcon = () => (
  <svg
    className="h-4 w-4 shrink-0 text-yellow-400"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    className="h-4 w-4 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  </svg>
);

const SignOutIcon = () => (
  <svg
    className="h-4 w-4 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
    />
  </svg>
);

export default function AvatarDropdown() {
  const { session } = useAuth();
  const { isDropdownOpen, toggleDropdown, closeDropdown, openDrawer } = useSettings();
  const { togglePanel: toggleFavorites } = useFavoritesPanel();
  const containerRef = useRef(null);

  useEffect(() => {
    function handleMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeDropdown();
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") closeDropdown();
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDropdown]);

  async function handleSignOut() {
    closeDropdown();
    await supabase.auth.signOut();
  }

  function handleOpenFavorites() {
    closeDropdown();
    toggleFavorites();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={toggleDropdown}
        aria-label="Account menu"
        className="touch-target rounded-full text-text-secondary hover:text-text-primary transition-all duration-200"
      >
        <span className="w-8 h-8 rounded-full bg-surface-elevated border border-white/[0.08] flex items-center justify-center hover:border-white/[0.14] hover:bg-surface-overlay transition-all duration-200">
          <UserIcon />
        </span>
      </button>

      <AnimatePresence>
        {isDropdownOpen && (
          <m.div
            key="avatar-dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full mt-2 z-[60] w-56 bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] overflow-hidden"
          >
            {/* Email header */}
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="text-xs text-text-tertiary truncate">
                {session?.user?.email}
              </p>
            </div>

            {/* Favorites */}
            <button
              onClick={handleOpenFavorites}
              className="w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-surface-overlay transition-colors duration-150 flex items-center gap-2.5"
            >
              <StarIcon />
              Favorites
            </button>

            {/* Settings */}
            <button
              onClick={() => openDrawer("favorites")}
              className="w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-surface-overlay transition-colors duration-150 flex items-center gap-2.5"
            >
              <SettingsIcon />
              Settings
            </button>

            {/* Divider */}
            <div className="border-t border-white/[0.06]" />

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2.5 text-left text-sm text-loss hover:bg-loss/5 transition-colors duration-150 flex items-center gap-2.5"
            >
              <SignOutIcon />
              Sign Out
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
