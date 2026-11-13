/**
 * The Google Fonts the site uses (the live site's: docs/audit/visual-reference/design-tokens.json →
 * font). next/font downloads them at build time and serves them from our own domain, so there is no
 * request to Google from the visitor's browser.
 *
 * Every page uses the homepage's font format (the owner's requests of 12 Nov 2026): Anton for big
 * headings and product titles, Inter for everything else (content, header, menus, product cards,
 * prices, cart, checkout and forms). Urbanist, the live theme's base font, is no longer used. The fonts
 * that only other pages used on the live site (Inter Tight, Montserrat, Roboto, Poppins 300/400,
 * Cormorant Garamond 700) are not loaded either: scripts/audit/homepage_typography.py rewrote their
 * pages' CSS.
 *
 * Each font exposes a CSS variable (e.g. --font-inter). globals.css maps those variables to
 * Tailwind classes: font-body, font-display, font-label, font-label-alt, font-serif, font-misc.
 */
import { Anton, Cormorant_Garamond, JetBrains_Mono, Inter, Jost, Poppins } from "next/font/google";
import localFont from "next/font/local";

// The theme's icon font (search, account, cart, menu, close, arrows), copied from the live site's
// Woodmart theme so every icon is pixel-identical. Used by src/components/ui/Icon.tsx.
export const iconFont = localFont({
  src: "../assets/fonts/woodmart-font.woff2",
  display: "block",
  variable: "--font-woodmart",
});

// Big headings on every page (the homepage's format). Anton only exists in weight 400; the
// homepage's H1 asks for 600, which the browser draws slightly bolder.
export const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-anton",
});

// The site's base font (globals.css --font-body): the text of every page, the header and menus,
// product cards, prices, the cart and checkout, labels, buttons and form fields (300–700, and italic
// 400 / 600 on /rewards/ and others).
export const inter = Inter({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-inter",
});

// Homepage stats labels.
export const jost = Jost({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jost",
});

// Accents, as on the homepage: counter numbers (600), the testimonials' italic quotes and "The Atlas
// Standard" (400), big numbers and accent lines on other pages (400–600, the COA library's purity
// values). Note: the gold italic words in the headings are Anton italic, not this font. A browser
// only downloads a weight when a page uses it.
export const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-cormorant",
});

// The homepage's age gate title (600).
export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
  variable: "--font-poppins",
});

/** All font variables, ready to put on <html className={…}>. */
// Numbers and codes in the COA library (certificates, purity, batch codes), as the COA archive the
// owner pointed to (12 Nov 2026). A browser only downloads it on pages that use it.
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-jetbrains",
  // Only a few pages use it: no <link rel="preload"> on every page.
  preload: false,
});

export const fontVariables = [anton, inter, jost, cormorantGaramond, poppins, jetbrainsMono, iconFont]
  .map((font) => font.variable)
  .join(" ");
