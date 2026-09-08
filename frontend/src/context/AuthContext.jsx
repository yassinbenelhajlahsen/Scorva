import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase.js";
import AuthModal from "../components/auth/AuthModal.jsx";

const AuthContext = createContext(null);

// Consumers treat `session === undefined` as "auth still resolving". Supabase
// only emits its initial event after token recovery finishes, which retries with
// backoff when the auth host is unreachable — so cap the wait and commit an
// unauthenticated session rather than leaving consumers stalled indefinitely.
const AUTH_INIT_TIMEOUT_MS = 3000;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [modalContext, setModalContext] = useState(null);

  useEffect(() => {
    let resolved = false;
    const commit = (next) => {
      resolved = true;
      setSession(next);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      commit(session);
    });

    // getSession() shares Supabase's init lock, so it can hang as long as the
    // subscription does; it is a faster path when storage already holds a valid
    // session, not a guarantee. The timeout below is the guarantee.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!resolved) commit(data?.session ?? null);
      })
      .catch(() => {
        if (!resolved) commit(null);
      });

    const initTimer = setTimeout(() => {
      if (!resolved) commit(null);
    }, AUTH_INIT_TIMEOUT_MS);

    const channel = new BroadcastChannel("supabase_auth");
    channel.onmessage = (event) => {
      if (event.data?.type === "SUPABASE_AUTH_SUCCESS") {
        setModalContext(null);
      }
    };

    return () => {
      clearTimeout(initTimer);
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
