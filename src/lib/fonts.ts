/**
 * The Google Fonts the live site loads (see docs/audit/visual-reference/design-tokens.json → font).
 * next/font downloads them at build time and serves them from our own domain, so there is no
 * request to Google from the visitor's browser.
 *
 * Each font exposes a CSS variable (e.g. --font-urbanist). globals.css maps those variables to
 * Tailwind classes: font-body, font-display, font-label, font-label-alt, font-serif, font-misc.
 */
import { Anton, Cormorant_Garamond, Inter, Inter_Tight, Jost, Montserrat, Poppins, Roboto, Urbanist } from "next/font/google";
import localFont from "next/font/local";

// The theme's icon font (search, account, cart, menu, close, arrows), copied from the live site's
// Woodmart theme so every icon is pixel-identical. Used by src/components/ui/Icon.tsx.
export const iconFont = localFont({
  src: "../assets/fonts/woodmart-font.woff2",
  display: "block",
  variable: "--font-woodmart",
});

// Body text, navigation, product names, prices, buttons. The live site loads exactly these four
// weights as separate files; the variable version of the font draws text very slightly differently.
export const urbanist = Urbanist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-urbanist",
});

// Big condensed uppercase headings on the homepage. Anton only exists in weight 400.
export const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-anton",
});

// Small uppercase "eyebrow" labels, footer headings, the hero pill; the text of several information
// pages (300–700, and italic 400 / 600 on /rewards/ and others).
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

// Homepage counter numbers (600) and icon-box titles such as "The Atlas Standard" (400); on
// /hgh-bali/ also 500 and 500 italic; 700 on the consultation and lab results pages (the font has
// no heavier weight: "800" there is drawn in 700). Note: the gold italic words in the homepage
// headings are Anton italic, not this font. A browser only downloads a weight when a page uses it.
export const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-cormorant",
});

// The homepage (600) and the text of the legal pages (300, 400; their bold 600).
export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  display: "swap",
  variable: "--font-poppins",
});

// The consultation form's fields (/peptide-consultation-bali/: Elementor's default form font).
// Not preloaded: one page uses it.
export const roboto = Roboto({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-roboto",
});

// One italic line on /lab-results-certificates-of-analysis/ (600 italic). Not preloaded either.
export const montserrat = Montserrat({
  subsets: ["latin"],
  weight: "600",
  style: "italic",
  display: "swap",
  preload: false,
  variable: "--font-montserrat",
});

// The text of the /hgh-bali/ landing page (400, its bold 600).
export const interTight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter-tight",
});

/** All font variables, ready to put on <html className={…}>. */
export const fontVariables = [urbanist, anton, inter, jost, cormorantGaramond, poppins, roboto, montserrat, interTight, iconFont]
  .map((font) => font.variable)
  .join(" ");
