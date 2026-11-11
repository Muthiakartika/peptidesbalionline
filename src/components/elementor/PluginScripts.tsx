"use client";

/**
 * Runs the owner's plugin scripts that draw a widget in the browser, as on the live site: the
 * Atlas Research Planner's calculator (/calculator/) and its Protocol Builder (/protocol-builder/)
 * (GPL-2.0-or-later, copied to public/legacy/vendor/atlas-research-planner/). The calculator reads
 * its configuration from <script id="arp-tools-config"> (printed by ElementorPage) and draws into
 * [data-arp-calc]; the Protocol Builder reads <script id="arp-config"> and draws into
 * [data-arp-root] (src/app/(store)/protocol-builder/page.tsx). Each marks what it has drawn, so it
 * never draws twice.
 *
 * The script only looks for its widget when it runs, so it is added again each time the page is
 * shown, also after a link click without a page reload (the browser has the file cached by then).
 * Phase 6c ports the tool to this project's own code (the same inputs giving the same results).
 */
import { useEffect } from "react";

export function PluginScripts({ srcs }: { srcs: string[] }) {
  useEffect(() => {
    const added = srcs.map((src) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false; // in the given order
      document.body.append(script);
      return script;
    });
    return () => added.forEach((script) => script.remove());
  }, [srcs]);
  return null;
}
