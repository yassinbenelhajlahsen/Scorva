// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SkeletonCard, SkeletonRow } from "../../components/skeletons/_chrome.jsx";

describe("SkeletonCard", () => {
  it("renders a left rail and an atmospheric gradient over children", () => {
    const { container, getByTestId } = render(
      <SkeletonCard>
        <div data-testid="inner">x</div>
      </SkeletonCard>,
    );
    expect(getByTestId("inner")).toBeInTheDocument();
    // Rail: 2px absolute element on the left, default neutral color
    expect(container.querySelector(".w-\\[2px\\].bg-white\\/15")).toBeInTheDocument();
    // Gradient: absolute inset-0 with from-white/[0.04]
    expect(container.querySelector(".bg-gradient-to-r.from-white\\/\\[0\\.04\\]")).toBeInTheDocument();
  });

  it("accepts a custom railClass for colored rails (win/loss/playoff)", () => {
    const { container } = render(
      <SkeletonCard railClass="bg-win/60">
        <div />
      </SkeletonCard>,
    );
    expect(container.querySelector(".bg-win\\/60")).toBeInTheDocument();
    expect(container.querySelector(".bg-white\\/15")).not.toBeInTheDocument();
  });
});

describe("SkeletonRow", () => {
  it("renders a transparent left-rail slot and hairline-row padding", () => {
    const { container, getByTestId } = render(
      <SkeletonRow>
        <div data-testid="inner">x</div>
      </SkeletonRow>,
    );
    expect(getByTestId("inner")).toBeInTheDocument();
    expect(container.querySelector(".pl-4.pr-3.py-3")).toBeInTheDocument();
  });
});
