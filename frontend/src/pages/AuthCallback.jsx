import { useEffect } from "react";
import { supabase } from "../lib/supabase.js";

function notifyAndClose() {
  if (window.opener) {
    window.opener.postMessage({ type: "SUPABASE_AUTH_SUCCESS" }, window.location.origin);
  }
  window.close();
}

export default function AuthCallback() {
  useEffect(() => {
    // Session may already be exchanged by the time React mounts — check first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        notifyAndClose();
        return;
      }

      // Otherwise wait for the exchange to complete
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session) {
          subscription.unsubscribe();
          notifyAndClose();
        }
      });
    });
  }, []);

  return (
    <div className="min-h-screen bg-surface-primary flex items-center justify-center">
      <p className="text-[13px] text-text-tertiary">Signing in…</p>
    </div>
  );
}
