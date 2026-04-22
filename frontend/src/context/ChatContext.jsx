import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { AnimatePresence, m } from "framer-motion";
import { useAuth } from "./AuthContext.jsx";
import { useSettings } from "./SettingsContext.jsx";
import ChatFAB from "../components/chat/ChatFAB.jsx";
import ChatPanel from "../components/chat/ChatPanel.jsx";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { session, openAuthModal } = useAuth();
  const { isDrawerOpen } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const togglePanel = useCallback(() => {
    if (!session) {
      openAuthModal("chat");
      return;
    }
    setIsOpen((prev) => !prev);
  }, [session, openAuthModal]);

  useEffect(() => {
    if (session === null) {
      setIsOpen(false);
      setMessages([]);
      setConversationId(null);
    }
  }, [session]);

  useEffect(() => {
    if (isDrawerOpen) setIsOpen(false);
  }, [isDrawerOpen]);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        togglePanel,
        messages,
        setMessages,
        conversationId,
        setConversationId,
        isStreaming,
        setIsStreaming,
        resetConversation,
      }}
    >
      {children}
      {session !== undefined && !isDrawerOpen && (
        <ChatFAB onClick={togglePanel} isOpen={isOpen} />
      )}
      <AnimatePresence>
        {isOpen && (
          <m.div
            key="chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[89] bg-black/60 sm:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
        {isOpen && <ChatPanel onClose={() => setIsOpen(false)} />}
      </AnimatePresence>
    </ChatContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChat() {
  return useContext(ChatContext);
}
