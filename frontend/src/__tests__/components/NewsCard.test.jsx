import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../utils/leagueData.js", () => ({
  default: {
    nba: { logo: "/nba.svg", name: "NBA" },
    nfl: { logo: "/nfl.svg", name: "NFL" },
  },
}));

vi.mock("../../utils/relativeTime.js", () => ({
  relativeTime: () => "2h ago",
}));

const { default: NewsCard } = await import("../../components/news/NewsCard.jsx");

function makeArticle(overrides = {}) {
  return {
    league: "nba",
    headline: "Test Headline",
    imageUrl: "/test.jpg",
    published: "2026-04-08T10:00:00Z",
    url: "https://example.com",
    ...overrides,
  };
}

describe("NewsCard", () => {
  it("renders headline", () => {
    render(<NewsCard article={makeArticle()} onClick={vi.fn()} />);
    expect(screen.getByText("Test Headline")).toBeInTheDocument();
  });

  it("renders league name", () => {
    render(<NewsCard article={makeArticle()} onClick={vi.fn()} />);
    expect(screen.getByText("NBA")).toBeInTheDocument();
  });

  it("renders relative time when published", () => {
    render(<NewsCard article={makeArticle()} onClick={vi.fn()} />);
    expect(screen.getByText("2h ago")).toBeInTheDocument();
  });

  it("does not render time when published is null", () => {
    render(<NewsCard article={makeArticle({ published: null })} onClick={vi.fn()} />);
    expect(screen.queryByText("2h ago")).not.toBeInTheDocument();
  });

  it("renders image when imageUrl provided", () => {
    const { container } = render(<NewsCard article={makeArticle()} onClick={vi.fn()} />);
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(2); // article image + league logo
    expect(imgs[0].getAttribute("src")).toBe("/test.jpg");
  });

  it("skips article image when imageUrl is null", () => {
    const { container } = render(<NewsCard article={makeArticle({ imageUrl: null })} onClick={vi.fn()} />);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(1); // league logo only
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<NewsCard article={makeArticle()} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
