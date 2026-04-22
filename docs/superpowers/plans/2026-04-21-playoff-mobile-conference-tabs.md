# Playoff Mobile Conference Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cramped stacked-conference layout on mobile with a pill tab strip that shows one conference at a time with full-width stacked `SeriesCard`s.

**Architecture:** Two new internal components (`MobileConferenceTabs`, `MobileConferenceView`) are added inside `PlayoffsBracket.jsx`. On mobile (`< lg`) the existing two-column desktop grid is hidden and the mobile tab UI is shown instead; at `lg+` nothing changes.

**Tech Stack:** React 19, Framer Motion 12 (`AnimatePresence` + `m.div`), Tailwind CSS v4, Vitest + Testing Library

---

## Files

| Action | Path |
|---|---|
| Modify | `frontend/src/components/playoffs/PlayoffsBracket.jsx` |
| Create | `frontend/src/__tests__/components/PlayoffsBracket.test.jsx` |

---

### Task 1: Write failing tests

**Files:**
- Create: `frontend/src/__tests__/components/PlayoffsBracket.test.jsx`

- [ ] **Step 1: Create the test file**

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";

const MOTION_PROPS = new Set([
  "animate", "initial", "exit", "transition",
  "whileHover", "whileTap", "custom", "variants",
]);

vi.mock("framer-motion", () => ({
  m: new Proxy({}, {
    get: (_, tag) => {
      const El = ({ children, className, onClick, ...rest }) => {
        const Tag = tag;
        const props = Object.fromEntries(
          Object.entries(rest).filter(([k]) => !MOTION_PROPS.has(k))
        );
        return <Tag className={className} onClick={onClick} {...props}>{children}</Tag>;
      };
      El.displayName = tag;
      return El;
    },
  }),
  AnimatePresence: ({ children }) => <>{children}</>,
}));

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ prefetchQuery: vi.fn() }),
}));

vi.mock("../../hooks/data/usePlayoffs.js", () => ({ usePlayoffs: vi.fn() }));

vi.mock("../../components/skeletons/PlayoffsSkeleton.jsx", () => ({
  default: () => <div data-testid="skeleton" />,
}));

vi.mock("../../components/ui/ErrorState.jsx", () => ({
  default: ({ message }) => <div>{message}</div>,
}));

const { usePlayoffs } = await import("../../hooks/data/usePlayoffs.js");
const PlayoffsBracket = (await import("../../components/playoffs/PlayoffsBracket.jsx")).default;

const mockEasternSeries = {
  teamA: { id: 1, shortname: "BOS", name: "Boston Celtics", seed: 1, logo_url: null },
  teamB: { id: 2, shortname: "NYK", name: "New York Knicks", seed: 8, logo_url: null },
  wins: {}, winnerId: null, isComplete: false, games: [],
};

const mockWesternSeries = {
  teamA: { id: 3, shortname: "OKC", name: "Oklahoma City Thunder", seed: 1, logo_url: null },
  teamB: { id: 4, shortname: "LAL", name: "Los Angeles Lakers", seed: 8, logo_url: null },
  wins: {}, winnerId: null, isComplete: false, games: [],
};

const mockData = {
  unsupported: false,
  playIn: null,
  bracket: {
    eastern: { r1: [mockEasternSeries], semis: [], confFinals: [] },
    western: { r1: [mockWesternSeries], semis: [], confFinals: [] },
    finals: [{
      teamA: { id: 1, shortname: "BOS", name: "Boston Celtics", seed: 1, logo_url: null },
      teamB: null,
      wins: {}, winnerId: null, isComplete: false, games: [],
    }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  usePlayoffs.mockReturnValue({ data: mockData, loading: false, error: null, retry: vi.fn() });
});

describe("PlayoffsBracket", () => {
  it("renders conference tab buttons for mobile", () => {
    render(<PlayoffsBracket league="nba" season="2024-25" />);
    expect(screen.getByRole("button", { name: "Eastern" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Western" })).toBeInTheDocument();
  });

  it("shows eastern conference content in mobile bracket by default", () => {
    render(<PlayoffsBracket league="nba" season="2024-25" />);
    const mobileBracket = screen.getByTestId("mobile-bracket");
    expect(within(mobileBracket).getByText("BOS")).toBeInTheDocument();
  });

  it("switches to western conference when western tab is clicked", () => {
    render(<PlayoffsBracket league="nba" season="2024-25" />);
    fireEvent.click(screen.getByRole("button", { name: "Western" }));
    const mobileBracket = screen.getByTestId("mobile-bracket");
    expect(within(mobileBracket).getByText("OKC")).toBeInTheDocument();
  });

  it("renders the finals label when finals data is present", () => {
    render(<PlayoffsBracket league="nba" season="2024-25" />);
    expect(screen.getByText("NBA Finals")).toBeInTheDocument();
  });

  it("renders skeleton when loading", () => {
    usePlayoffs.mockReturnValue({ data: null, loading: true, error: null, retry: vi.fn() });
    render(<PlayoffsBracket league="nba" season="2024-25" />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- PlayoffsBracket
```

Expected: Tests FAIL — `getByRole("button", { name: "Eastern" })` finds nothing because the tabs don't exist yet.

---

### Task 2: Implement mobile conference tabs in `PlayoffsBracket.jsx`

**Files:**
- Modify: `frontend/src/components/playoffs/PlayoffsBracket.jsx`

- [ ] **Step 1: Add state, `pickConf`, and `MobileConferenceTabs` component**

At the top of the file, after all existing imports, no new imports are needed — `useState` and `AnimatePresence`/`m` are already imported.

Replace the entire `PlayoffsBracket.jsx` with the following (the two existing components `RoundColumn`, `ConferenceColumn`, `FinalsSection` are unchanged — only new components and the main export change):

```jsx
import { useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import SeriesCard from "./SeriesCard.jsx";
import PlayInSection from "./PlayInSection.jsx";
import { usePlayoffs } from "../../hooks/data/usePlayoffs.js";
import { LEAGUE_LABELS } from "../../constants/leagueLabels.js";
import ErrorState from "../ui/ErrorState.jsx";
import PlayoffsSkeleton from "../skeletons/PlayoffsSkeleton.jsx";
import { EASE_OUT_EXPO } from "../../utils/motion.js";

const ROUND_STAGGER = 0.08;
const ROUND_DURATION = 0.4;

function RoundColumn({ title, series, league, align = "left", delay = 0 }) {
  const alignClass = align === "right" ? "items-end" : "items-start";
  return (
    <div className={`flex flex-col ${alignClass} gap-4 min-w-0`}>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary w-full text-center">
        {title}
      </div>
      <m.div
        className="flex flex-col justify-around gap-4 flex-1 w-full mt-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: ROUND_DURATION, ease: EASE_OUT_EXPO, delay }}
      >
        {series.map((s, i) => (
          <SeriesCard key={i} series={s} league={league} />
        ))}
      </m.div>
    </div>
  );
}

function ConferenceColumn({ confLabel, rounds, league, mirrored = false, baseDelay = 0 }) {
  const labels = LEAGUE_LABELS[league] || LEAGUE_LABELS.nba;

  const columns = labels.bracketKeys.map((k) => ({
    key: k,
    title: labels.bracketTitles[k] ?? k,
    series: rounds[k] || [],
  }));
  const ordered = mirrored ? [...columns].reverse() : columns;

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-text-secondary text-center mb-8">
        {confLabel}
      </h3>
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-4">
        {ordered.map((col, i) => (
          <RoundColumn
            key={col.key}
            title={col.title}
            series={col.series}
            league={league}
            delay={baseDelay + i * ROUND_STAGGER}
          />
        ))}
      </div>
    </div>
  );
}

function FinalsSection({ finals, league }) {
  const series = finals?.[0];
  if (!series) return null;
  const finalsLabel = LEAGUE_LABELS[league]?.finals ?? "Finals";
  return (
    <div className="flex flex-col items-center gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-accent text-center">
        {finalsLabel}
      </h3>
      <m.div
        className="w-full max-w-[280px]"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: ROUND_DURATION, ease: EASE_OUT_EXPO }}
      >
        <SeriesCard series={series} league={league} />
      </m.div>
    </div>
  );
}

function MobileConferenceTabs({ conferences, activeConf, onPick }) {
  return (
    <div className="flex justify-center mb-6">
      <div className="flex gap-0 bg-surface-elevated border border-white/[0.08] rounded-full p-1">
        {conferences.map((conf) => (
          <button
            key={conf.key}
            onClick={() => onPick(conf.key)}
            aria-pressed={activeConf === conf.key}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
              activeConf === conf.key
                ? "bg-accent/15 border border-accent/25 text-accent"
                : "text-text-secondary"
            }`}
          >
            {conf.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MobileConferenceView({ block, labels, league, direction }) {
  const columns = labels.bracketKeys
    .map((k) => ({ key: k, title: labels.bracketTitles[k] ?? k, series: block[k] || [] }))
    .filter((col) => col.series.length > 0);

  return (
    <m.div
      custom={direction}
      variants={{
        initial: (dir) => ({ x: dir * 30, opacity: 0 }),
        animate: { x: 0, opacity: 1, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
        exit: (dir) => ({ x: dir * -30, opacity: 0, transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] } }),
      }}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex flex-col gap-8"
    >
      {columns.map((col) => (
        <div key={col.key}>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3 text-center">
            {col.title}
          </div>
          <div className="flex flex-col gap-3">
            {col.series.map((s, i) => (
              <SeriesCard key={i} series={s} league={league} />
            ))}
          </div>
        </div>
      ))}
    </m.div>
  );
}

export default function PlayoffsBracket({ league, season }) {
  const { data, loading, error, retry } = usePlayoffs(league, season);
  const labels = LEAGUE_LABELS[league] || LEAGUE_LABELS.nba;
  const [confA, confB] = labels.conferences;
  const [activeMobileConf, setActiveMobileConf] = useState(confA.key);
  const [mobileTabDirection, setMobileTabDirection] = useState(1);

  function pickConf(key) {
    const confKeys = labels.conferences.map((c) => c.key);
    setMobileTabDirection(confKeys.indexOf(key) > confKeys.indexOf(activeMobileConf) ? 1 : -1);
    setActiveMobileConf(key);
  }

  if (loading) return <PlayoffsSkeleton season={season} league={league} />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data) return null;

  if (data.unsupported) {
    return (
      <div className="text-center text-text-tertiary py-20 text-sm">
        Bracket format unsupported for this season.
      </div>
    );
  }

  const { bracket, playIn } = data;
  const blockA = bracket?.[confA.key];
  const blockB = bracket?.[confB.key];
  const finals = bracket?.[labels.finalsKey] || [];

  if (!blockA || !blockB) {
    return (
      <div className="text-center text-text-tertiary py-20 text-sm">
        Bracket unavailable for this season.
      </div>
    );
  }

  const activeBlock = activeMobileConf === confA.key ? blockA : blockB;

  return (
    <div className="w-full">
      {labels.playInSupported && playIn && (
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: ROUND_DURATION, ease: EASE_OUT_EXPO }}
        >
          <PlayInSection playIn={playIn} league={league} />
        </m.div>
      )}

      <div className="mb-10">
        <FinalsSection finals={finals} league={league} />
      </div>

      {/* Mobile: one conference at a time */}
      <div className="lg:hidden" data-testid="mobile-bracket">
        <MobileConferenceTabs
          conferences={labels.conferences}
          activeConf={activeMobileConf}
          onPick={pickConf}
        />
        <AnimatePresence mode="wait" custom={mobileTabDirection} initial={false}>
          <MobileConferenceView
            key={activeMobileConf}
            block={activeBlock}
            labels={labels}
            league={league}
            direction={mobileTabDirection}
          />
        </AnimatePresence>
      </div>

      {/* Desktop: two conferences side-by-side */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-10 lg:gap-6">
        <ConferenceColumn
          confLabel={confA.label}
          rounds={blockA}
          league={league}
          baseDelay={ROUND_STAGGER}
        />
        <ConferenceColumn
          confLabel={confB.label}
          rounds={blockB}
          league={league}
          mirrored
          baseDelay={ROUND_STAGGER * 4}
        />
      </div>
    </div>
  );
}
```

**Key changes from original:**
- `useState` added for `activeMobileConf` and `mobileTabDirection` (moved inside function body, after hook calls)
- `labels`, `confA`, `confB` derived at top of function so state can reference `confA.key`
- Desktop grid: `grid grid-cols-1 lg:grid-cols-2` → `hidden lg:grid lg:grid-cols-2`
- Mobile section: new `lg:hidden` div with `data-testid="mobile-bracket"`

- [ ] **Step 2: Run tests**

```bash
cd frontend && npm test -- PlayoffsBracket
```

Expected: All 5 tests PASS.

- [ ] **Step 3: Run full verify**

```bash
cd frontend && npm run verify
```

Expected: lint + tests + build all pass. Fix any lint errors before proceeding.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/playoffs/PlayoffsBracket.jsx \
        frontend/src/__tests__/components/PlayoffsBracket.test.jsx
git commit -m "$(cat <<'EOF'
feat: add mobile conference tabs to playoff bracket

Below the lg breakpoint the two stacked ConferenceColumns are
replaced by a pill tab strip (Eastern / Western) showing one
conference at a time with full-width stacked SeriesCards.
Desktop layout is unchanged.
EOF
)"
```
