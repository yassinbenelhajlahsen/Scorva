import { useMemo } from "react";

export function useStandalone() {
  return useMemo(() => {
    if (typeof window === "undefined") {
      return { isStandalone: false, isIOS: false, isSafari: false };
    }
    const ua = window.navigator.userAgent || "";

    const isIPhoneOrIPodOrIPad = /iPhone|iPod|iPad/.test(ua);
    const isIPadOS = /Macintosh/.test(ua) && (window.navigator.maxTouchPoints || 0) > 1;
    const isIOS = isIPhoneOrIPodOrIPad || isIPadOS;

    const isWebKit = /AppleWebKit/.test(ua);
    const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|Chrome\//.test(ua);
    const isSafari = isWebKit && !isOtherBrowser;

    const standaloneFlag = window.navigator.standalone === true;
    const displayModeStandalone =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches;
    const isStandalone = standaloneFlag || displayModeStandalone;

    return { isStandalone, isIOS, isSafari };
  }, []);
}
