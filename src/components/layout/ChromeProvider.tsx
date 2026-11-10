"use client";

/**
 * Remembers which overlay is open (search, cart drawer, mobile menu, or the shop's category
 * sidebar on phones) so that any button can open it: the header cart icon and the floating cart
 * both open the same cart drawer.
 * Only one overlay is open at a time, like on the live site.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Panel = "search" | "cart" | "menu" | "shopSidebar" | null;

type ChromeState = {
  openPanel: Panel;
  open: (panel: Exclude<Panel, null>) => void;
  close: () => void;
  toggle: (panel: Exclude<Panel, null>) => void;
};

const ChromeContext = createContext<ChromeState | null>(null);

export function ChromeProvider({ children }: { children: ReactNode }) {
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const open = useCallback((panel: Exclude<Panel, null>) => setOpenPanel(panel), []);
  const close = useCallback(() => setOpenPanel(null), []);
  const toggle = useCallback((panel: Exclude<Panel, null>) => setOpenPanel((current) => (current === panel ? null : panel)), []);

  // Escape closes whatever is open.
  useEffect(() => {
    if (!openPanel) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpenPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPanel]);

  const value = useMemo(() => ({ openPanel, open, close, toggle }), [openPanel, open, close, toggle]);
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

export function useChrome(): ChromeState {
  const context = useContext(ChromeContext);
  if (!context) throw new Error("useChrome must be used inside <ChromeProvider>");
  return context;
}
