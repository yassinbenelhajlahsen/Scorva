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
  { type: "all_nba_first",  label: "All-NBA 1st", count: 13, seasons: ["2024-25", "2023-24"] },
  { type: "all_nba_second", label: "All-NBA 2nd", count: 3, seasons: ["2007-08"] },
  { type: "all_star",       label: "All-Star",    count: 19, seasons: ["2024-25", "2023-24"] },
];

describe("PlayerAwardsCard", () => {
  it("returns null when awards is empty", () => {
    const { container } = render(<PlayerAwardsCard awards={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when awards is undefined", () => {
    const { container } = render(<PlayerAwardsCard awards={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the section header and a chip per award", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    expect(screen.getByText("Career Honors")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(sampleAwards.length);
  });

  it("renders the three tier section headings when each tier has awards", () => {
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

  it("classifies championship-tier awards into Legendary with gold star", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    const championBtn = screen.getByRole("button", { name: /champion, 4 times/i });
    expect(championBtn).toHaveTextContent("★");

    const dpoyBtn = screen.getByRole("button", { name: /defensive poy, 1 time/i });
    expect(dpoyBtn).not.toHaveTextContent("★");
  });

  it("orders Legendary by curated priority (MVP first, then Champion, then Finals MVP)", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    const legendaryButtons = screen.getAllByRole("button").slice(0, 3);
    const labels = legendaryButtons.map((btn) => btn.getAttribute("aria-label"));
    expect(labels[0]).toMatch(/^mvp/i);
    expect(labels[1]).toMatch(/^champion/i);
    expect(labels[2]).toMatch(/^finals mvp/i);
  });

  it("opens the detail strip when a chip is clicked", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^mvp, 4 times/i }));

    const strip = screen.getByRole("status");
    expect(strip).toHaveTextContent("MVP");
    expect(strip).toHaveTextContent("2012-13");
    expect(strip).toHaveTextContent("2008-09");
  });

  it("switches the detail strip when a different chip is clicked", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    fireEvent.click(screen.getByRole("button", { name: /^mvp, 4 times/i }));
    expect(screen.getByRole("status")).toHaveTextContent("MVP");

    fireEvent.click(screen.getByRole("button", { name: /all-star, 19 times/i }));
    const strip = screen.getByRole("status");
    expect(strip).toHaveTextContent("All-Star");
    expect(strip).not.toHaveTextContent(/^MVP$/);
  });

  it("closes the detail strip on Escape", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    fireEvent.click(screen.getByRole("button", { name: /^mvp, 4 times/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /^mvp, 4 times/i }));
    expect(screen.getByRole("status")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("uses singular 'time' label for count of 1 in chip aria-label", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    const dpoy = screen.getByRole("button", { name: /defensive poy, 1 time$/i });
    expect(dpoy).toBeInTheDocument();
  });

  it("uses plural 'times' label for count > 1 in chip aria-label", () => {
    render(<PlayerAwardsCard awards={sampleAwards} />);
    expect(screen.getByRole("button", { name: /^mvp, 4 times$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /all-star, 19 times$/i })).toBeInTheDocument();
  });
});
