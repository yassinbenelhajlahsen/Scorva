import { createContext, useContext, useState, useCallback } from "react";
import { AnimatePresence, m } from "framer-motion";
import { useAuth } from "./AuthContext.jsx";
import ChatFAB from "../components/chat/ChatFAB.jsx";
import ChatPanel from "../components/chat/ChatPanel.jsx";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { session, openAuthModal } = useAuth();
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
      {session !== undefined && (
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
