# Navbar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Navbar so league links (NBA / NFL / NHL) sit next to the brand on the left and the search bar collapses behind a magnifier icon on the right, between Reports and the avatar. Clicking the icon expands inline on desktop or drops a search panel on mobile, with X / Esc / outside-click / route-change all closing it. `/` opens search from anywhere.

**Architecture:** Extract the search trigger + open-state UI into a new `NavbarSearch.jsx` component that owns its own `isOpen` / `query` state, the `useSearch` hook, and the desktop-inline + mobile-drop-panel renderings. `Navbar.jsx` becomes pure layout (brand + leagues left, Reports + `<NavbarSearch />` + auth right) and drops its mobile search row entirely. The existing `SearchBar.jsx` is reused unchanged except for an optional `inputRef` prop so `NavbarSearch` can auto-focus on open.

**Tech Stack:** React 19, React Router 7, TanStack Query v5, Tailwind v4 (Scorva tokens), Vitest + Testing Library + jsdom (per `frontend/docs/testing.md`).

**Reference context:** Existing `frontend/src/components/layout/Navbar.jsx`, `frontend/src/components/ui/SearchBar.jsx`, `frontend/src/hooks/data/useSearch.js`. The global live-games rail (`GlobalSlate`) sticks to `sm:top-14`, so the desktop nav row must stay at its current ~56px height — none of these changes should grow it. The mobile search row goes away entirely; the rail isn't sticky on mobile, so removing the row simply reclaims vertical space.

---

## File Structure

**Create:**
- `frontend/src/components/layout/NavbarSearch.jsx` — magnifier trigger + open-state container; owns `isOpen` / `query`, the `useSearch` call, click-outside / Esc / `/` listeners, route-change auto-close, and renders both the desktop-inline pill and the mobile drop-panel
- `frontend/src/__tests__/components/NavbarSearch.test.jsx`

**Modify:**
- `frontend/src/components/ui/SearchBar.jsx` — accept an optional `inputRef` prop and forward it to the underlying `<input>` (needed so `NavbarSearch` can auto-focus on open). All other behavior unchanged.
- `frontend/src/__tests__/components/SearchBar.test.jsx` — add one test for the new prop.
- `frontend/src/components/layout/Navbar.jsx` — drop the inline `useSearch` call, the `query`/`setQuery` state, the centered desktop search slot, and the mobile search row; mount `<NavbarSearch />` inside the right cluster between Reports and auth; the league links stay where they are (already in the right cluster today, but become the left-cluster cohabitants of the brand under the new layout — see Task 7).
- `frontend/src/__tests__/components/Navbar.test.jsx` — drop the now-irrelevant `useSearch` and `SearchBar` mocks; mock `NavbarSearch` instead so the existing assertions stay focused on layout / auth.

---

### Task 1: Add `inputRef` prop to `SearchBar`

**Files:**
- Modify: `frontend/src/components/ui/SearchBar.jsx`
- Test:   `frontend/src/__tests__/components/SearchBar.test.jsx`

`SearchBar` currently doesn't expose its `<input>` ref. `NavbarSearch` needs to focus the input the moment the user clicks the magnifier — without the search field being focused, the `/`-shortcut and click-to-open flows feel broken. The cleanest fix is one optional prop: `inputRef`. No behavior change for existing callers.

- [ ] **Step 1: Write the failing test**

Add a new test case to `frontend/src/__tests__/components/SearchBar.test.jsx` directly above the closing `});` of the `describe("SearchBar", ...)` block:

```jsx
  it("forwards inputRef to the underlying input element", () => {
    const ref = { current: null };
    render(
      <SearchBar
        allItems={[]}
        query=""
        setQuery={vi.fn()}
        loading={false}
        inputRef={ref}
      />
    );
    expect(ref.current).toBe(screen.getByRole("textbox"));
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/components/SearchBar.test.jsx -t "forwards inputRef"`
Expected: FAIL — `expected null to be HTMLInputElement` (or similar). `ref.current` is `null` because `SearchBar` doesn't pass the ref through yet.

- [ ] **Step 3: Add the prop and forward it**

Edit `frontend/src/components/ui/SearchBar.jsx`. Change the function signature on line 9:

```jsx
export default function SearchBar({ allItems, query, setQuery, loading }) {
```

to:

```jsx
export default function SearchBar({ allItems, query, setQuery, loading, inputRef }) {
```

Then on the `<input>` element (line 46–53), add the `ref` attribute:

```jsx
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players, teams, games, dates..."
          className="w-full px-4 py-2 pr-10 rounded-full bg-surface-elevated text-text-primary placeholder-text-tertiary border border-white/[0.08] focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/30 transition-all duration-200 text-base"
          autoComplete="off"
        />
```

- [ ] **Step 4: Run the full SearchBar test file to verify all pass**

Run: `cd frontend && npx vitest run src/__tests__/components/SearchBar.test.jsx`
Expected: PASS — all existing tests + the new one.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/SearchBar.jsx frontend/src/__tests__/components/SearchBar.test.jsx
git commit -m "feat(SearchBar): forward optional inputRef to the input element"
```

---

### Task 2: Scaffold `NavbarSearch` (closed state — magnifier button only)

**Files:**
- Create: `frontend/src/components/layout/NavbarSearch.jsx`
- Test:   `frontend/src/__tests__/components/NavbarSearch.test.jsx`

Start with the closed state only: render a button with the search icon and `aria-label="Open search"`. No state yet — that lands in the next task. This sets up the file, the test harness, and the mocking pattern subsequent tasks build on.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/__tests__/components/NavbarSearch.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ prefetchQuery: vi.fn() }),
}));

vi.mock("../../hooks/data/useSearch.js", () => ({
  useSearch: vi.fn(() => ({ results: [], loading: false })),
}));

vi.mock("../../hooks/data/useDuplicatePlayerSlugs.js", () => ({
  useDuplicatePlayerSlugs: () => ({}),
  useDuplicatePlayerSlugsAll: () => ({ nba: {}, nfl: {}, nhl: {} }),
}));

const NavbarSearch = (await import("../../components/layout/NavbarSearch.jsx")).default;

function renderAt(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NavbarSearch />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NavbarSearch — closed state", () => {
  it("renders the magnifier button with an Open search label", () => {
    renderAt();
    expect(screen.getByRole("button", { name: /open search/i })).toBeInTheDocument();
  });

  it("does not render the search input when closed", () => {
    renderAt();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/components/NavbarSearch.test.jsx`
Expected: FAIL — `Failed to resolve import "../../components/layout/NavbarSearch.jsx"`.

- [ ] **Step 3: Create the minimal component**

Create `frontend/src/components/layout/NavbarSearch.jsx`:

```jsx
export default function NavbarSearch() {
  return (
    <button
      type="button"
      aria-label="Open search"
      className="touch-target flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors duration-200"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/components/NavbarSearch.test.jsx`
Expected: PASS — both assertions pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/NavbarSearch.jsx frontend/src/__tests__/components/NavbarSearch.test.jsx
git commit -m "feat(NavbarSearch): scaffold closed-state magnifier button"
```

---

### Task 3: Open / close behavior — click magnifier, X, Esc, click-outside

**Files:**
- Modify: `frontend/src/components/layout/NavbarSearch.jsx`
- Modify: `frontend/src/__tests__/components/NavbarSearch.test.jsx`

Add the core open/close state machine: clicking the magnifier opens; clicking the X-close button, pressing Esc, or clicking outside the component closes. The desktop-inline rendering of `SearchBar` lands in this task too — it's what "open" looks like in jsdom (mobile and desktop share the same DOM in tests; Tailwind responsive classes only differ visually).

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/__tests__/components/NavbarSearch.test.jsx` (above the final closing `});` of the file, after the existing `describe(...)`):

```jsx
import { fireEvent } from "@testing-library/react";

describe("NavbarSearch — open / close", () => {
  it("opens when the magnifier is clicked", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close search/i })).toBeInTheDocument();
  });

  it("closes when the X button is clicked", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    fireEvent.click(screen.getByRole("button", { name: /close search/i }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("closes when Escape is pressed", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("closes when clicking outside the component", () => {
    const outside = document.createElement("div");
    outside.setAttribute("data-testid", "outside");
    document.body.appendChild(outside);

    renderAt();
    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    fireEvent.mouseDown(outside);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    document.body.removeChild(outside);
  });

  it("does not close when clicking inside the open container", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    fireEvent.mouseDown(screen.getByRole("textbox"));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/__tests__/components/NavbarSearch.test.jsx`
Expected: 5 new tests FAIL — `Unable to find an accessible element with the role "textbox"` etc.

- [ ] **Step 3: Implement open / close**

Replace the entire contents of `frontend/src/components/layout/NavbarSearch.jsx` with:

```jsx
import { useEffect, useRef, useState } from "react";
import SearchBar from "../ui/SearchBar.jsx";
import { useSearch } from "../../hooks/data/useSearch.js";

export default function NavbarSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { results, loading } = useSearch(query);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  function open() {
    setQuery("");
    setIsOpen(true);
  }

  function close() {
    setQuery("");
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        close();
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative flex items-center">
      {!isOpen && (
        <button
          type="button"
          onClick={open}
          aria-label="Open search"
          className="touch-target flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {isOpen && (
        <div
          className="
            fixed left-0 right-0 top-[calc(env(safe-area-inset-top)+3rem)] px-5 py-3 bg-[#0a0a0c] border-b border-white/[0.06] z-40 flex items-center gap-2
            sm:static sm:left-auto sm:right-auto sm:top-auto sm:px-0 sm:py-0 sm:bg-transparent sm:border-0 sm:z-auto sm:w-80
          "
        >
          <SearchBar
            allItems={results}
            query={query}
            setQuery={setQuery}
            loading={loading}
            inputRef={inputRef}
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close search"
            className="touch-target flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
```

The open-state container is a single element styled responsively: on mobile it's a fixed-position drop-panel below the nav row (`top-[calc(env(safe-area-inset-top)+3rem)]` ≈ 48px from the very top, sitting right under the navbar); on desktop (`sm:`) it reverts to inline static positioning at width `w-80` (320px) inside the right cluster. The DOM is identical at both breakpoints, so all jsdom tests remain valid — only the visual layout differs.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/__tests__/components/NavbarSearch.test.jsx`
Expected: PASS — all 7 tests (2 from Task 2 + 5 new).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/NavbarSearch.jsx frontend/src/__tests__/components/NavbarSearch.test.jsx
git commit -m "feat(NavbarSearch): open on click, close on X / Esc / outside-click"
```

---

### Task 4: `/` keyboard shortcut to open search

**Files:**
- Modify: `frontend/src/components/layout/NavbarSearch.jsx`
- Modify: `frontend/src/__tests__/components/NavbarSearch.test.jsx`

Pressing `/` anywhere on the page opens search — but **only** if focus isn't already inside another text-input context (otherwise users typing the `/` character mid-edit would be hijacked). Modifier-key combos (Cmd/Ctrl/Alt + /) are also ignored to leave OS / browser shortcuts intact.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/__tests__/components/NavbarSearch.test.jsx`:

```jsx
describe("NavbarSearch — slash shortcut", () => {
  it("opens when '/' is pressed and focus is on body", () => {
    renderAt();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "/" });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("does NOT open when '/' is pressed inside another input", () => {
    const otherInput = document.createElement("input");
    document.body.appendChild(otherInput);
    otherInput.focus();

    renderAt();
    fireEvent.keyDown(otherInput, { key: "/" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    document.body.removeChild(otherInput);
  });

  it("does NOT open when '/' is pressed inside a textarea", () => {
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    ta.focus();

    renderAt();
    fireEvent.keyDown(ta, { key: "/" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    document.body.removeChild(ta);
  });

  it("does NOT open when '/' is pressed with a modifier key (Cmd / Ctrl / Alt)", () => {
    renderAt();
    fireEvent.keyDown(document.body, { key: "/", metaKey: true });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "/", ctrlKey: true });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "/", altKey: true });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/__tests__/components/NavbarSearch.test.jsx -t "slash"`
Expected: FAIL — opening test expects `textbox` after `/` keypress; currently no such handler exists.

- [ ] **Step 3: Add a `isTypingContext` helper and a global keydown listener**

Two targeted edits to `frontend/src/components/layout/NavbarSearch.jsx`.

(a) Add the helper directly above the `export default function NavbarSearch()` line:

```jsx
function isTypingContext(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (target.isContentEditable) return true;
  return false;
}
```

(b) Add a second `useEffect` directly below the close-side `useEffect` (the one with `[isOpen]` deps) and above the `return` statement:

```jsx
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== "/") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingContext(e.target)) return;
      e.preventDefault();
      open();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
```

The empty deps array is intentional: the listener only needs to be attached once for the lifetime of the component. The `open()` reference is stable across renders because it's defined inside the component but only ever calls `setQuery` / `setIsOpen` — both of which are stable React setters.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/__tests__/components/NavbarSearch.test.jsx`
Expected: PASS — all 11 tests (2 + 5 + 4).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/NavbarSearch.jsx frontend/src/__tests__/components/NavbarSearch.test.jsx
git commit -m "feat(NavbarSearch): open with '/' shortcut outside typing contexts"
```

---

### Task 5: Auto-focus the input on open + verify clear-on-open

**Files:**
- Modify: `frontend/src/components/layout/NavbarSearch.jsx`
- Modify: `frontend/src/__tests__/components/NavbarSearch.test.jsx`

The component should focus the search input as soon as it opens (so the user can type immediately) and the query should always start blank — even if the user typed something previously, closed, and reopened. The `setQuery("")` calls inside `open()` and `close()` already cover the clear-on-open contract; this task adds the focus side-effect and asserts both behaviors.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/__tests__/components/NavbarSearch.test.jsx`:

```jsx
describe("NavbarSearch — focus + query reset", () => {
  it("focuses the input when the search opens", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
  });

  it("clears the query when the search reopens", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "lebron" } });
    expect(screen.getByRole("textbox")).toHaveValue("lebron");

    fireEvent.click(screen.getByRole("button", { name: /close search/i }));
    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/__tests__/components/NavbarSearch.test.jsx -t "focus \\+ query reset"`
Expected: FAIL — `document.activeElement` is `document.body`, not the input. The clear-on-reopen test passes already because `open()` calls `setQuery("")`, but run it anyway to confirm.

- [ ] **Step 3: Add the auto-focus effect**

In `frontend/src/components/layout/NavbarSearch.jsx`, add this `useEffect` directly after the existing `useEffect` that wires the `/` shortcut:

```jsx
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/__tests__/components/NavbarSearch.test.jsx`
Expected: PASS — all 13 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/NavbarSearch.jsx frontend/src/__tests__/components/NavbarSearch.test.jsx
git commit -m "feat(NavbarSearch): auto-focus input on open and reset query on reopen"
```

---

### Task 6: Close on route change

**Files:**
- Modify: `frontend/src/components/layout/NavbarSearch.jsx`
- Modify: `frontend/src/__tests__/components/NavbarSearch.test.jsx`

When the user picks a result, `SearchBar.handleSelect` calls `navigate(...)` and clears the query. We want the `NavbarSearch` shell to close at the same moment, even when navigation happens by other means (e.g., the user manually clicks a navbar link while search is open). Hooking into `useLocation` and closing when the path or search string changes covers both flows without needing a callback prop on `SearchBar`.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/__tests__/components/NavbarSearch.test.jsx`:

```jsx
import { useNavigate } from "react-router-dom";

function NavigateProbe({ to }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)} data-testid="probe">
      go
    </button>
  );
}

describe("NavbarSearch — route change", () => {
  it("closes when the route changes", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <NavbarSearch />
        <NavigateProbe to="/nba" />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("probe"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/components/NavbarSearch.test.jsx -t "route change"`
Expected: FAIL — `expected textbox not to be in document` (search stays open after navigation).

- [ ] **Step 3: Add the route-change effect**

In `frontend/src/components/layout/NavbarSearch.jsx`:

(a) Add a new react-router import directly below the existing `import SearchBar from ...` line at the top of the file:

```jsx
import { useLocation } from "react-router-dom";
```

(b) Inside the component, near the other hooks (just below `const inputRef = useRef(null);`), add:

```jsx
  const location = useLocation();
```

(c) Add this effect directly after the auto-focus effect:

```jsx
  useEffect(() => {
    setIsOpen(false);
    setQuery("");
  }, [location.pathname, location.search]);
```

The effect intentionally calls `setIsOpen` / `setQuery` directly rather than `close()` to avoid an unnecessary dependency on the function identity in the deps array (the effect should only re-run on location change, not on every render).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/__tests__/components/NavbarSearch.test.jsx`
Expected: PASS — all 14 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/NavbarSearch.jsx frontend/src/__tests__/components/NavbarSearch.test.jsx
git commit -m "feat(NavbarSearch): close automatically when the route changes"
```

---

### Task 7: Wire `NavbarSearch` into `Navbar` and restructure the layout

**Files:**
- Modify: `frontend/src/components/layout/Navbar.jsx`
- Modify: `frontend/src/__tests__/components/Navbar.test.jsx`

The new layout: brand → leagues (left cluster, abutting the brand), then `ml-auto` shoves Reports → `<NavbarSearch />` → divider → auth into the right cluster. The mobile dedicated search row goes away. Internal `query` / `setQuery` state and the `useSearch` import disappear from `Navbar.jsx` — they now live inside `NavbarSearch`.

- [ ] **Step 1: Update the Navbar test mocks first**

The current `Navbar.test.jsx` mocks `useSearch` and `SearchBar` because today's Navbar mounts both directly. After this task neither is rendered by Navbar — `NavbarSearch` is. Replace those two mocks with a `NavbarSearch` mock so the existing five layout/auth assertions stay focused.

Edit `frontend/src/__tests__/components/Navbar.test.jsx`. Replace lines 44–52 (the `useSearch` mock and the `SearchBar` mock) with this single `NavbarSearch` mock:

```jsx
// Mock NavbarSearch so the layout tests stay focused on the navbar shell
vi.mock("../../components/layout/NavbarSearch.jsx", () => ({
  default: () => <button aria-label="Open search">search</button>,
}));
```

(The mocks for `useAuth`, `useSettings`, supabase, `useFavoritesPanel`, and `useFavorites` stay as they are.)

- [ ] **Step 2: Run the existing Navbar tests to confirm they still pass against the OLD navbar with the new mock**

Run: `cd frontend && npx vitest run src/__tests__/components/Navbar.test.jsx`
Expected: PASS — the old `Navbar.jsx` still imports `useSearch` and `SearchBar` directly, so those modules will load for real but with no DOM impact (Navbar still renders SearchBar inline). The `NavbarSearch` mock isn't used until Step 3 swaps Navbar over. If anything fails here, fix the mock setup before continuing — do NOT proceed.

- [ ] **Step 3: Rewrite `Navbar.jsx`**

Replace the entire contents of `frontend/src/components/layout/Navbar.jsx` with:

```jsx
import { useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFns } from "../../lib/query.js";
import logo from "/favicon.webp";
import NavbarSearch from "./NavbarSearch.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import AvatarDropdown from "./AvatarDropdown.jsx";

export default function Navbar() {
  const navRef = useRef(null);
  const location = useLocation();
  const { session, openAuthModal } = useAuth();
  const queryClient = useQueryClient();
  const leagueSlugs = new Set(["nba", "nfl", "nhl"]);

  function prefetchLeague(to) {
    if (to === "/reports") {
      queryClient.prefetchInfiniteQuery({
        queryKey: ["reports", "all", "all"],
        queryFn: ({ pageParam = 0, signal }) =>
          queryFns.reports(undefined, undefined, 20, pageParam)({ signal }),
        initialPageParam: 0,
        staleTime: 10_000,
      });
      return;
    }
    const league = to.slice(1);
    if (!leagueSlugs.has(league)) return;
    queryClient.prefetchQuery({ queryKey: queryKeys.leagueGames(league, null, null), queryFn: queryFns.leagueGames(league, null, null), staleTime: 10_000 });
    queryClient.prefetchQuery({ queryKey: queryKeys.gameDates(league, null), queryFn: queryFns.gameDates(league, null), staleTime: 10_000 });
  }

  const leagueLinks = [
    { to: "/nba", label: "NBA" },
    { to: "/nfl", label: "NFL" },
    { to: "/nhl", label: "NHL" },
  ];

  return (
    <nav ref={navRef} className="sticky top-0 z-50 bg-[#0a0a0c] sm:bg-[rgba(10,10,12,0.88)] sm:backdrop-blur-2xl border-b border-white/[0.06]">
      <div className="relative flex items-center px-5 pb-3 pt-[max(0.75rem,calc(0.75rem+env(safe-area-inset-top)))] gap-5">
        {/* Left cluster: brand + league links */}
        <Link
          to="/"
          className="flex items-center gap-2.5 shrink-0"
          onMouseEnter={() => {
            if (window.matchMedia("(hover: hover)").matches) {
              queryClient.prefetchQuery({ queryKey: queryKeys.homeGames(), queryFn: queryFns.homeGames(), staleTime: 10_000 });
            }
          }}
        >
          <img src={logo} alt="Scorva" className="w-7 h-7" />
          <span className="text-base font-semibold tracking-tight text-text-primary hover:text-accent transition-colors duration-200">
            Scorva
          </span>
        </Link>

        <div className="flex items-center gap-5 shrink-0">
          {leagueLinks.map(({ to, label }) => {
            const isActive = location.pathname.startsWith(to);
            const currentTab = new URLSearchParams(location.search).get("tab");
            const linkTo = currentTab && leagueSlugs.has(location.pathname.slice(1))
              ? `${to}?tab=${encodeURIComponent(currentTab)}`
              : to;
            return (
              <Link
                key={to}
                to={linkTo}
                onMouseEnter={() => prefetchLeague(to)}
                className={`touch-target text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "text-accent"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right cluster: Reports + search + auth */}
        <div className="ml-auto flex items-center gap-5 shrink-0">
          <Link
            to="/reports"
            onMouseEnter={() => prefetchLeague("/reports")}
            className={`touch-target flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 ${
              location.pathname.startsWith("/reports")
                ? "text-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.003 5.5L21 5.5C21.513 5.5 21.936 5.886 21.993 6.383L22 6.5L22 13.5C22 14.052 21.552 14.5 21 14.5C20.487 14.5 20.064 14.114 20.007 13.617L20 13.5L19.999 8.914L12.707 16.207C12.347 16.567 11.78 16.595 11.388 16.291L11.294 16.208L8.998 13.916L3.709 19.205C3.319 19.596 2.686 19.596 2.295 19.206C1.935 18.845 1.907 18.278 2.212 17.886L2.295 17.791L8.29 11.795C8.65 11.435 9.217 11.407 9.609 11.711L9.703 11.794L12 14.086L18.584 7.5L14.003 7.5C13.49 7.5 13.068 7.114 13.01 6.617L13.003 6.5C13.003 5.987 13.389 5.564 13.887 5.507L14.003 5.5Z" />
            </svg>
            Reports
          </Link>

          <div className="w-px h-4 bg-white/[0.12]" />

          <NavbarSearch />

          {session === undefined ? null : (
            <div className="flex items-center gap-3">
              <div className="w-px h-4 bg-white/[0.12]" />
              {session ? (
                <AvatarDropdown />
              ) : (
                <button
                  onClick={openAuthModal}
                  className="touch-target text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-200"
                >
                  Sign In
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
```

Notable changes vs. the previous file:
- Dropped `useState`, `useEffect`, the `query` / `setQuery` state, and the `useSearch` import
- Dropped the `import SearchBar from "..."` line — `Navbar` no longer renders `SearchBar` directly
- Dropped the desktop `absolute left-1/2 -translate-x-1/2` centered search slot
- Dropped the entire mobile search row (`<div className="sm:hidden ... flex justify-center"> <SearchBar /> </div>`)
- League links moved out of the right cluster into their own flex group beside the brand; the brand and league group both `shrink-0`
- Added `gap-5` to the outer flex row so the new left and right groups breathe consistently
- Right cluster gains a `<NavbarSearch />` between the Reports divider and the auth divider — visually slotted exactly where the magnifier sits in the design

- [ ] **Step 4: Run the Navbar test file**

Run: `cd frontend && npx vitest run src/__tests__/components/Navbar.test.jsx`
Expected: PASS — all 5 existing assertions pass against the new layout. The mock `NavbarSearch` renders as a button labeled "search", which is harmless — none of the assertions look at it.

- [ ] **Step 5: Run the full frontend test suite to catch any other regressions**

Run: `cd frontend && npm test`
Expected: PASS for every suite. Pay special attention to `Navbar.test.jsx`, `NavbarSearch.test.jsx`, and `SearchBar.test.jsx`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/Navbar.jsx frontend/src/__tests__/components/Navbar.test.jsx
git commit -m "feat(Navbar): move league links left, slot magnifier-driven NavbarSearch on right"
```

---

### Task 8: Final verification (lint + build + manual smoke)

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `cd frontend && npm run lint`
Expected: PASS — no errors.

- [ ] **Step 2: Build**

Run: `cd frontend && npm run build`
Expected: success. Note any warnings about unused imports — if `SearchBar` got dropped from `Navbar.jsx` cleanly there should be none.

- [ ] **Step 3: `npm run verify` (the same thing CI runs)**

Run: `cd frontend && npm run verify`
Expected: PASS — lint + tests + build.

- [ ] **Step 4: Manual smoke test (the implementer reports findings, the user verifies)**

Run: `cd frontend && npm run dev`

Open the dev server in a browser and walk through:

- Resting state: brand + NBA / NFL / NHL on the left; Reports + magnifier + avatar on the right. No mobile search row.
- Click the magnifier on desktop → input slides into place and is focused. Type a query → results dropdown appears. Click a result → navigates and search closes.
- Open search, click outside → closes.
- Open search, press Esc → closes.
- Open search, click the X → closes.
- Press `/` while focused on the page (body) → search opens.
- Press `/` while focused inside the search input itself → it inserts a `/` character (does NOT cycle close-then-reopen). No regression on any other input.
- Resize to mobile (≤ 640 px). Magnifier still visible; tap → input replaces it inline. Same X / Esc / outside-click / route-change behavior.
- Visit a league page and confirm the global live-games rail still sits flush below the navbar (no extra gap, no overlap). Same on the homepage.
- Navigate via a league link while search is open → search closes automatically.

- [ ] **Step 5: If smoke surfaces small fixes, commit them**

If anything misbehaves visually (CSS tweak, missing class, focus-ring color), fix in place and commit:

```bash
git add <changed files>
git commit -m "fix(Navbar): <specific fix>"
```

If everything passes, no extra commit is needed.
