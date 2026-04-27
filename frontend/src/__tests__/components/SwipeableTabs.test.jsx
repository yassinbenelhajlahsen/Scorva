// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LazyMotion, domAnimation } from "framer-motion";
import { SwipeableTabs } from "../../components/ui/SwipeableTabs.jsx";

describe("SwipeableTabs", () => {
  it("renders inside LazyMotion strict without error", () => {
    expect(() =>
      render(
        <LazyMotion features={domAnimation} strict>
          <SwipeableTabs
            activeId="a"
            onChange={() => {}}
            tabs={[
              { id: "a", content: <div>A</div> },
              { id: "b", content: <div>B</div> },
            ]}
          />
        </LazyMotion>,
      ),
    ).not.toThrow();
  });
});
