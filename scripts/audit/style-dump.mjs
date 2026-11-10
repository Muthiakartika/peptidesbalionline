// Read-only: dumps box + computed styles of selectors on a page. Usage:
//   node style-dump.mjs <url> <width> <selectors.json> [out.json]
// selectors.json: [["label", "css selector", optional nth], ...]
import { chromium } from "playwright-core";
import fs from "fs";

const [url, width = "1440", file, out] = process.argv.slice(2);
const pairs = JSON.parse(fs.readFileSync(file, "utf8"));
const HIDE = ".elementor-popup-modal,.wd-cookies-popup,.age-gate,.cookie-notice{display:none!important} html,body{overflow:visible!important;height:auto!important}";
const PROPS = ["display", "position", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-transform", "text-align", "color", "background-color", "background-image", "border-top", "border-right", "border-bottom", "border-left", "border-radius", "box-shadow", "padding", "margin", "gap", "grid-template-columns", "flex-direction", "justify-content", "align-items", "opacity", "transform", "text-decoration-line", "white-space", "overflow", "min-height", "max-width", "object-fit", "aspect-ratio", "z-index", "transition", "cursor", "width", "height", "top", "right", "bottom", "left", "content", "-webkit-line-clamp", "visibility"];

const w = Number(width);
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await (await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 768, hasTouch: w < 768 })).newPage();
await page.goto(url, { waitUntil: "load", timeout: 120000 });
await page.addStyleTag({ content: HIDE });
await page.waitForTimeout(4000);
const result = await page.evaluate(([pairs, PROPS]) => {
  const defaults = { "background-image": "none", "box-shadow": "none", opacity: "1", transform: "none", "z-index": "auto", content: "normal", visibility: "visible" };
  return pairs.map(([label, sel, nth = 0, pseudo = null]) => {
    const els = [...document.querySelectorAll(sel)];
    const el = els[nth];
    if (!el) return { label, missing: sel, count: els.length };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el, pseudo);
    const style = {};
    const parent = pseudo ? getComputedStyle(el) : el.parentElement ? getComputedStyle(el.parentElement) : null;
    const inherited = /^(font-|line-height|color|letter-spacing|text-transform|text-align|white-space|cursor|visibility)/;
    const skip = { position: "static", display: "block", transition: "all", top: "auto", right: "auto", bottom: "auto", left: "auto", "min-height": "auto", "max-width": "none", "object-fit": "fill", "aspect-ratio": "auto", "grid-template-columns": "none", "flex-direction": "row", "justify-content": "normal", "align-items": "normal", gap: "normal", overflow: "visible", "text-decoration-line": "none", "-webkit-line-clamp": "none", padding: "0px", margin: "0px", "border-radius": "0px", "background-color": "rgba(0, 0, 0, 0)" };
    for (const p of PROPS) {
      const v = cs.getPropertyValue(p);
      if (v === "" || defaults[p] === v || skip[p] === v) continue;
      if (p === "min-height" && v === "0px") continue;
      if ((p === "width" || p === "height") && !pseudo) continue;
      if (inherited.test(p) && parent && parent.getPropertyValue(p) === v && !(pseudo)) continue;
      if (/^border-(top|right|bottom|left)$/.test(p) && v.startsWith("0px")) continue;
      if (p === "transition" && v.startsWith("all 0s")) continue;
      style[p] = v;
    }
    return { label, count: els.length, rect: [r.x, r.y + scrollY, r.width, r.height].map((n) => Math.round(n * 10) / 10), text: (el.innerText || "").trim().slice(0, 60), style };
  });
}, [pairs, PROPS]);
await browser.close();
const json = JSON.stringify(result, null, 1);
if (out) fs.writeFileSync(out, json);
for (const r of result) {
  if (r.missing) { console.log(`## ${r.label}: MISSING ${r.missing}`); continue; }
  console.log(`## ${r.label} (${r.count}) rect=${r.rect.join(",")} "${r.text.replace(/\n/g, " / ")}"`);
  console.log("   " + Object.entries(r.style).map(([k, v]) => `${k}:${v}`).join("; "));
}
