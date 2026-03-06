import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import FavoritesTab from "../components/settings/FavoritesTab.jsx";
import AccountTab from "../components/settings/AccountTab.jsx";

const tabs = [
  {
    id: "favorites",
    label: "Favorites",
    icon: (
      <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  {
    id: "account",
    label: "Account",
    icon: (
      <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
];

const signOutIcon = (
  <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
  </svg>
);

const chevronRight = (
  <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

export default function SettingsPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  // "menu" | "favorites" | "account" — controls mobile view
  const [activeTab, setActiveTab] = useState(null);

  useEffect(() => {
    if (session === null) navigate("/");
  }, [session, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  if (session === undefined || session === null) return null;

  const tabContent = activeTab === "favorites" ? <FavoritesTab /> : <AccountTab />;

  return (
    <div className="min-h-screen py-6 sm:py-10 px-4 sm:px-6">
      <div className="max-w-[900px] mx-auto">

        {/* ── Desktop heading ── */}
        <div className="hidden sm:block mb-8">
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Settings</h1>
          <p className="text-sm text-text-tertiary mt-1">Manage your account and favorites.</p>
        </div>

        {/* ── Mobile: animated switcher using popLayout to avoid scroll glitch ── */}
        <div className="sm:hidden relative overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            {activeTab ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  onClick={() => setActiveTab(null)}
                  className="flex items-center gap-1.5 text-accent text-sm font-medium mb-4"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                  Settings
                </button>
                {tabContent}
              </motion.div>
            ) : (
              <motion.div
                key="menu"
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <h1 className="text-2xl font-semibold text-text-primary tracking-tight mb-6">Settings</h1>
                <div className="bg-surface-elevated border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.05]">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="flex items-center justify-between w-full px-4 py-4 hover:bg-surface-overlay transition-colors duration-150 text-left"
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-text-secondary">{tab.icon}</span>
                        <span className="text-sm font-medium text-text-primary">{tab.label}</span>
                      </span>
                      {chevronRight}
                    </button>
                  ))}
                  <button
                    onClick={signOut}
                    className="flex items-center justify-between w-full px-4 py-4 hover:bg-loss/5 transition-colors duration-150 text-left"
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-loss">{signOutIcon}</span>
                      <span className="text-sm font-medium text-loss">Sign Out</span>
                    </span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Desktop: sidebar + content ── */}
        <div className="hidden sm:flex gap-10">
          <nav className="w-44 shrink-0">
            <div className="flex flex-col gap-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 w-full text-left ${
                      isActive ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="settings-tab-bg"
                        className="absolute inset-0 bg-surface-elevated border border-white/[0.08] rounded-xl"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2.5">
                      {tab.icon}
                      {tab.label}
                    </span>
                  </button>
                );
              })}
              <button
                onClick={signOut}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-loss hover:bg-loss/10 transition-all duration-200 w-full text-left mt-1"
              >
                {signOutIcon}
                Sign Out
              </button>
            </div>
          </nav>

          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab ?? "favorites"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {activeTab ? tabContent : <FavoritesTab />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  );
}
