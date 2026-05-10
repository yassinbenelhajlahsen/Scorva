// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const MOTION_PROPS = new Set([
  "animate", "initial", "exit", "transition", "whileHover", "whileTap", "variants",
]);

vi.mock("framer-motion", () => ({
  m: new Proxy(
    {},
    {
      get: (_, tag) => {
        const El = ({ children, className, onClick, ...rest }) => {
          const Tag = tag;
          const props = Object.fromEntries(
            Object.entries(rest).filter(([k]) => !MOTION_PROPS.has(k)),
          );
          return <Tag className={className} onClick={onClick} {...props}>{children}</Tag>;
        };
        El.displayName = String(tag);
        return El;
      },
    },
  ),
  AnimatePresence: ({ children }) => <>{children}</>,
}));

const { default: PlayerAwardsCard } = await import("../../components/cards/PlayerAwardsCard.jsx");

const sampleAwards = [
  { type: "champion",    label: "Champion",   count: 4,  seasons: ["2019-20", "2015-16", "2012-13", "2011-12"] },
  { type: "finals_mvp",  label: "Finals MVP", count: 4,  seasons: ["2019-20", "2015-16", "2012-13", "2011-12"] },
  { type: "mvp",         label: "MVP",        count: 4,  seasons: ["2012-13", "2011-12", "2009-10", "2008-09"] },
  { type: "dpoy",        label: "Defensive POY", count: 1, seasons: ["2008-09"] },
  { type: "all_nba_first",  label: "All-NBA 1st", count: 13, seasons: ["2024-25", "2023-24", "2022-23", "2021-22", "2020-21"] },
  { type: "all_nba_second", label: "All-NBA 2nd", count: 3, seasons: ["2007-08", "2006-07", "2005-06"] },
  { type: "all_star",       label: "All-Star",    count: 19, seasons: ["2024-25", "2023-24", "2022-23", "2021-22"] },
];

const rowsByType = () => {
  const out = {};
  for (const row of screen.getAllByTestId("award-row")) {
    out[row.dataset.awardType] = row;
  }
  return out;
};

describe("PlayerAwardsCard", () => {
  it("returns null when awards is empty", () => {
    const { container } = render(<PlayerAwardsCard awards={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when awards is undefined", () => {
    const { container } = render(<PlayerAwardsCard awards={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the Career Honors header and a row per award", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    expect(screen.getByText("Career Honors")).toBeInTheDocument();
    expect(screen.getAllByTestId("award-row")).toHaveLength(sampleAwards.length);
  });

  it("renders the three tier headings when each tier has awards", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    expect(screen.getByText("Legendary")).toBeInTheDocument();
    expect(screen.getByText("Major Honors")).toBeInTheDocument();
    expect(screen.getByText("Selections")).toBeInTheDocument();
  });

  it("omits tier headings for tiers with no awards", () => {
    const onlyLegendary = sampleAwards.filter((a) => ["mvp", "champion", "finals_mvp"].includes(a.type));
    render(<PlayerAwardsCard awards={onlyLegendary} />);
    expect(screen.getByText("Legendary")).toBeInTheDocument();
    expect(screen.queryByText("Major Honors")).not.toBeInTheDocument();
    expect(screen.queryByText("Selections")).not.toBeInTheDocument();
  });

  it("orders Legendary by curated priority (MVP, Champion, Finals MVP)", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    const types = screen.getAllByTestId("award-row").map((r) => r.dataset.awardType);
    expect(types.slice(0, 3)).toEqual(["mvp", "champion", "finals_mvp"]);
  });

  it("renders inline season list for awards with count <= 4", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    const rows = rowsByType();
    expect(rows.mvp).toHaveTextContent("2012-13");
    expect(rows.mvp).toHaveTextContent("2008-09");
    expect(rows.dpoy).toHaveTextContent("2008-09");
  });

  it("rows with count <= 4 render as non-interactive containers", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    const rows = rowsByType();
    expect(rows.mvp.tagName).toBe("DIV");
    expect(rows.dpoy.tagName).toBe("DIV");
  });

  it("rows with count > 4 render as buttons", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    const rows = rowsByType();
    expect(rows.all_star.tagName).toBe("BUTTON");
    expect(rows.all_nba_first.tagName).toBe("BUTTON");
  });

  it("opens the detail strip when a clickable row is clicked", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /all-star, 19 times/i }));

    const strip = screen.getByRole("status");
    expect(strip).toHaveTextContent("2024-25");
    expect(strip).toHaveTextContent("2021-22");
  });

  it("switches the detail strip when a different clickable row is clicked", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    fireEvent.click(screen.getByRole("button", { name: /all-star, 19 times/i }));
    fireEvent.click(screen.getByRole("button", { name: /all-nba 1st, 13 times/i }));
    const strip = screen.getByRole("status");
    expect(strip).toHaveTextContent("2024-25");
    expect(strip).toHaveTextContent("2020-21");
  });

  it("closes the detail strip on Escape", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    fireEvent.click(screen.getByRole("button", { name: /all-star, 19 times/i }));
    expect(screen.getByRole("status")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("closes the detail strip when clicking outside the card", () => {
    render(
      <div>
        <PlayerAwardsCard awards={sampleAwards} />
        <div data-testid="outside">outside</div>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /all-star, 19 times/i }));
    expect(screen.getByRole("status")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("clicking the same row twice toggles the detail strip closed", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    fireEvent.click(screen.getByRole("button", { name: /all-star, 19 times/i }));
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /all-star, 19 times/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("aria-label on clickable rows uses plural 'times'", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    expect(screen.getByRole("button", { name: /^all-star, 19 times$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^all-nba 1st, 13 times$/i })).toBeInTheDocument();
  });
});
