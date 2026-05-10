import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export function useWindowSync(actualWindow, currentWin, defaultWindow = "week") {
  const [, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (!actualWindow || actualWindow === currentWin) return;
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (actualWindow === defaultWindow) sp.delete("win");
        else sp.set("win", actualWindow);
        return sp;
      },
      { replace: true },
    );
  }, [actualWindow, currentWin, defaultWindow, setSearchParams]);
}
