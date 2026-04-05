import { useSettings } from "../context/SettingsContext.jsx";

export default function PrivacyPage() {
  const settings = useSettings();
  return (
    <div className="max-w-[1200px] mx-auto px-6 py-16">
      {/* Header */}
      <h1 className="text-3xl font-bold text-text-primary mb-2">Privacy Policy</h1>
      <p className="text-text-tertiary text-sm mb-12">Effective Date: March 8, 2026</p>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-10">

        {/* Left column */}
        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">Overview</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Scorva is a sports statistics web app. This policy explains what data we collect when you
              create an account, how it is used, and how you can delete it. We do not sell your data or
              share it with third parties for advertising.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">Data We Collect</h2>
            <ul className="text-text-secondary text-sm leading-relaxed space-y-2 list-disc list-inside">
              <li>
                <span className="text-text-primary font-medium">Account information</span> — email
                address. Provided when you sign up with email/password or via Google OAuth.
              </li>
              <li>
                <span className="text-text-primary font-medium">Preferences</span> — your default
                league setting (NBA, NFL, or NHL).
              </li>
              <li>
                <span className="text-text-primary font-medium">Favorites</span> — teams and players
                you save to your account.
              </li>
            </ul>
            <p className="text-text-secondary text-sm leading-relaxed mt-4">
              We do not collect payment information, location data, or any sensitive personal data.
              Browsing Scorva without an account requires no data at all.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">How We Use Your Data</h2>
            <ul className="text-text-secondary text-sm leading-relaxed space-y-2 list-disc list-inside">
              <li>To authenticate you and secure your account.</li>
              <li>To display and persist your favorites and preferences across sessions.</li>
              <li>To personalize the default league shown on the homepage.</li>
            </ul>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">Third-Party Services</h2>
            <ul className="text-text-secondary text-sm leading-relaxed space-y-2 list-disc list-inside">
              <li>
                <span className="text-text-primary font-medium">Supabase</span> — handles
                authentication (email/password and Google OAuth) and stores your credentials securely.
                See{" "}
                <a
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent-hover underline underline-offset-2"
                >
                  Supabase Privacy Policy
                </a>
                .
              </li>
              <li>
                <span className="text-text-primary font-medium">Google OAuth</span> — if you sign in
                with Google, we receive your name and email from Google. We do not receive your Google
                password or any other Google account data. See{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent-hover underline underline-offset-2"
                >
                  Google Privacy Policy
                </a>
                .
              </li>
              <li>
                <span className="text-text-primary font-medium">OpenAI</span> — used to generate
                AI game summaries on demand. Only anonymised game data (scores, stats) is sent; no
                personal account information is included.
              </li>
              <li>
                <span className="text-text-primary font-medium">ESPN</span> — public sports data
                source. No personal data is shared with ESPN.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">Data Retention & Deletion</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Your account data is kept for as long as your account exists. You can permanently delete
              your account — including all stored preferences and favorites — at any time from{" "}
              {settings ? (
                <button
                  onClick={() => settings.openDrawer("account")}
                  className="text-accent hover:text-accent-hover underline underline-offset-2"
                >
                  Settings → Account
                </button>
              ) : (
                "Settings → Account"
              )}
              . Deletion is immediate and irreversible.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">Cookies & Storage</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Supabase Auth uses browser local storage to persist your session. We do not use any
              tracking or advertising cookies.
            </p>
          </section>

        </div>
      </div>

      {/* Contact — full width, centered */}
      <section className="mt-16 text-center">
        <h2 className="text-lg font-semibold text-text-primary mb-3">Contact</h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          Questions about this policy? Reach out at{" "}
          <a
            href="mailto:yassinbenelhajlahsen@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-hover underline underline-offset-2"
          >
            yassinbenelhajlahsen@gmail.com.
          </a>
        </p>
      </section>
    </div>
  );
}
