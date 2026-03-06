import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase.js";
import { FloatingInput } from "./FloatingInput.tsx";

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    const { data } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: true,
      },
    });

    if (data?.url) {
      const w = 480, h = 600;
      const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
      const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
      const popup = window.open(
        data.url,
        "GoogleSignIn",
        `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=no`
      );
      const poll = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(poll);
          setGoogleLoading(false);
        }
      }, 500);
    } else {
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else onClose();
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setSuccess(true);
    }

    setLoading(false);
  }

  function switchMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
  }

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop — heavy blur, Apple-style */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-2xl" />

      {/* Sheet */}
      <motion.div
        className="relative w-full sm:max-w-[360px] bg-[rgba(22,22,26,0.96)] backdrop-blur-3xl border border-white/[0.07] sm:rounded-[20px] rounded-t-[20px] shadow-[0_40px_120px_rgba(0,0,0,0.8)]"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-white/[0.15] rounded-full" />
        </div>

        {/* Close — desktop only */}
        <button
          onClick={onClose}
          className="hidden sm:flex absolute top-4 right-4 w-6 h-6 items-center justify-center rounded-full text-text-tertiary hover:text-text-secondary transition-colors duration-150"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-7 pt-7 pb-8">
          <AnimatePresence mode="wait" initial={false}>
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                {/* Success icon */}
                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-full bg-win/15 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-win" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-text-primary">Check your email</h2>
                  <p className="text-[13px] text-text-tertiary mt-1.5 leading-relaxed">
                    We sent a confirmation link to<br />
                    <span className="text-text-secondary">{email}</span>
                  </p>
                </div>
                <button
                  onClick={() => { setSuccess(false); setMode("signin"); }}
                  className="w-full text-[14px] text-text-tertiary hover:text-text-secondary transition-colors duration-150 py-2"
                >
                  Back to sign in
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {/* Header — only the title crossfades on mode switch */}
                <div className="text-center mb-6">
                  <div className="overflow-hidden h-[30px] flex items-center justify-center">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.h2
                        key={mode}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="text-[22px] font-semibold tracking-[-0.015em] text-text-primary absolute"
                      >
                        {mode === "signin" ? "Sign In" : "Create Account"}
                      </motion.h2>
                    </AnimatePresence>
                  </div>
                  <p className="text-[13px] text-text-tertiary mt-1">
                    to continue to Scorva
                  </p>
                </div>

                {/* Google OAuth */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-2.5 bg-white/[0.06] hover:bg-white/[0.10] ring-1 ring-white/[0.08] hover:ring-white/[0.14] rounded-[10px] px-4 py-[11px] text-[15px] font-medium text-text-primary transition-all duration-150 mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {googleLoading ? "Opening…" : "Continue with Google"}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[12px] text-text-tertiary">or</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-2.5">
                  <FloatingInput
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    label="Email"
                    autoComplete="email"
                  />
                  <FloatingInput
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    label="Password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  />

                  {/* Error */}
                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-[12px] text-loss px-1 overflow-hidden"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={loading}
                      className="relative w-full bg-accent hover:bg-accent-hover text-white text-[15px] font-semibold rounded-[10px] py-[13px] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={mode + loading}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.14 }}
                          className="block"
                        >
                          {loading
                            ? mode === "signin" ? "Signing in…" : "Creating account…"
                            : mode === "signin" ? "Sign In" : "Create Account"}
                        </motion.span>
                      </AnimatePresence>
                    </button>
                  </div>
                </form>

                {/* Switch mode */}
                <div className="flex items-center justify-center gap-1 mt-5 text-[13px]">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={mode + "-label"}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className="text-text-tertiary"
                    >
                      {mode === "signin" ? "Don't have an account?" : "Already have an account?"}
                    </motion.span>
                  </AnimatePresence>
                  <button
                    type="button"
                    onClick={switchMode}
                    className="text-accent hover:text-accent-hover transition-colors duration-150"
                  >
                    {mode === "signin" ? "Sign up" : "Sign in"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
