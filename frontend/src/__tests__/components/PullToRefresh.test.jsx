// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LazyMotion, domAnimation } from "framer-motion";
import { PullToRefresh } from "../../components/ui/PullToRefresh.jsx";

describe("PullToRefresh", () => {
  it("renders inside LazyMotion strict without error", () => {
    expect(() =>
      render(
        <LazyMotion features={domAnimation} strict>
          <PullToRefresh onRefresh={() => Promise.resolve()}>
            <div>content</div>
          </PullToRefresh>
        </LazyMotion>,
      ),
    ).not.toThrow();
  });
});
