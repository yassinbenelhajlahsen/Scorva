// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSwipeableTabs } from "../../hooks/useSwipeableTabs.js";

function makeContainer(width) {
  return { current: { getBoundingClientRect: () => ({ width, height: 600 }) } };
}

describe("useSwipeableTabs", () => {
  it("returns Framer Motion drag props", () => {
    const { result } = renderHook(() =>
      useSwipeableTabs({ currentIndex: 0, totalTabs: 3, onChange: vi.fn() }),
    );
    expect(result.current.drag).toBe("x");
    expect(typeof result.current.onDragEnd).toBe("function");
  });

  it("calls onChange(currentIndex+1) on swipe-left past threshold", () => {
    const onChange = vi.fn();
    const containerRef = makeContainer(400);
    const { result } = renderHook(() =>
      useSwipeableTabs({ containerRef, currentIndex: 0, totalTabs: 3, onChange }),
    );
    result.current.onDragEnd({}, {
      offset: { x: -150, y: 0 },
      velocity: { x: 0, y: 0 },
    });
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("calls onChange(currentIndex-1) on swipe-right past threshold", () => {
    const onChange = vi.fn();
    const containerRef = makeContainer(400);
    const { result } = renderHook(() =>
      useSwipeableTabs({ containerRef, currentIndex: 1, totalTabs: 3, onChange }),
    );
    result.current.onDragEnd({}, {
      offset: { x: 150, y: 0 },
      velocity: { x: 0, y: 0 },
    });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("does not advance past last tab", () => {
    const onChange = vi.fn();
    const containerRef = makeContainer(400);
    const { result } = renderHook(() =>
      useSwipeableTabs({ containerRef, currentIndex: 2, totalTabs: 3, onChange }),
    );
    result.current.onDragEnd({}, {
      offset: { x: -200, y: 0 },
      velocity: { x: 0, y: 0 },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not advance below first tab", () => {
    const onChange = vi.fn();
    const containerRef = makeContainer(400);
    const { result } = renderHook(() =>
      useSwipeableTabs({ containerRef, currentIndex: 0, totalTabs: 3, onChange }),
    );
    result.current.onDragEnd({}, {
      offset: { x: 200, y: 0 },
      velocity: { x: 0, y: 0 },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits on velocity even with small offset", () => {
    const onChange = vi.fn();
    const containerRef = makeContainer(400);
    const { result } = renderHook(() =>
      useSwipeableTabs({ containerRef, currentIndex: 0, totalTabs: 3, onChange }),
    );
    result.current.onDragEnd({}, {
      offset: { x: -10, y: 0 },
      velocity: { x: -800, y: 0 },
    });
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("does nothing for small offset, low velocity", () => {
    const onChange = vi.fn();
    const containerRef = makeContainer(400);
    const { result } = renderHook(() =>
      useSwipeableTabs({ containerRef, currentIndex: 1, totalTabs: 3, onChange }),
    );
    result.current.onDragEnd({}, {
      offset: { x: 30, y: 0 },
      velocity: { x: 100, y: 0 },
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
