// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../utils/leagueData.js", () => ({
  default: {
    nba: { logo: "/nba.svg", name: "NBA" },
  },
}));

vi.mock("../../utils/relativeTime.js", () => ({
  relativeTime: () => "3h ago",
}));

vi.mock("framer-motion", () => {
  const handler = {
    get(_, tag) {
      return ({ children, onClick, ...rest }) => {
        const Tag = typeof tag === "symbol" ? "div" : tag;
        return <div onClick={onClick} data-testid={rest.className?.includes?.("backdrop") ? "backdrop" : undefined}>{children}</div>;
      };
    },
  };
  return {
    m: new Proxy({}, handler),
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

const { default: NewsPreviewModal } = await import(
  "../../components/news/NewsPreviewModal.jsx"
);

function makeArticle(overrides = {}) {
  return {
    league: "nba",
    headline: "Modal Headline",
    description: "Article description",
    imageUrl: "/modal.jpg",
    published: "2026-04-08T09:00:00Z",
    url: "https://example.com/article",
    ...overrides,
  };
}

describe("NewsPreviewModal", () => {
  beforeEach(() => {
    document.body.style.overflow = "";
  });

  it("renders nothing when article is null", () => {
    render(<NewsPreviewModal article={null} onClose={vi.fn()} />);
    expect(screen.queryByText("Modal Headline")).not.toBeInTheDocument();
  });

  it("renders headline when article provided", () => {
    render(<NewsPreviewModal article={makeArticle()} onClose={vi.fn()} />);
    expect(screen.getByText("Modal Headline")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<NewsPreviewModal article={makeArticle()} onClose={vi.fn()} />);
    expect(screen.getByText("Article description")).toBeInTheDocument();
  });

  it("hides description when not provided", () => {
    render(
      <NewsPreviewModal article={makeArticle({ description: null })} onClose={vi.fn()} />
    );
    expect(screen.queryByText("Article description")).not.toBeInTheDocument();
  });

  it("renders external link with target blank", () => {
    render(<NewsPreviewModal article={makeArticle()} onClose={vi.fn()} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com/article");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("hides link when url is null", () => {
    render(
      <NewsPreviewModal article={makeArticle({ url: null })} onClose={vi.fn()} />
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<NewsPreviewModal article={makeArticle()} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(<NewsPreviewModal article={makeArticle()} onClose={onClose} />);
    const buttons = screen.getAllByRole("button");
    const closeBtn = buttons.find((b) => b.querySelector("svg"));
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sets body overflow hidden when open", () => {
    render(<NewsPreviewModal article={makeArticle()} onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body overflow on unmount", () => {
    document.body.style.overflow = "auto";
    const { unmount } = render(
      <NewsPreviewModal article={makeArticle()} onClose={vi.fn()} />
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("renders league name and relative time", () => {
    render(<NewsPreviewModal article={makeArticle()} onClose={vi.fn()} />);
    expect(screen.getByText("NBA")).toBeInTheDocument();
    expect(screen.getByText("3h ago")).toBeInTheDocument();
  });
});
