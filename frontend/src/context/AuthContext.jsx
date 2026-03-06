import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase.js";
import AuthModal from "../components/ui/AuthModal.jsx";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const channel = new BroadcastChannel("supabase_auth");
    channel.onmessage = (event) => {
      if (event.data?.type === "SUPABASE_AUTH_SUCCESS") {
        supabase.auth.getSession().then(({ data: { session } }) => {
          setSession(session);
          setModalOpen(false);
        });
      }
    };

    return () => {
      subscription.unsubscribe();
      channel.close();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, openAuthModal: () => setModalOpen(true) }}
    >
      {children}
      <AnimatePresence>
        {modalOpen && <AuthModal onClose={() => setModalOpen(false)} />}
      </AnimatePresence>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
