// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSwipeToClose } from "../../hooks/useSwipeToClose.js";

function fakeEvent(width, height) {
  return {
    target: { getBoundingClientRect: () => ({ width, height }) },
  };
}

describe("useSwipeToClose", () => {
  it("returns Framer Motion drag props for direction=right", () => {
    const { result } = renderHook(() => useSwipeToClose(vi.fn()));
    expect(result.current.drag).toBe("x");
    expect(result.current.dragConstraints).toEqual({ left: 0, right: 0 });
    expect(typeof result.current.onDragEnd).toBe("function");
  });

  it("returns drag='y' for direction=down", () => {
    const { result } = renderHook(() => useSwipeToClose(vi.fn(), { direction: "down" }));
    expect(result.current.drag).toBe("y");
    expect(result.current.dragConstraints).toEqual({ top: 0, bottom: 0 });
  });

  it("calls onClose when offset > threshold * width (right)", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useSwipeToClose(onClose, { direction: "right", threshold: 0.25 }));
    result.current.onDragEnd(fakeEvent(400, 600), {
      offset: { x: 150, y: 0 },
      velocity: { x: 0, y: 0 },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when velocity > velocityThreshold (right)", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useSwipeToClose(onClose, { direction: "right" }));
    result.current.onDragEnd(fakeEvent(400, 600), {
      offset: { x: 10, y: 0 },
      velocity: { x: 800, y: 0 },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose for small offset and low velocity", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useSwipeToClose(onClose));
    result.current.onDragEnd(fakeEvent(400, 600), {
      offset: { x: 30, y: 0 },
      velocity: { x: 100, y: 0 },
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses height for direction=down threshold", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useSwipeToClose(onClose, { direction: "down", threshold: 0.5 }));
    result.current.onDragEnd(fakeEvent(400, 200), {
      offset: { x: 0, y: 120 },
      velocity: { x: 0, y: 100 },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
