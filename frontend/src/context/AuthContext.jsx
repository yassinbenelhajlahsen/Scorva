import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase.js";
import AuthModal from "../components/auth/AuthModal.jsx";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [modalContext, setModalContext] = useState(null);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const channel = new BroadcastChannel("supabase_auth");
    channel.onmessage = (event) => {
      if (event.data?.type === "SUPABASE_AUTH_SUCCESS") {
        setModalContext(null);
      }
    };

    return () => {
      subscription.unsubscribe();
      channel.close();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, openAuthModal: (context) => setModalContext(context || "default") }}
    >
      {children}
      <AnimatePresence>
        {modalContext && <AuthModal context={modalContext} onClose={() => setModalContext(null)} />}
      </AnimatePresence>
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
