import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase.js";
import { FloatingInput } from "./FloatingInput.tsx";

const slideVariants = {
  enter: (d) => ({ x: d * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d) => ({ x: d * -48, opacity: 0 }),
};
const slideTrans = { duration: 0.3, ease: [0.22, 1, 0.36, 1] };

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [success, setSuccess] = useState(false);
  const [view, setView] = useState("form"); // "form" | "reset" | "reset-sent"
  const [direction, setDirection] = useState(1);

  function goToReset() {
    setDirection(1);
    setView("reset");
    setError(null);
  }

  function goBack() {
    setDirection(-1);
    setView("form");
    setError(null);
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setView("reset-sent");
  }

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
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        setLoading(false);
        return;
      }
      if (password !== confirm) {
        setError("Passwords don't match.");
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { first_name: firstName.trim(), last_name: lastName.trim() } },
      });
      if (error) setError(error.message);
      else setSuccess(true);
    }

    setLoading(false);
  }

  function switchMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
    setConfirm("");
    setFirstName("");
    setLastName("");
    setShowPassword(false);
    setShowConfirm(false);
  }

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-2xl" onClick={onClose} />

      {/* Sheet */}
      <motion.div
        layout
        className="relative w-full sm:max-w-[360px] bg-[rgba(22,22,26,0.96)] backdrop-blur-3xl border border-white/[0.07] rounded-[20px] shadow-[0_40px_120px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-none"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-6 h-6 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-secondary transition-colors duration-150 z-10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Scrollable content — constrained by sheet max-height */}
        <div className="overflow-y-auto overscroll-contain flex-1">

        {/* Completion screens — full fade swap */}
        <AnimatePresence mode="wait" initial={false}>
          {(success || view === "reset-sent") && (
            <motion.div
              key={success ? "success" : "reset-sent"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="px-7 pt-6 pb-8 space-y-5"
            >
              <div className="flex justify-center">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${success ? "bg-win/15" : "bg-accent/10"}`}>
                  {success ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-win" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-text-primary">Check your email</h2>
                <p className="text-[13px] text-text-tertiary mt-1.5 leading-relaxed">
                  {success ? "We sent a confirmation link to" : "We sent a password reset link to"}<br />
                  <span className="text-text-secondary">{email}</span>
                </p>
              </div>
              <button
                onClick={() => { setSuccess(false); setView("form"); setMode("signin"); setError(null); }}
                className="w-full text-[14px] text-text-tertiary hover:text-text-secondary transition-colors duration-150 py-2"
              >
                Back to sign in
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main interactive area — slides between "form" and "reset" */}
        {!success && view !== "reset-sent" && (
          <div style={{ overflow: "hidden" }}>
            <AnimatePresence mode="popLayout" custom={direction} initial={false}>
              {view === "reset" ? (
                <motion.div
                  key="reset-page"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={slideTrans}
                  className="px-7 pt-7 pb-8"
                >
                  <div className="text-center mb-6">
                    <h2 className="text-[22px] font-semibold tracking-[-0.015em] text-text-primary">Reset Password</h2>
                    <p className="text-[13px] text-text-tertiary mt-1">We'll send a reset link to your email</p>
                  </div>
                  <form onSubmit={handleResetPassword} className="space-y-2.5">
                    <FloatingInput
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      label="Email"
                      autoComplete="email"
                    />
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
                        className="w-full bg-accent hover:bg-accent-hover text-white text-[15px] font-semibold rounded-[10px] py-[13px] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {loading ? "Sending…" : "Send Reset Link"}
                      </button>
                    </div>
                  </form>
                  <button
                    type="button"
                    onClick={goBack}
                    className="w-full text-center text-[13px] text-text-tertiary hover:text-text-secondary transition-colors duration-150 mt-5"
                  >
                    Back to sign in
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="main-page"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={slideTrans}
                  className="px-7 pt-7 pb-8"
                >
                  {/* Header */}
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
                    <p className="text-[13px] text-text-tertiary mt-1">to continue to Scorva</p>
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
                    {/* First / Last name — signup only */}
                    <AnimatePresence initial={false}>
                      {mode === "signup" && (
                        <motion.div
                          key="name-fields"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          style={{ overflow: "hidden" }}
                          className="flex gap-2"
                        >
                          <FloatingInput
                            id="auth-firstname"
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            label="First name"
                            autoComplete="given-name"
                          />
                          <FloatingInput
                            id="auth-lastname"
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            label="Last name"
                            autoComplete="family-name"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <FloatingInput
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      label="Email"
                      autoComplete="email"
                    />
                    <div>
                      <FloatingInput
                        id="auth-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        label="Password"
                        autoComplete={mode === "signin" ? "current-password" : "new-password"}
                        rightSlot={
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="p-1.5 text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                            tabIndex={-1}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                              </svg>
                            )}
                          </button>
                        }
                      />
                      {mode === "signin" && (
                        <div className="flex justify-end mt-1.5">
                          <button
                            type="button"
                            onClick={goToReset}
                            className="text-[12px] text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                          >
                            Forgot password?
                          </button>
                        </div>
                      )}
                      {mode === "signup" && (
                        <p className="text-[11px] text-text-tertiary mt-1.5 px-1">
                          At least 8 characters
                        </p>
                      )}
                    </div>

                    {/* Confirm password — signup only */}
                    <AnimatePresence initial={false}>
                      {mode === "signup" && (
                        <motion.div
                          key="confirm"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          style={{ overflow: "hidden" }}
                        >
                          <FloatingInput
                            id="auth-confirm"
                            type={showConfirm ? "text" : "password"}
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            label="Confirm password"
                            autoComplete="new-password"
                            rightSlot={
                              <button
                                type="button"
                                onClick={() => setShowConfirm((v) => !v)}
                                className="p-1.5 text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                                tabIndex={-1}
                                aria-label={showConfirm ? "Hide password" : "Show password"}
                              >
                                {showConfirm ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                  </svg>
                                )}
                              </button>
                            }
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

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
        )}
        </div>{/* end scrollable */}
      </motion.div>
    </motion.div>
  );
}
