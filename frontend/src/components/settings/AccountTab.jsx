import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, m } from "framer-motion";
import { useAuth } from "../../context/AuthContext.jsx";
import { supabase } from "../../lib/supabase.js";
import { updateProfile, deleteAccount } from "../../api/user.js";
import { FloatingInput } from "../ui/FloatingInput.jsx";
import { PasswordChecklist, passwordMeetsRequirements } from "../auth/PasswordChecklist.jsx";

const LEAGUES = [
  { id: "nba", label: "NBA" },
  { id: "nfl", label: "NFL" },
  { id: "nhl", label: "NHL" },
];

function EyeIcon({ open }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function Section({ title, children }) {
  return (
    <section className="bg-surface-elevated border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function InputField({ label, id, value, onChange, type = "text", readOnly = false, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-text-tertiary mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`w-full px-3.5 py-2.5 rounded-xl text-sm border transition-all duration-200 focus:outline-none ${
          readOnly
            ? "bg-surface-primary/60 border-white/[0.06] text-text-tertiary cursor-not-allowed"
            : "bg-surface-primary border-white/[0.08] text-text-primary focus:ring-1 focus:ring-accent/40 focus:border-accent/30"
        }`}
      />
    </div>
  );
}

function Feedback({ message, type }) {
  return (
    <AnimatePresence>
      {message && (
        <m.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`text-xs ${type === "error" ? "text-loss" : "text-win"}`}
        >
          {message}
        </m.p>
      )}
    </AnimatePresence>
  );
}

export default function AccountTab() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const user = session?.user;

  // Derive initial name from user metadata (handles both email/password and Google OAuth)
  const meta = user?.user_metadata ?? {};
  const initFirst =
    meta.first_name ??
    (meta.full_name ? meta.full_name.trim().split(/\s+/)[0] : "") ??
    "";
  const initLast =
    meta.last_name ??
    (meta.full_name ? meta.full_name.trim().split(/\s+/).slice(1).join(" ") : "") ??
    "";

  const firstName = initFirst;
  const lastName = initLast;
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  async function saveProfile() {
    if (!session || profileSaving) return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await Promise.all([
        supabase.auth.updateUser({ data: { first_name: firstName, last_name: lastName } }),
        updateProfile({ firstName, lastName }, { token: session.access_token }),
      ]);
      setProfileMsg({ text: "Profile updated.", type: "success" });
    } catch {
      setProfileMsg({ text: "Failed to update profile.", type: "error" });
    } finally {
      setProfileSaving(false);
    }
  }

  // Show password section only if the user has email/password auth
  const providers = user?.app_metadata?.providers ?? [];
  const canChangePassword =
    providers.includes("email") ||
    (!providers.length && user?.app_metadata?.provider === "email");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteExpanded, setDeleteExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  async function handleDeleteAccount() {
    if (deleteConfirm !== "DELETE" || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount({ token: session.access_token });
      await supabase.auth.signOut();
      navigate("/");
    } catch {
      setDeleteError("Failed to delete account. Please try again.");
      setDeleting(false);
    }
  }

  async function changePassword() {
    if (pwSaving) return;
    setPwMsg(null);
    if (!currentPassword) {
      setPwMsg({ text: "Please enter your current password.", type: "error" });
      return;
    }
    if (!passwordMeetsRequirements(newPassword)) {
      setPwMsg({ text: "New password does not meet requirements.", type: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ text: "Passwords do not match.", type: "error" });
      return;
    }
    setPwSaving(true);
    try {
      // Validate current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        setPwMsg({ text: "Current password is incorrect.", type: "error" });
        return;
      }
      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setPwMsg({ text: "Password updated.", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwMsg({ text: err.message ?? "Failed to update password.", type: "error" });
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="mb-1">
        <h2 className="text-lg font-semibold text-text-primary">Account</h2>
        <p className="text-sm text-text-tertiary mt-1">Manage your profile and security settings.</p>
      </div>

            {/* Google sign-in notice */}
      {!canChangePassword && (
        <Section title="Sign-in Method">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <p className="text-sm text-text-secondary">Signed in with Google</p>
          </div>
        </Section>
      )}

      {/* Profile */}
      <Section title="Profile">
        <div className="flex flex-col gap-4">
          <InputField label="Email" id="email" value={user?.email ?? ""} readOnly />
          <div className="flex items-center justify-between gap-4 pt-1">
            <Feedback message={profileMsg?.text} type={profileMsg?.type} />
            <button
              onClick={saveProfile}
              disabled={profileSaving}
              className="ml-auto shrink-0 px-5 py-2 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(232,134,58,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {profileSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </Section>

      {/* Change Password — only for email/password accounts */}
      {canChangePassword && (
        <Section title="Change Password">
          <div className="flex flex-col gap-3">
            <FloatingInput
              id="currentPw"
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              label="Current Password"
              autoComplete="current-password"
              required={false}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="p-1.5 text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                  tabIndex={-1}
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showCurrent} />
                </button>
              }
            />
            <FloatingInput
              id="newPw"
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              label="New Password"
              autoComplete="new-password"
              required={false}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="p-1.5 text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                  tabIndex={-1}
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showNew} />
                </button>
              }
            />
            <PasswordChecklist password={newPassword} />
            <FloatingInput
              id="confirmPw"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              label="Confirm New Password"
              autoComplete="new-password"
              required={false}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="p-1.5 text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                  tabIndex={-1}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              }
            />
            <div className="flex items-center justify-between gap-4 pt-1">
              <Feedback message={pwMsg?.text} type={pwMsg?.type} />
              <button
                onClick={changePassword}
                disabled={pwSaving}
                className="ml-auto shrink-0 px-5 py-2 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(232,134,58,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pwSaving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        </Section>
      )}

      

      {/* Delete Account */}
      <Section title="Delete Account">
        {!deleteExpanded ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-text-secondary">Permanently delete your account and all data.</p>
            <button
              onClick={() => setDeleteExpanded(true)}
              className="shrink-0 px-5 py-2 rounded-full border border-loss/30 text-loss hover:bg-loss/10 text-sm font-medium transition-all duration-200"
            >
              Delete Account
            </button>
          </div>
        ) : (
          <m.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >
            <p className="text-sm text-text-secondary leading-relaxed">
              This will permanently delete your account, favorites, and all associated data. <span className="text-loss font-medium">This cannot be undone.</span>
            </p>
            <div>
              <label className="block text-xs font-medium text-text-tertiary mb-1.5">
                Type <span className="text-text-primary font-semibold">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-surface-primary border border-white/[0.08] text-text-primary focus:outline-none focus:ring-1 focus:ring-loss/40 focus:border-loss/30 transition-all duration-200"
              />
            </div>
            {deleteError && <p className="text-xs text-loss">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteExpanded(false); setDeleteConfirm(""); setDeleteError(null); }}
                className="flex-1 py-2 rounded-full border border-white/[0.12] text-text-secondary hover:text-text-primary text-sm font-medium transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== "DELETE" || deleting}
                className="flex-1 py-2 rounded-full bg-loss/90 hover:bg-loss text-white text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting…" : "Confirm Delete"}
              </button>
            </div>
          </m.div>
        )}
      </Section>

    </div>
  );
}
