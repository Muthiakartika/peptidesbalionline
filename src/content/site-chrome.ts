/**
 * Everything shown in the header, footer and global popups, copied WORD FOR WORD from
 * https://peptidesbali.online on 3 Nov 2026 (including the live site's typos, e.g. "Whatsaap";
 * fixing them is open question Q-14). Updated 11 Nov 2026 after the owner moved "Insights" and
 * "Consulting" out of the Calculator dropdown into a new footer column.
 *
 * The defaults: with CONTENT_SOURCE=sanity the texts and menus come from Sanity (Site settings,
 * src/lib/content/site-chrome.ts), and anything left empty there falls back to these. The import
 * (scripts/sanity/import-content.mjs) fills Site settings from this file; keep both shapes in sync
 * (src/sanity/schemas/documents/siteSettings.ts).
 */

export type NavLink = { label: string; href: string; image?: string; children?: NavLink[] };

export const whatsappNumber = "6282326300167";
export const whatsappUrl = `https://wa.me/${whatsappNumber}`;

/** Gold top bar. Woodmart marquee: 25s per loop, 30px gap, pauses on hover (desktop). */
export type Announcement = { text: string; underline?: string; href?: string };
export const announcements: Announcement[] = [
  { text: "☆ Lab-tested research peptides · Same-day Bali dispatch before 5 PM ☆" },
  { text: "☆ Bundles: 20% off + free Bali delivery", underline: "Shop bundles", href: "/product-category/bundles/" },
  { text: "☆ Same Day Delivery Across Bali Contact us on Whatsaap ☆", href: whatsappUrl },
];

/** Desktop main menu (Woodmart "Main menu"), same order as the live site. */
export const mainMenu: NavLink[] = [
  {
    label: "Peptide",
    href: "/peptide/",
    children: [
      {
        label: "Peptide Vials",
        href: "/product-category/vial/",
        image: "/images/nav/peptide-vials.webp",
        children: [
          { label: "Brain & Cognitive Enhancement", href: "/product-category/vial/brain-cognitive-enhancement/" },
          { label: "Fat Loss & Metabolic Health", href: "/product-category/vial/fat-loss-metabolic-health/" },
          { label: "Healing & Recovery", href: "/product-category/vial/healing-recovery/" },
          { label: "Hormone Optimization", href: "/product-category/vial/hormone-optimization/" },
          { label: "Libido & Sexual Wellness", href: "/product-category/vial/libido-sexual-wellness/" },
          { label: "Longevity & Healthy Ageing", href: "/product-category/vial/longevity-healthy-aging/" },
          { label: "Muscle Growth & Performance", href: "/product-category/vial/muscle-growth-performance/" },
          { label: "Peptide Blends Bali", href: "/product-category/vial/blends/" },
          { label: "Research Compounds", href: "/product-category/vial/research-compounds/" },
          { label: "Supplies", href: "/product-category/vial/supplies/" },
          { label: "Vitamins & Wellness Injections", href: "/product-category/vial/vitamins-wellness-injections/" },
        ],
      },
      { label: "Peptide Pens", href: "/product-category/pen-peptides/", image: "/images/nav/peptide-pens.png" },
      { label: "Peptide Nasal Sprays", href: "/product-category/nasal-spray-peptides/", image: "/images/nav/peptide-nasal-sprays.webp" },
      { label: "Peptide Protocols", href: "/product-category/peptide-protocols/", image: "/images/nav/peptide-protocols.webp" },
      { label: "Bundles", href: "/product-category/bundles/", image: "/images/nav/bundles.webp" },
      { label: "Other", href: "/product-category/other/" },
    ],
  },
  { label: "Lab Results", href: "/lab-results-certificates-of-analysis/" },
  { label: "Rewards", href: "/rewards/" },
  { label: "Protocol Builder", href: "/protocol-builder/" },
  // No dropdown since 11 Nov 2026: its Insights and Consulting links are in the footer's "Insights" column.
  { label: "Calculator", href: "/calculator/" },
];

export type FooterColumn = { heading: string; headingTag: "h2" | "h4"; uppercase: boolean; links: { label: string; href?: string }[] };

export type FooterContent = typeof footer;
export const footer = {
  intro: "Driving innovation in science with high-purity research materials. Access reserved for qualified professionals.",
  topColumns: [
    {
      heading: "NAVIGATION",
      headingTag: "h2",
      uppercase: false,
      // "Home" is plain text on the live site (not a link). Kept as-is; see Q-14.
      links: [
        { label: "Home" },
        { label: "Contact Support", href: "/contact-peptides-bali/" },
        { label: "Peptides in Bali", href: "/peptides-bali/" },
        { label: "GHK-Cu in Bali", href: "/ghk-cu-bali/" },
        { label: "Affiliates", href: "/affiliate-program/" },
        { label: "Affiliate Login", href: "/affiliate-login/" },
        { label: "Affiliate Registration", href: "/affiliate-registration/" },
      ],
    },
    {
      heading: "Legal Information",
      headingTag: "h2",
      uppercase: true,
      links: [
        { label: "Privacy Policy", href: "/privacy-policy/" },
        { label: "Terms & Conditions", href: "/terms-conditions/" },
        { label: "Research Use Only Disclaimer", href: "/disclaimer/" },
        { label: "No Medical Advice Disclaimer", href: "/no-medical-advice-disclaimer/" },
        { label: "Refund & Returns Policy", href: "/refund-returns-policy/" },
        { label: "Abuse Policy", href: "/abuse-policy/" },
      ],
    },
  ] satisfies FooterColumn[],
  contact: {
    heading: "Contact",
    email: "hello@peptidesbali.online",
    address: "Jl. Pantai Cemongkak, Pecatu, Kec. Kuta Sel., Kabupaten Badung, Bali 80361",
  },
  linkColumns: [
    {
      heading: "Peptides Delivery in Bali",
      headingTag: "h4",
      uppercase: true,
      links: [
        { label: "Peptides Denpasar", href: "/peptides-denpasar/" },
        { label: "Peptides Seminyak", href: "/peptides-seminyak/" },
        { label: "Peptides Canggu", href: "/peptides-canggu/" },
        { label: "Peptides Ubud", href: "/peptides-ubud/" },
        { label: "Peptides Sanur", href: "/peptides-sanur/" },
        { label: "Peptides Nusa Dua", href: "/peptides-nusa-dua/" },
        { label: "Peptides Uluwatu", href: "/peptides-uluwatu/" },
      ],
    },
    {
      heading: "Nationwide Delivery",
      headingTag: "h4",
      uppercase: true,
      links: [
        { label: "Peptides Jakarta", href: "/peptide/jakarta/" },
        { label: "Peptides Surabaya", href: "/peptide/surabaya/" },
        { label: "Peptides Bandung", href: "/peptide/bandung/" },
        { label: "Peptides Medan", href: "/peptide/medan/" },
        { label: "Peptides Makassar", href: "/peptide/makassar/" },
        { label: "Peptides Balikpapan", href: "/peptide/balikpapan/" },
        { label: "Peptides Batam", href: "/peptide/batam/" },
        { label: "Peptides Yogyakarta", href: "/peptide/yogyakarta/" },
      ],
    },
    {
      heading: "Pricing & Guides",
      headingTag: "h4",
      uppercase: true,
      links: [
        { label: "BPC-157 Bali Price", href: "/bpc-157-bali-price/" },
        { label: "TB-500 Bali Price", href: "/tb-500-bali-price/" },
        { label: "GLP-2 TRZ Bali Price", href: "/tirzepatide-bali-price/" },
        { label: "Melanotan II Bali", href: "/melanotan-ii-bali/" },
        { label: "HGH Bali", href: "/hgh-bali/" },
        { label: "GLP-2 TRZ Dosage Guide", href: "/tirzepatide-dosage-guide-bali/" },
        { label: "Injury & Healing Peptides", href: "/injury-healing-peptides-bali/" },
        { label: "Libido Peptides", href: "/libido-peptides-bali/" },
      ],
    },
    {
      // Added by the owner on live (seen 11 Nov 2026). "News" opens the blog, like the old menu's "Insights".
      heading: "Insights",
      headingTag: "h4",
      uppercase: true,
      links: [
        { label: "News", href: "/insights/" },
        { label: "Consulting", href: "/peptide-consultation-bali/" },
      ],
    },
  ] satisfies FooterColumn[],
  paymentLabel: "Payment Methods",
  paymentMethods: ["Visa", "Mastercard", "Apple Pay", "Google Pay", "Crypto", "Wise", "Revolut", "Cash on Delivery"],
  disclaimer:
    "Products and information on this website are intended for lawful research use only. They are not intended for human or animal consumption, diagnosis, treatment, cure, prevention, injection, or personal use.",
  copyright: "© 2026 Atlas Longevity. All rights reserved.",
};

/** Elementor popup #5870 (age verification). */
export type AgeGateContent = typeof ageGate;
export const ageGate = {
  eyebrow: "research use only . age 21+",
  /** Two parts: the live heading has a line break after "confirm" (added by the owner after Phase 3a). */
  title: ["Before you continue, confirm", "your intent."],
  englishBefore: "Everything listed by ",
  englishBrand: "Atlas Longevity",
  englishAfter:
    " is sold for in-vitro and laboratory research. These compounds are not medicines, not approved therapeutics, and are not offered to diagnose, treat, or prevent any condition. Human or animal consumption is strictly prohibited.",
  indonesian:
    "Semua produk yang tercantum oleh Atlas Longevity dijual untuk penelitian in vitro dan laboratorium. Senyawa-senyawa ini bukanlah obat-obatan, bukan terapi yang disetujui, dan tidak ditawarkan untuk mendiagnosis, mengobati, atau mencegah kondisi apa pun. Konsumsi oleh manusia atau hewan dilarang keras.",
  enterLabel: "I'm 21+ — enter for research",
  backLabel: "Take me back",
  footnote:
    "Entering confirms you are at least 21 and are purchasing solely for legitimate research. This confirmation stays on your device for 30 days.",
  /** Live behaviour (Elementor settings): opens 1s after page load, at most 3 times per browser. Q-10. */
  delayMs: 1000,
  maxTimesShown: 3,
  /**
   * Owner's decision of 6 Nov 2026 (not on the live site): the homepage's "5% off" popup opens this
   * long after "I'm 21+" is clicked, and never while the age gate is open.
   */
  offerDelayAfterConfirmMs: 3000,
};

export type CookieNoticeContent = typeof cookieNotice;
export const cookieNotice = {
  text: "We use cookies to improve your experience on our website. By browsing this website, you agree to our use of cookies.",
  button: "Accept",
};
