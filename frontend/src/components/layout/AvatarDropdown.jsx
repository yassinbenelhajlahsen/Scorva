import { useRef, useEffect } from "react";
import { AnimatePresence, m } from "framer-motion";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
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

export default function AvatarDropdown() {
  const { session } = useAuth();
  const { isDropdownOpen, toggleDropdown, closeDropdown, openDrawer } = useSettings();
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

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={toggleDropdown}
        aria-label="Account menu"
        className="w-8 h-8 rounded-full bg-surface-elevated border border-white/[0.08] flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-white/[0.14] hover:bg-surface-overlay transition-all duration-200"
      >
        <UserIcon />
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

            {/* Settings */}
            <button
              onClick={() => openDrawer("favorites")}
              className="w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-surface-overlay transition-colors duration-150"
            >
              Settings
            </button>

            {/* Divider */}
            <div className="border-t border-white/[0.06]" />

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2.5 text-left text-sm text-loss hover:bg-loss/5 transition-colors duration-150"
            >
              Sign Out
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
