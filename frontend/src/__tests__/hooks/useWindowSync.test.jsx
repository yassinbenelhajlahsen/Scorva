// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { useWindowSync } from "../../components/highlights/useWindowSync.js";

function wrapperFor(initialEntries) {
  return function Wrapper({ children }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

function useWithParams({ actualWindow, currentWin, defaultWindow }) {
  useWindowSync(actualWindow, currentWin, defaultWindow);
  const [sp] = useSearchParams();
  return sp;
}

describe("useWindowSync", () => {
  it("does nothing when actualWindow is null", () => {
    const { result } = renderHook(
      () => useWithParams({ actualWindow: null, currentWin: "week" }),
      { wrapper: wrapperFor(["/?win=week"]) },
    );
    expect(result.current.get("win")).toBe("week");
  });

  it("does nothing when actualWindow equals currentWin", () => {
    const { result } = renderHook(
      () => useWithParams({ actualWindow: "month", currentWin: "month" }),
      { wrapper: wrapperFor(["/?win=month"]) },
    );
    expect(result.current.get("win")).toBe("month");
  });

  it("sets ?win to actualWindow when it differs", () => {
    const { result } = renderHook(
      () => useWithParams({ actualWindow: "month", currentWin: "week" }),
      { wrapper: wrapperFor(["/?win=week"]) },
    );
    expect(result.current.get("win")).toBe("month");
  });

  it("deletes ?win when actualWindow equals defaultWindow", () => {
    const { result } = renderHook(
      () => useWithParams({ actualWindow: "week", currentWin: "today", defaultWindow: "week" }),
      { wrapper: wrapperFor(["/?win=today"]) },
    );
    expect(result.current.get("win")).toBeNull();
  });

  it("preserves other search params", () => {
    const { result } = renderHook(
      () => useWithParams({ actualWindow: "season", currentWin: "week" }),
      { wrapper: wrapperFor(["/?win=week&pos=G&sort=asc"]) },
    );
    expect(result.current.get("win")).toBe("season");
    expect(result.current.get("pos")).toBe("G");
    expect(result.current.get("sort")).toBe("asc");
  });
});
