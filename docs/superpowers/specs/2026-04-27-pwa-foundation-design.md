# PWA Foundation — Design Spec

**Date:** 2026-04-27
**Branch:** `feat/mobile`
**Status:** Design (pre-implementation)
**Sub-project of:** Mobile-friendly overhaul (1 of 3 — PWA, then gestures, then UI polish)

## Goal

Make Scorva installable on iOS home screens with a polished launch experience. Out of scope: offline support, runtime API caching, Android-specific polish, push notifications, background sync, touch gestures, mobile UI polish.

This is the **"installable only"** tier of PWA work. The user explicitly chose minimum viable scope: standalone display window, app icon, splash-replacement loading shell, iOS install nudge, silent auto-update. No service-worker caching of API data, no offline mode.

## Decisions locked during brainstorm

| Decision | Choice | Rationale |
|---|---|---|
| Scope tier | Installable only | Smallest scope, ships fastest, no caching edge cases |
| iOS treatment | Basics (apple-touch-icon, no `apple-touch-startup-image` splash) | Splash images need 6+ device-specific sizes; replaced with in-app loading shell |
| Loading shell location | Inline HTML/CSS in `index.html` | Renders before React boots — masks the launch white-flash |
| Icon source | Existing `frontend/public/image.png` (1024×1024) | On-brand, high-res, ready to use |
| Maskable icon variant | Skip | User does not care about Android polish |
| Favicon | Keep existing `favicon.webp` | User explicit |
| iOS install nudge | Include | iOS has no install API — without a nudge, install rate is ~0 |
| Update strategy | Silent auto-update (`registerType: 'autoUpdate'`) | No unsaved input in Scorva; TanStack Query handles data staleness |
| PWA tooling | `vite-plugin-pwa` | De facto Vite PWA plugin, Workbox-based, mature |

## Architecture

```
frontend/
├── index.html                      # MODIFIED: add manifest <link>, apple-touch-icon <link>,
│                                   #           inline app-shell <style> + <div>
├── public/
│   ├── manifest.webmanifest        # NEW — app identity (committed, not generated)
│   ├── apple-touch-icon.png        # NEW — 180×180, root path for iOS auto-discovery
│   ├── image.png                   # EXISTING — kept as 1024×1024 source artwork
│   ├── favicon.webp                # EXISTING — unchanged
│   └── icons/
│       ├── icon-192.png            # NEW — Android home screen / manifest "any"
│       └── icon-512.png            # NEW — splash background, app stores, manifest "any"
├── src/
│   ├── main.jsx                    # MODIFIED: hide #app-shell after React mounts
│   ├── App.jsx                     # MODIFIED: mount <IOSInstallHint />
│   ├── components/pwa/
│   │   └── IOSInstallHint.jsx      # NEW — bottom-sheet install nudge
│   └── hooks/
│       └── useStandalone.js        # NEW — { isStandalone, isIOS, isSafari } detection
└── vite.config.js                  # MODIFIED: add VitePWA plugin
```

**Why `manifest: false` (manual manifest) instead of plugin-generated:**
The plugin can generate `manifest.webmanifest` from a JS config object, but that means the actual served manifest only exists in the build output — not reviewable in PRs and harder to diff across branches. A committed `public/manifest.webmanifest` stays in source control and any field changes show up in git history.

**Why `apple-touch-icon.png` at root of `public/`:**
iOS Safari auto-fetches `/apple-touch-icon.png` when no explicit `<link>` is found. Putting it at the root is a safety net; we also add the explicit `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` so behavior is deterministic.

## Manifest (`public/manifest.webmanifest`)

```json
{
  "name": "Scorva",
  "short_name": "Scorva",
  "description": "Live scores, standings, and player stats for NBA, NFL, and NHL. Track your favorite teams and players with Scorva.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#0a0a0c",
  "background_color": "#0a0a0c",
  "lang": "en",
  "categories": ["sports"],
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    }
  ]
}
```

**Field rationale:**
- `display: "standalone"` — opens without browser chrome; the whole point of installable.
- `theme_color: "#0a0a0c"` matches existing `<meta name="theme-color">` and `surface-base` token. Used by iOS for status-bar tinting in standalone mode.
- `background_color: "#0a0a0c"` — Android splash background. Matches dark surface so there's no flash to white during launch.
- No `orientation` field — let the device decide (portrait normal, landscape if rotated). Locking would feel wrong for a sports app where users rotate to view box scores.
- No maskable icon entry — explicit choice; Android falls back to "any" icon inside system shape.

## Icon generation

Source: `frontend/public/image.png` (1024×1024 PNG, already in repo).

Generate three derived files using `pwa-asset-generator` (one-time CLI run, output committed):

| File | Size | Purpose |
|---|---|---|
| `public/apple-touch-icon.png` | 180×180 | iOS home screen |
| `public/icons/icon-192.png` | 192×192 | Manifest, Android home screen |
| `public/icons/icon-512.png` | 512×512 | Manifest, Android splash, app stores |

Implementation plan task will document the exact CLI command. The icon files are committed to git (not regenerated at build time) so the source artwork can evolve independently of the deploy pipeline.

## App-launch loading shell

Inline in `index.html` so it paints before React boots, hiding the launch white-flash that's most jarring in standalone PWA mode (no browser address bar to look at while waiting).

**Structure (added to `<body>` before `<div id="root">`):**

```html
<style>
  #app-shell {
    position: fixed;
    inset: 0;
    background: #0a0a0c;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2.5rem;
    z-index: 9999;
    transition: opacity 200ms ease;
  }
  #app-shell.hidden {
    opacity: 0;
    pointer-events: none;
  }
  #app-shell img {
    width: 11rem;
    height: 11rem;
    user-select: none;
  }
  @media (min-width: 640px) {
    #app-shell img { width: 14rem; height: 14rem; }
  }
  #app-shell-bubbles {
    display: flex;
    gap: 0.75rem;
  }
  #app-shell-bubbles span {
    width: 1rem;
    height: 1rem;
    border-radius: 9999px;
    animation: bubble-float 1s ease-in-out infinite;
  }
  @media (min-width: 640px) {
    #app-shell-bubbles span { width: 1.25rem; height: 1.25rem; }
  }
  #app-shell-bubbles span:nth-child(1) { background: #e8863a; animation-delay: 0s; }
  #app-shell-bubbles span:nth-child(2) { background: #f0974d; animation-delay: 0.2s; }
  #app-shell-bubbles span:nth-child(3) { background: #ffb88a; animation-delay: 0.4s; }
  @keyframes bubble-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-12px); }
  }
</style>
<div id="app-shell" aria-hidden="true">
  <img src="/icons/icon-192.png" alt="" width="192" height="192" decoding="async">
  <div id="app-shell-bubbles" aria-hidden="true">
    <span></span><span></span><span></span>
  </div>
</div>
```

**Color palette for bubbles:** three accent shades — `#e8863a` (token `accent`), `#f0974d` (token `accent-hover`), `#ffb88a` (lighter tint). Same brand family, subtle visual interest. User can adjust if desired without touching structure.

**Removal in `main.jsx`** after React mounts (added immediately after `createRoot(...).render(...)`):

```js
const shell = document.getElementById("app-shell");
if (shell) {
  shell.classList.add("hidden");
  shell.addEventListener("transitionend", () => shell.remove(), { once: true });
}
```

The 200ms opacity fade prevents a hard pop. Removing the element entirely (not just hiding) prevents the image and animation from staying in the DOM/CPU after the app is interactive.

**Accessibility:** `aria-hidden="true"` on the wrapper — it's purely decorative cover for the load gap, not content. Screen readers ignore it.

## iOS install hint

**Detection hook (`src/hooks/useStandalone.js`):**

Returns `{ isStandalone, isIOS, isSafari }`. Synchronous read on mount — no state needed since these don't change during a session.

- `isStandalone`: `window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches`
- `isIOS`: user-agent test for iPad/iPhone/iPod (and iPadOS Safari which reports as Mac — extra check via `navigator.maxTouchPoints > 1`)
- `isSafari`: user-agent test that excludes Chrome/Firefox/Edge on iOS (which all use WebKit but report differently)

**Component (`src/components/pwa/IOSInstallHint.jsx`):**

Render conditions (all must be true):
1. `isIOS && isSafari && !isStandalone`
2. localStorage flag `scorva:ios-install-dismissed` not set
3. Either: visit count ≥ 2 (localStorage `scorva:visit-count`), OR user has been on the site for ≥ 30 seconds this visit

The "visit 2 OR 30 seconds" rule prevents being annoying on the first 2 seconds of the first visit. Either trigger suffices, so a returning user sees it immediately.

**Visual:**
- Bottom-anchored card, full width on mobile, max ~360px centered on tablet.
- Slides in from bottom via Framer Motion (`y: 100 → 0`, ~250ms).
- Layout: small Scorva icon (32×32) + text "Install Scorva — tap [share-icon SVG] then 'Add to Home Screen'" + close X button.
- Styling matches existing card pattern: `bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)]`.
- Z-index: `z-[60]` — above content, below favorites/chat panels (which are `z-[70]`) so it doesn't collide with overlays.
- Bottom offset accounts for safe area: `bottom-[max(1rem,env(safe-area-inset-bottom))]`.

**Dismissal:**
- Tap close X → set `scorva:ios-install-dismissed = "1"` in localStorage → component unmounts.
- Persistent across sessions. No re-prompt logic. (Simpler is better; a user who dismissed it has signaled they don't want it.)

**Visit-count tracking:**
- Single `useEffect` in `App.jsx` (mounts once for the session): increment `scorva:visit-count` in localStorage if the `scorva:visit-last` timestamp is ≥ 1 hour old (or absent). Avoids over-counting rapid navigations within a session.

**Mount location:** `App.jsx`, alongside `<FavoritesPanel />` inside the providers tree, so it has access to context if needed (none currently required, but consistent with existing overlay pattern).

## Service worker (vite-plugin-pwa config)

Added to `vite.config.js`:

```js
import { VitePWA } from "vite-plugin-pwa";

// in plugins array:
VitePWA({
  registerType: "autoUpdate",
  injectRegister: "auto",
  manifest: false,                           // we use public/manifest.webmanifest
  includeAssets: [
    "favicon.webp",
    "apple-touch-icon.png",
    "icons/*.png",
    "manifest.webmanifest",
  ],
  workbox: {
    globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/api\//],   // never serve index.html for API calls
    maximumFileSizeToCacheInBytes: 3_500_000, // headroom for icon-512 + bundle chunks
  },
  devOptions: {
    enabled: false, // SW only in prod; avoids dev cache headaches
  },
}),
```

**Behavior:**
- App shell (HTML/JS/CSS/fonts/icons) is precached at install time.
- API requests pass through to network — no caching, no interception.
- On new deploy: SW installs in background, activates on next navigation. Users get the new version on next page load. No prompt. No forced reload.
- `navigateFallbackDenylist` for `/api/` is critical — without it, a backend-down state would serve cached HTML to the API call, which TanStack Query would try to parse as JSON and fail confusingly.

**Why not configure runtime caching for any API:** explicitly out of scope per the "installable only" tier. Adding even one runtime cache rule introduces "is this stale?" debugging — the next sub-project (or a future "smart caching" tier) is the right place for that.

## `index.html` changes

Net additions to `<head>`:

```html
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="Scorva">
```

`apple-mobile-web-app-status-bar-style: black` — opaque black status bar with white system text, sits above the app content. Chosen over `black-translucent` because `black-translucent` makes the app draw *under* the status bar, which would require safe-area padding on the existing navbar to avoid the logo/links being clipped by the notch. That navbar work belongs in sub-project 3 (mobile UI polish), not here. With `black`, no navbar changes are needed and standalone mode looks clean against Scorva's dark theme.

`apple-mobile-web-app-title` controls the home-screen label text under the icon.

Existing `<meta name="theme-color" content="#0a0a0c">` stays — it's already correct.

## Verification

Manual test plan (pre-merge):

1. **Build & preview locally:** `cd frontend && npm run build && npm run preview`. Confirm SW registers in DevTools → Application → Service Workers. Confirm manifest is parsed correctly in DevTools → Application → Manifest (no validation warnings).
2. **Lighthouse PWA audit:** Run from Chrome DevTools on the preview build. Expect: installable check passes, manifest valid, icons present, theme color set. Some PWA scoring categories require offline support and will fail — that's expected for our scope.
3. **Real iOS install:**
   - Load preview URL in iOS Safari on a phone.
   - Verify install hint appears (visit 2 or after 30s).
   - Dismiss it once → reload → confirm it stays dismissed.
   - Clear localStorage → tap Share → Add to Home Screen → tap home-screen icon.
   - Verify: opens in standalone mode (no Safari address bar), Scorva icon shows correctly, app-shell loading screen appears, fades out cleanly to homepage, hint does NOT show in standalone mode.
4. **App-shell sanity:** Throttle network to "Slow 3G" in DevTools, hard-reload. Confirm shell paints first, no white flash, fades out without layout jank when React mounts.
5. **Update flow:** Build, install on home screen, ship a no-op change, rebuild, redeploy, reopen the installed app. Confirm new version is active on next launch (or one launch later, depending on SW timing).

Out of scope for verification: offline behavior (we don't claim to support it).

## Out of scope (explicit)

These are deliberately deferred to other sub-projects or tiers:

- Offline support / API caching / "works on a plane"
- Android-specific polish (maskable icons, custom Android splash)
- iOS `apple-touch-startup-image` (custom splash images per device — replaced by app-shell)
- Push notifications, background sync, periodic sync
- Update prompt UI ("New version available, refresh") — using silent auto-update instead
- Replacing `favicon.webp`
- Touch gestures, swipe navigation, pull-to-refresh (sub-project 2 of 3)
- Mobile UI polish — touch targets, bottom nav, safe-area audits beyond install hint (sub-project 3 of 3)
- App-store submission (TWA for Play Store, etc.)
- Analytics for install events
