# PWA Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Scorva installable on iOS home screens with an inline launch shell, app icon set, iOS install hint, and silent service-worker auto-update.

**Architecture:** `vite-plugin-pwa` (Workbox-based) generates the service worker; manifest is hand-written and committed. Inline HTML/CSS in `index.html` paints a launch shell before React boots, which `main.jsx` fades out after mount. iOS install hint is a small React component gated on UA detection + visit count + dismissal flag (localStorage-backed).

**Tech Stack:** React 19, Vite 6, Tailwind v4, Framer Motion 12, Vitest 4 (jsdom per-file), `vite-plugin-pwa` (new).

**Spec:** `docs/superpowers/specs/2026-04-27-pwa-foundation-design.md`

**Branch:** `feat/mobile`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `frontend/public/icons/icon-192.png` | Create (binary) | 192×192 manifest icon |
| `frontend/public/icons/icon-512.png` | Create (binary) | 512×512 manifest icon |
| `frontend/public/apple-touch-icon.png` | Create (binary) | 180×180 iOS home-screen icon |
| `frontend/public/manifest.webmanifest` | Create | App identity (name, icons, theme) |
| `frontend/index.html` | Modify | Add `<link>`, iOS meta tags, inline app-shell HTML+CSS |
| `frontend/src/main.jsx` | Modify | Hide app-shell after React mounts |
| `frontend/package.json` | Modify | Add `vite-plugin-pwa` devDependency |
| `frontend/vite.config.js` | Modify | Register VitePWA plugin |
| `frontend/src/lib/pwaVisitTracking.js` | Create | `trackVisit()` and `getVisitCount()` localStorage utils |
| `frontend/src/hooks/useStandalone.js` | Create | UA detection: `{ isStandalone, isIOS, isSafari }` |
| `frontend/src/components/pwa/IOSInstallHint.jsx` | Create | Bottom-sheet install nudge for iOS Safari users |
| `frontend/src/App.jsx` | Modify | Mount `<IOSInstallHint />`, run `trackVisit()` once on mount |
| `frontend/src/__tests__/lib/pwaVisitTracking.test.js` | Create | Unit tests for visit-tracking utils |
| `frontend/src/__tests__/hooks/useStandalone.test.js` | Create | Unit tests for detection hook |
| `frontend/src/__tests__/components/IOSInstallHint.test.jsx` | Create | Component tests for render conditions + dismissal |

Files split by responsibility: detection (hook), persistence (lib util), presentation (component). Each is independently testable and small enough to hold in one read.

---

## Task 1: Generate icon files

**Files:**
- Create: `frontend/public/icons/icon-192.png` (binary, 192×192)
- Create: `frontend/public/icons/icon-512.png` (binary, 512×512)
- Create: `frontend/public/apple-touch-icon.png` (binary, 180×180)

Source artwork is `frontend/public/image.png` (1024×1024). We use macOS-built-in `sips` so no extra tooling is needed.

- [ ] **Step 1: Create the icons directory**

Run:
```bash
mkdir -p frontend/public/icons
```

- [ ] **Step 2: Generate the three PNGs from the source**

Run from repo root:
```bash
sips -z 192 192 frontend/public/image.png --out frontend/public/icons/icon-192.png
sips -z 512 512 frontend/public/image.png --out frontend/public/icons/icon-512.png
sips -z 180 180 frontend/public/image.png --out frontend/public/apple-touch-icon.png
```

Expected output: three lines like `/path/...image.png  /  /path/...icon-192.png`. No errors.

- [ ] **Step 3: Verify dimensions**

Run:
```bash
file frontend/public/icons/icon-192.png frontend/public/icons/icon-512.png frontend/public/apple-touch-icon.png
```

Expected: each line shows `PNG image data, NxN, ...` matching 192x192, 512x512, 180x180 respectively.

- [ ] **Step 4: Commit**

```bash
git add frontend/public/icons/icon-192.png frontend/public/icons/icon-512.png frontend/public/apple-touch-icon.png
git commit -m "$(cat <<'EOF'
feat(pwa): add app icons generated from image.png

Adds 192x192, 512x512, and 180x180 PNG icons sourced from the existing
1024x1024 image.png. Used by manifest.webmanifest and apple-touch-icon
link tag in subsequent tasks.
EOF
)"
```

---

## Task 2: Create the web app manifest

**Files:**
- Create: `frontend/public/manifest.webmanifest`

- [ ] **Step 1: Write the manifest file**

Create `frontend/public/manifest.webmanifest` with this exact content:

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

- [ ] **Step 2: Verify it's valid JSON**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('frontend/public/manifest.webmanifest','utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add frontend/public/manifest.webmanifest
git commit -m "$(cat <<'EOF'
feat(pwa): add hand-written manifest.webmanifest

Manifest is committed (not generated by vite-plugin-pwa) so field
changes are reviewable in PRs and tracked in git history.
display=standalone, dark theme/background to match the app surface,
and icons reference Task 1 output.
EOF
)"
```

---

## Task 3: Update index.html with PWA tags and inline app-shell

**Files:**
- Modify: `frontend/index.html`

The existing `<head>` already has `viewport-fit=cover` and `theme-color`. We add the manifest link, iOS-specific tags, and the inline app-shell `<style>` + `<div>` immediately inside `<body>` so it paints before any JS runs.

- [ ] **Step 1: Add the new `<link>` and `<meta>` tags inside `<head>`**

In `frontend/index.html`, find this section:

```html
    <link rel="dns-prefetch" href="https://a.espncdn.com" />
    <link rel="dns-prefetch" href="https://scorva.up.railway.app" />
    <link rel="preconnect" href="https://scorva.up.railway.app" crossorigin />
    <title>Scorva</title>
    <link rel="icon" type="image/webp" href="/favicon.webp">
  </head>
```

Replace with:

```html
    <link rel="dns-prefetch" href="https://a.espncdn.com" />
    <link rel="dns-prefetch" href="https://scorva.up.railway.app" />
    <link rel="preconnect" href="https://scorva.up.railway.app" crossorigin />
    <title>Scorva</title>
    <link rel="icon" type="image/webp" href="/favicon.webp">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black">
    <meta name="apple-mobile-web-app-title" content="Scorva">
  </head>
```

- [ ] **Step 2: Add inline app-shell `<style>` and `<div>` inside `<body>`**

Find the existing `<body>`:

```html
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
```

Replace with:

```html
  <body>
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
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
```

- [ ] **Step 3: Visually verify in dev**

Run:
```bash
cd frontend && npm run dev
```

Open the URL from the dev output. The app-shell should be visible briefly on first load (basketball logo + 3 bouncing accent-colored bubbles on the dark surface), then the app appears underneath. (It will not yet fade out — that comes in Task 4. For now the shell will sit on top of `#root` permanently. Confirm it renders correctly, then stop the dev server with Ctrl+C.)

Expected: visible logo + 3 bouncing bubbles, dark `#0a0a0c` background, no white flash.

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html
git commit -m "$(cat <<'EOF'
feat(pwa): add manifest, iOS meta tags, and inline launch shell to index.html

Adds <link rel="manifest">, <link rel="apple-touch-icon">, and
apple-mobile-web-app-* meta tags so iOS treats the app as installable.
Inline <style>+<div id="app-shell"> paints a basketball logo + bouncing
bubbles before React boots, masking the launch white-flash. Shell will
be hidden in Task 4 from main.jsx.
EOF
)"
```

---

## Task 4: Hide app-shell after React mounts

**Files:**
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Add the shell-hiding logic after `createRoot(...).render(...)`**

Find:

```jsx
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
        <SpeedInsights />
        <Analytics />
  </StrictMode>
)
```

Replace with:

```jsx
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
        <SpeedInsights />
        <Analytics />
  </StrictMode>
)

const appShell = document.getElementById("app-shell");
if (appShell) {
  appShell.classList.add("hidden");
  appShell.addEventListener("transitionend", () => appShell.remove(), { once: true });
}
```

- [ ] **Step 2: Visually verify in dev**

Run:
```bash
cd frontend && npm run dev
```

Open the URL. Hard-reload (Cmd+Shift+R). The app-shell should appear briefly, fade out smoothly over ~200ms, and the app should be interactive immediately. No layout shift, no flash to white. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/main.jsx
git commit -m "$(cat <<'EOF'
feat(pwa): fade out launch shell once React mounts

Hides #app-shell with a 200ms opacity transition immediately after
createRoot.render() returns, then removes the node on transitionend
so the image and animation aren't kept in the DOM.
EOF
)"
```

---

## Task 5: Add vite-plugin-pwa and configure the service worker

**Files:**
- Modify: `frontend/package.json` (devDep added by npm)
- Modify: `frontend/vite.config.js`

- [ ] **Step 1: Install the plugin**

Run:
```bash
cd frontend && npm install --save-dev vite-plugin-pwa
```

Expected: `package.json` and `package-lock.json` updated; one new dev dependency added.

- [ ] **Step 2: Wire the plugin into `vite.config.js`**

Find the top imports:

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
```

Add the import:

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
```

Then find the existing plugins line:

```js
  plugins: [tailwindcss(), react(), fontPreloadPlugin()],
```

Replace with:

```js
  plugins: [
    tailwindcss(),
    react(),
    fontPreloadPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: false,
      includeAssets: [
        "favicon.webp",
        "apple-touch-icon.png",
        "icons/*.png",
        "manifest.webmanifest",
      ],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 3_500_000,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
```

- [ ] **Step 3: Build to verify the plugin works**

Run:
```bash
cd frontend && npm run build
```

Expected: build completes without errors. Output should include lines like `PWA v...`, `precache  N entries (M KiB)`, and `files generated  dist/sw.js, dist/workbox-*.js, dist/registerSW.js`.

- [ ] **Step 4: Preview the build and verify SW registers**

Run:
```bash
cd frontend && npm run preview
```

Open the preview URL. Open DevTools → Application → Service Workers. Expected: a service worker is registered and activated for the preview origin. Open Application → Manifest. Expected: `Scorva`, dark theme, two icons, no validation warnings. Stop preview.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js
git commit -m "$(cat <<'EOF'
feat(pwa): register vite-plugin-pwa with silent auto-update

Adds the plugin in installable-only mode: precaches the app shell
(JS/CSS/HTML/fonts/icons), serves index.html for SPA navigation
(except /api/ paths), and uses registerType=autoUpdate so new
deploys activate on next navigation with no user prompt.
manifest: false because we ship a hand-written manifest.webmanifest.
EOF
)"
```

---

## Task 6: Visit-tracking utility (TDD)

**Files:**
- Create: `frontend/src/lib/pwaVisitTracking.js`
- Test: `frontend/src/__tests__/lib/pwaVisitTracking.test.js`

Lives in `lib/` because it's a pure side-effecting util with no React dependency. Used by Task 8 (component reads `getVisitCount`) and Task 9 (App.jsx calls `trackVisit` once on mount).

- [ ] **Step 1: Create the test file**

Create `frontend/src/__tests__/lib/pwaVisitTracking.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { trackVisit, getVisitCount } from "../../lib/pwaVisitTracking.js";

describe("pwaVisitTracking", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00Z"));
  });

  describe("trackVisit", () => {
    it("sets count=1 and timestamp on first call", () => {
      trackVisit();
      expect(localStorage.getItem("scorva:visit-count")).toBe("1");
      expect(localStorage.getItem("scorva:visit-last")).toBe(String(Date.now()));
    });

    it("does not increment when called again within 1 hour", () => {
      trackVisit();
      vi.advanceTimersByTime(59 * 60 * 1000); // 59 minutes
      trackVisit();
      expect(localStorage.getItem("scorva:visit-count")).toBe("1");
    });

    it("increments when called after 1 hour", () => {
      trackVisit();
      vi.advanceTimersByTime(60 * 60 * 1000 + 1); // 1 hour + 1ms
      trackVisit();
      expect(localStorage.getItem("scorva:visit-count")).toBe("2");
    });
  });

  describe("getVisitCount", () => {
    it("returns 0 when never tracked", () => {
      expect(getVisitCount()).toBe(0);
    });

    it("returns the parsed count after tracking", () => {
      trackVisit();
      expect(getVisitCount()).toBe(1);
    });

    it("returns 0 when stored value is non-numeric (defensive)", () => {
      localStorage.setItem("scorva:visit-count", "garbage");
      expect(getVisitCount()).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

Run:
```bash
cd frontend && npm test -- src/__tests__/lib/pwaVisitTracking.test.js
```

Expected: test file fails to import — error like `Cannot find module '../../lib/pwaVisitTracking.js'` or similar.

- [ ] **Step 3: Implement the util**

Create `frontend/src/lib/pwaVisitTracking.js`:

```js
const COUNT_KEY = "scorva:visit-count";
const LAST_KEY = "scorva:visit-last";
const ONE_HOUR_MS = 60 * 60 * 1000;

export function trackVisit() {
  const now = Date.now();
  const last = Number(localStorage.getItem(LAST_KEY));
  if (Number.isFinite(last) && last > 0 && now - last < ONE_HOUR_MS) return;
  const current = getVisitCount();
  localStorage.setItem(COUNT_KEY, String(current + 1));
  localStorage.setItem(LAST_KEY, String(now));
}

export function getVisitCount() {
  const raw = localStorage.getItem(COUNT_KEY);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
```

- [ ] **Step 4: Run the test — expect pass**

Run:
```bash
cd frontend && npm test -- src/__tests__/lib/pwaVisitTracking.test.js
```

Expected: all 6 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/pwaVisitTracking.js frontend/src/__tests__/lib/pwaVisitTracking.test.js
git commit -m "$(cat <<'EOF'
feat(pwa): add visit-tracking util for install hint gating

trackVisit() increments scorva:visit-count once per hour to avoid
over-counting rapid same-session navigations. getVisitCount() reads
the stored count defensively (returns 0 for missing/garbage values).
EOF
)"
```

---

## Task 7: useStandalone detection hook (TDD)

**Files:**
- Create: `frontend/src/hooks/useStandalone.js`
- Test: `frontend/src/__tests__/hooks/useStandalone.test.js`

Synchronous read-once on mount — these values don't change during a session.

- [ ] **Step 1: Create the test file**

Create `frontend/src/__tests__/hooks/useStandalone.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

let mockUserAgent;
let mockStandalone;
let mockMatches;

beforeEach(() => {
  vi.resetModules();
  mockUserAgent = "";
  mockStandalone = undefined;
  mockMatches = false;

  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    get: () => mockUserAgent,
  });
  Object.defineProperty(window.navigator, "standalone", {
    configurable: true,
    get: () => mockStandalone,
  });
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    configurable: true,
    get: () => (mockUserAgent.includes("iPad") ? 5 : 0),
  });
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: mockMatches,
    media: "",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

async function importHook() {
  const mod = await import("../../hooks/useStandalone.js");
  return mod.useStandalone;
}

describe("useStandalone", () => {
  it("detects iOS Safari on iPhone", async () => {
    mockUserAgent =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const useStandalone = await importHook();
    const { result } = renderHook(() => useStandalone());
    expect(result.current).toEqual({ isIOS: true, isSafari: true, isStandalone: false });
  });

  it("detects iOS Chrome (CriOS) as not Safari", async () => {
    mockUserAgent =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/118.0.0.0 Mobile/15E148 Safari/604.1";
    const useStandalone = await importHook();
    const { result } = renderHook(() => useStandalone());
    expect(result.current).toEqual({ isIOS: true, isSafari: false, isStandalone: false });
  });

  it("detects iPadOS Safari (UA reports as Mac, but has touch)", async () => {
    mockUserAgent =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 iPad";
    const useStandalone = await importHook();
    const { result } = renderHook(() => useStandalone());
    expect(result.current.isIOS).toBe(true);
  });

  it("returns isStandalone=true when navigator.standalone is true", async () => {
    mockUserAgent =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    mockStandalone = true;
    const useStandalone = await importHook();
    const { result } = renderHook(() => useStandalone());
    expect(result.current.isStandalone).toBe(true);
  });

  it("returns isStandalone=true when display-mode media query matches", async () => {
    mockUserAgent = "Mozilla/5.0 (Linux; Android 10) Chrome/118 Mobile";
    mockMatches = true;
    const useStandalone = await importHook();
    const { result } = renderHook(() => useStandalone());
    expect(result.current.isStandalone).toBe(true);
  });

  it("returns all false on desktop Chrome", async () => {
    mockUserAgent =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36";
    const useStandalone = await importHook();
    const { result } = renderHook(() => useStandalone());
    expect(result.current).toEqual({ isIOS: false, isSafari: false, isStandalone: false });
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

Run:
```bash
cd frontend && npm test -- src/__tests__/hooks/useStandalone.test.js
```

Expected: import error (`Cannot find module '../../hooks/useStandalone.js'`).

- [ ] **Step 3: Implement the hook**

Create `frontend/src/hooks/useStandalone.js`:

```js
import { useMemo } from "react";

export function useStandalone() {
  return useMemo(() => {
    if (typeof window === "undefined") {
      return { isStandalone: false, isIOS: false, isSafari: false };
    }
    const ua = window.navigator.userAgent || "";

    const isIPhoneOrIPodOrIPad = /iPhone|iPod|iPad/.test(ua);
    const isIPadOS = /Macintosh/.test(ua) && (window.navigator.maxTouchPoints || 0) > 1;
    const isIOS = isIPhoneOrIPodOrIPad || isIPadOS;

    const isWebKit = /AppleWebKit/.test(ua);
    const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|Chrome\//.test(ua);
    const isSafari = isWebKit && !isOtherBrowser;

    const standaloneFlag = window.navigator.standalone === true;
    const displayModeStandalone =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches;
    const isStandalone = standaloneFlag || displayModeStandalone;

    return { isStandalone, isIOS, isSafari };
  }, []);
}
```

- [ ] **Step 4: Run the test — expect pass**

Run:
```bash
cd frontend && npm test -- src/__tests__/hooks/useStandalone.test.js
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useStandalone.js frontend/src/__tests__/hooks/useStandalone.test.js
git commit -m "$(cat <<'EOF'
feat(pwa): add useStandalone hook for iOS install hint gating

Returns { isStandalone, isIOS, isSafari } via UA + display-mode
detection. Distinguishes iOS Safari from iOS Chrome/Firefox/Edge
(all of which use WebKit but report distinct UA tokens) and detects
iPadOS Safari which UA-reports as Mac.
EOF
)"
```

---

## Task 8: IOSInstallHint component (TDD)

**Files:**
- Create: `frontend/src/components/pwa/IOSInstallHint.jsx`
- Test: `frontend/src/__tests__/components/IOSInstallHint.test.jsx`

Mocks the standalone hook and the visit-tracking util so we can drive the render conditions directly.

- [ ] **Step 1: Create the test file**

Create `frontend/src/__tests__/components/IOSInstallHint.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

vi.mock("../../hooks/useStandalone.js", () => ({
  useStandalone: vi.fn(),
}));

vi.mock("../../lib/pwaVisitTracking.js", () => ({
  getVisitCount: vi.fn(),
  trackVisit: vi.fn(),
}));

import { useStandalone } from "../../hooks/useStandalone.js";
import { getVisitCount } from "../../lib/pwaVisitTracking.js";
import IOSInstallHint from "../../components/pwa/IOSInstallHint.jsx";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("IOSInstallHint", () => {
  it("renders nothing on non-iOS browsers", () => {
    useStandalone.mockReturnValue({ isIOS: false, isSafari: true, isStandalone: false });
    getVisitCount.mockReturnValue(5);
    const { container } = render(<IOSInstallHint />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing on iOS Chrome (not Safari)", () => {
    useStandalone.mockReturnValue({ isIOS: true, isSafari: false, isStandalone: false });
    getVisitCount.mockReturnValue(5);
    const { container } = render(<IOSInstallHint />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when already installed (standalone)", () => {
    useStandalone.mockReturnValue({ isIOS: true, isSafari: true, isStandalone: true });
    getVisitCount.mockReturnValue(5);
    const { container } = render(<IOSInstallHint />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when previously dismissed", () => {
    localStorage.setItem("scorva:ios-install-dismissed", "1");
    useStandalone.mockReturnValue({ isIOS: true, isSafari: true, isStandalone: false });
    getVisitCount.mockReturnValue(5);
    const { container } = render(<IOSInstallHint />);
    expect(container.firstChild).toBeNull();
  });

  it("shows immediately when visit count >= 2", () => {
    useStandalone.mockReturnValue({ isIOS: true, isSafari: true, isStandalone: false });
    getVisitCount.mockReturnValue(2);
    render(<IOSInstallHint />);
    expect(screen.getByText(/Install Scorva/i)).toBeInTheDocument();
  });

  it("waits 30 seconds when visit count is 1", async () => {
    vi.useFakeTimers();
    useStandalone.mockReturnValue({ isIOS: true, isSafari: true, isStandalone: false });
    getVisitCount.mockReturnValue(1);

    render(<IOSInstallHint />);
    expect(screen.queryByText(/Install Scorva/i)).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText(/Install Scorva/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("dismisses on close click and persists to localStorage", () => {
    useStandalone.mockReturnValue({ isIOS: true, isSafari: true, isStandalone: false });
    getVisitCount.mockReturnValue(2);
    render(<IOSInstallHint />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(localStorage.getItem("scorva:ios-install-dismissed")).toBe("1");
    expect(screen.queryByText(/Install Scorva/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

Run:
```bash
cd frontend && npm test -- src/__tests__/components/IOSInstallHint.test.jsx
```

Expected: import error for `IOSInstallHint.jsx` (does not exist yet).

- [ ] **Step 3: Implement the component**

Create the directory and file:

```bash
mkdir -p frontend/src/components/pwa
```

Create `frontend/src/components/pwa/IOSInstallHint.jsx`:

```jsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStandalone } from "../../hooks/useStandalone.js";
import { getVisitCount } from "../../lib/pwaVisitTracking.js";

const DISMISS_KEY = "scorva:ios-install-dismissed";
const FIRST_VISIT_DELAY_MS = 30_000;

export default function IOSInstallHint() {
  const { isStandalone, isIOS, isSafari } = useStandalone();
  const [dismissed, setDismissed] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1"
  );
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOS || !isSafari || isStandalone || dismissed) {
      setShow(false);
      return;
    }
    const visits = getVisitCount();
    if (visits >= 2) {
      setShow(true);
      return;
    }
    const t = setTimeout(() => setShow(true), FIRST_VISIT_DELAY_MS);
    return () => clearTimeout(t);
  }, [isIOS, isSafari, isStandalone, dismissed]);

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (!isIOS || !isSafari || isStandalone || dismissed) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="fixed left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-[360px] bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] p-4 flex items-center gap-3"
          style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
          role="dialog"
          aria-label="Install Scorva"
        >
          <img
            src="/apple-touch-icon.png"
            alt=""
            width="32"
            height="32"
            className="w-8 h-8 rounded-lg shrink-0"
          />
          <p className="flex-1 text-sm text-text-primary leading-snug">
            <span className="font-semibold">Install Scorva</span>
            <span className="text-text-secondary"> — tap </span>
            <ShareIcon />
            <span className="text-text-secondary"> then "Add to Home Screen"</span>
          </p>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="shrink-0 w-8 h-8 flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="inline-block align-text-bottom mx-0.5 text-accent"
    >
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}
```

- [ ] **Step 4: Run the test — expect pass**

Run:
```bash
cd frontend && npm test -- src/__tests__/components/IOSInstallHint.test.jsx
```

Expected: all 7 tests pass.

If a test fails on the Framer Motion render due to the project's existing Framer Motion mocking pattern, check `MEMORY.md` reference `feedback_framer_motion_test_mock.md` for the established pattern and adapt accordingly.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pwa/IOSInstallHint.jsx frontend/src/__tests__/components/IOSInstallHint.test.jsx
git commit -m "$(cat <<'EOF'
feat(pwa): add IOSInstallHint bottom-sheet nudge

Renders a small card on iOS Safari (non-standalone) prompting the
user to Add to Home Screen. Shows immediately on visit 2+, or after
30s on visit 1. Dismissal persists across sessions via localStorage
(scorva:ios-install-dismissed). Z-index 60 stays under existing
panels (z-70). Bottom offset respects safe-area-inset-bottom.
EOF
)"
```

---

## Task 9: Mount IOSInstallHint and wire visit tracking in App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

The hint component needs to mount inside the providers tree (so future context access works) but at the same nesting level as other overlays. Visit-tracking runs once per session via `useEffect` in the `App` component itself.

- [ ] **Step 1: Update the imports**

In `frontend/src/App.jsx`, find the existing first import:

```jsx
import { lazy, Suspense } from "react";
```

Replace with:

```jsx
import { lazy, Suspense, useEffect } from "react";
```

Then find the last import in the file (the `AuthCallback` import):

```jsx
import AuthCallback from "./pages/AuthCallback.jsx";
```

Add these two lines immediately after it:

```jsx
import IOSInstallHint from "./components/pwa/IOSInstallHint.jsx";
import { trackVisit } from "./lib/pwaVisitTracking.js";
```

- [ ] **Step 2: Add the AppShellInner function and use it inside the providers tree**

In `frontend/src/App.jsx`, find the `AnimatedRoutes` function declaration and immediately ABOVE it, add this new function:

```jsx
function AppShellInner() {
  useEffect(() => {
    trackVisit();
  }, []);

  return (
    <div className="bg-surface-primary text-text-primary min-h-screen font-sans antialiased">
      <Navbar />
      <ScrollToTop />
      <ErrorBoundary>
        <AnimatedRoutes />
      </ErrorBoundary>
      <Footer />
      <IOSInstallHint />
    </div>
  );
}
```

Then find the existing tree inside the `App()` function:

```jsx
                  <FavoritesPanelProvider>
                    <div className="bg-surface-primary text-text-primary min-h-screen font-sans antialiased">
                      <Navbar />
                      <ScrollToTop />
                      <ErrorBoundary>
                        <AnimatedRoutes />
                      </ErrorBoundary>
                      <Footer />
                    </div>
                  </FavoritesPanelProvider>
```

Replace with:

```jsx
                  <FavoritesPanelProvider>
                    <AppShellInner />
                  </FavoritesPanelProvider>
```

The extraction is needed because `App()` itself can't cleanly run `useEffect` — it returns nested providers, and we want `trackVisit` to run inside the providers tree (so future provider-aware extensions don't require restructuring). `AppShellInner` also gives us a clean place to mount `<IOSInstallHint />` alongside the existing layout.

- [ ] **Step 3: Run the full test suite**

Run:
```bash
cd frontend && npm test
```

Expected: all tests pass, including the three new test files added in Tasks 6/7/8 and the existing suite (App.jsx changes shouldn't break anything since the rendered tree is functionally identical plus one new component).

- [ ] **Step 4: Manually verify in dev**

Run:
```bash
cd frontend && npm run dev
```

Open the dev URL in a desktop browser. Open DevTools → Application → Local Storage. After page load, expect `scorva:visit-count = "1"` and `scorva:visit-last` set. Reload — count should stay at 1 (within the same hour). The install hint should NOT show on desktop (not iOS). Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "$(cat <<'EOF'
feat(pwa): mount IOSInstallHint and track visits in App.jsx

Extracts the in-providers content into AppShellInner so a useEffect
can call trackVisit() once per session inside the providers tree.
Mounts <IOSInstallHint /> alongside Footer; component self-gates on
iOS Safari + non-standalone + not-dismissed.
EOF
)"
```

---

## Task 10: Final verification

**Files:** none modified

- [ ] **Step 1: Run the project verify command**

Run:
```bash
cd frontend && npm run verify
```

Expected: lint passes, all tests pass, build succeeds. If lint fails on any new file, fix the lint warnings (likely formatting only) and re-run before proceeding. If tests fail, debug before proceeding.

- [ ] **Step 2: Build + preview, then run the manual test plan from the spec**

Run:
```bash
cd frontend && npm run preview
```

Run through the spec's verification section (`docs/superpowers/specs/2026-04-27-pwa-foundation-design.md` → "Verification"). Specifically:

1. Open the preview URL. DevTools → Application → Service Workers → confirm SW is activated.
2. DevTools → Application → Manifest → confirm `Scorva`, dark theme, both icons present, no warnings.
3. DevTools → Lighthouse → run a PWA audit on the preview build. Expect "Installable" check to pass. (Offline-related checks will fail — expected for our scope.)
4. DevTools → Network → throttle to "Slow 3G" → hard reload. Confirm the app-shell paints first, fades out cleanly when React mounts. No white flash, no layout jank.
5. Stop preview.

- [ ] **Step 3: Real iOS install test**

Get the preview URL onto an iPhone (use ngrok or deploy to a preview environment). On the iPhone in Safari:

1. Verify the install hint appears (immediately if you've visited twice, or after 30s on first visit).
2. Tap close X → reload → confirm hint stays dismissed.
3. Clear Safari site data → reload → tap Share → "Add to Home Screen" → confirm Scorva icon and label appear correctly on the home screen.
4. Tap the home-screen icon. Expect: opens in standalone mode (no Safari address bar), dark `#0a0a0c` status bar with white system text, app-shell loading screen visible briefly, then the homepage.
5. Inside the standalone app, confirm the install hint does NOT appear (because `isStandalone` is true).

- [ ] **Step 4: No commit needed for verification**

Verification is read-only. If issues are found in steps 1–3, debug and add follow-up tasks rather than amending earlier commits.

---

## Definition of Done

- All 10 tasks complete, each with its own commit on `feat/mobile`.
- `npm run verify` passes from a clean tree.
- Lighthouse "Installable" check passes on the production build.
- Real-device iOS install works: standalone window, correct icon, correct status bar style, app-shell paints, install hint behaves correctly across (a) first visit / (b) returning visit / (c) post-dismissal / (d) post-install.
- Spec out-of-scope items remain out of scope (no API caching, no Android maskable icon, no apple-touch-startup-image, no update prompt).
