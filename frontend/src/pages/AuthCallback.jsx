import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase.js";
import { FloatingInput } from "../components/ui/FloatingInput.jsx";

function notifyAndClose() {
  // window.opener is null after cross-origin navigation (Google → app), so use BroadcastChannel
  const channel = new BroadcastChannel("supabase_auth");
  channel.postMessage({ type: "SUPABASE_AUTH_SUCCESS" });
  channel.close();
  window.close();
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [view, setView] = useState("loading"); // "loading" | "reset" | "done"
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        subscription.unsubscribe();
        setView("reset");
      } else if (event === "SIGNED_IN") {
        subscription.unsubscribe();
        notifyAndClose();
      }
    });

    // Also check for an existing session (OAuth popup may have already exchanged)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && window.opener) {
        notifyAndClose();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleReset(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setView("done");
    }
  }

  if (view === "loading") {
    return (
      <div className="min-h-screen bg-surface-primary flex items-center justify-center">
        <p className="text-[13px] text-text-tertiary">Please wait…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-primary flex items-center justify-center p-4">
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[360px] bg-[rgba(22,22,26,0.96)] border border-white/[0.07] rounded-[20px] shadow-[0_40px_120px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        <div className="h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

        <div className="px-7 pt-7 pb-8">
          <AnimatePresence mode="wait" initial={false}>
            {view === "done" ? (
              <m.div
                key="done"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-full bg-win/15 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-win" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-text-primary">Password updated</h2>
                  <p className="text-[13px] text-text-tertiary mt-1.5">You can now sign in with your new password.</p>
                </div>
                <button
                  onClick={() => navigate("/")}
                  className="w-full bg-accent hover:bg-accent-hover text-white text-[15px] font-semibold rounded-[10px] py-[13px] transition-colors duration-150"
                >
                  Go to Scorva
                </button>
              </m.div>
            ) : (
              <m.div
                key="reset"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-center mb-6">
                  <h2 className="text-[22px] font-semibold tracking-[-0.015em] text-text-primary">New Password</h2>
                  <p className="text-[13px] text-text-tertiary mt-1">Choose a new password for your account</p>
                </div>

                <form onSubmit={handleReset} className="space-y-2.5">
                  <FloatingInput
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    label="New password"
                    autoComplete="new-password"
                  />
                  <FloatingInput
                    id="confirm-password"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    label="Confirm password"
                    autoComplete="new-password"
                  />

                  <AnimatePresence>
                    {error && (
                      <m.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-[12px] text-loss px-1 overflow-hidden"
                      >
                        {error}
                      </m.p>
                    )}
                  </AnimatePresence>

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-accent hover:bg-accent-hover text-white text-[15px] font-semibold rounded-[10px] py-[13px] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {loading ? "Updating…" : "Update Password"}
                    </button>
                  </div>
                </form>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </m.div>
    </div>
  );
}
