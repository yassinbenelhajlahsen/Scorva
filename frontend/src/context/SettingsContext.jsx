import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { AnimatePresence, m } from "framer-motion";
import { useAuth } from "./AuthContext.jsx";
import SettingsDrawer from "../components/settings/SettingsDrawer.jsx";

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { session } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("favorites");

  // Auto-close when signed out
  useEffect(() => {
    if (session === null) {
      setIsDropdownOpen(false);
      setIsDrawerOpen(false);
    }
  }, [session]);

  const toggleDropdown = useCallback(() => setIsDropdownOpen((prev) => !prev), []);
  const closeDropdown = useCallback(() => setIsDropdownOpen(false), []);

  const openDrawer = useCallback((tab = "favorites") => {
    setIsDropdownOpen(false);
    setActiveTab(tab);
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setActiveTab("favorites");
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        isDropdownOpen,
        toggleDropdown,
        closeDropdown,
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        activeTab,
        setActiveTab,
      }}
    >
      {children}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <m.div
              key="settings-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[79] bg-black/60"
              onClick={closeDrawer}
            />
            <SettingsDrawer onClose={closeDrawer} />
          </>
        )}
      </AnimatePresence>
    </SettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  return useContext(SettingsContext);
}
