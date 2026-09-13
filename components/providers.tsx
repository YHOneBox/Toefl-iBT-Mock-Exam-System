"use client";

import { useEffect, type ReactNode } from "react";
import { VoiceProvider } from "./voice/voice-context";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const hide = () => {
      document.querySelectorAll("nextjs-portal, #__next-dev-indicator, [data-next-mark-loading]").forEach((el) => {
        (el as HTMLElement).style.setProperty("display", "none", "important");
        (el as HTMLElement).style.setProperty("visibility", "hidden", "important");
      });
    };
    hide();
    const obs = new MutationObserver(hide);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return <VoiceProvider>{children}</VoiceProvider>;
}
