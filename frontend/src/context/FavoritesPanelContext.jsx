import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { AnimatePresence, m } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { useSettings } from "./SettingsContext.jsx";
import { useChat } from "./ChatContext.jsx";
import FavoritesPanel from "../components/favorites/FavoritesPanel.jsx";

const FavoritesPanelContext = createContext(null);

export function FavoritesPanelProvider({ children }) {
  const { session, openAuthModal } = useAuth();
  const { isDrawerOpen, closeDrawer } = useSettings();
  const { isOpen: isChatOpen, togglePanel: toggleChat } = useChat();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const togglePanel = useCallback(() => {
    if (!session) {
      openAuthModal("favorites");
      return;
    }
    setIsOpen((prev) => {
      if (!prev) {
        if (isDrawerOpen) closeDrawer();
        if (isChatOpen) toggleChat();
      }
      return !prev;
    });
  }, [session, openAuthModal, isDrawerOpen, closeDrawer, isChatOpen, toggleChat]);

  const closePanel = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (isDrawerOpen) setIsOpen(false);
  }, [isDrawerOpen]);

  useEffect(() => {
    if (isChatOpen) setIsOpen(false);
  }, [isChatOpen]);

  useEffect(() => {
    if (session === null) setIsOpen(false);
  }, [session]);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <FavoritesPanelContext.Provider value={{ isOpen, togglePanel, closePanel }}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <>
            <m.div
              key="favorites-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[69] bg-black/60"
              onClick={closePanel}
            />
            <FavoritesPanel onClose={closePanel} />
          </>
        )}
      </AnimatePresence>
    </FavoritesPanelContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFavoritesPanel() {
  return useContext(FavoritesPanelContext);
}
