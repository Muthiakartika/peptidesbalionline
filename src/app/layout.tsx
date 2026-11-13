import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { isProduction, siteUrl } from "@/lib/site";
import "./globals.css";

// Each page sets its own title and description (copied from Yoast in Phase 4).
// These are only the fallbacks, taken from the live homepage.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Peptides Bali | Buy Peptides in Bali | Atlas Longevity",
  // The WordPress "Site Icon" (Customizer). The 32px and 192px tab icons and the 180px Apple icon are
  // the file-based icons next to this layout (icon1.png, icon2.png, apple-icon.png); WordPress also
  // prints this Windows tile tag, which has no file convention in Next.js.
  other: { "msapplication-TileImage": new URL("/brand/mstile-270x270.png", siteUrl).href },
  // Ownership checks printed in every page's <head> on live (13 Nov 2026): Google Search Console (Site Kit)
  // and Trustpilot. Search Console checks its tag again from time to time: without it at the move, the owner
  // could lose access to the site's Search Console data.
  verification: {
    google: "y9kwllsIlZp37iONB65fro-uvHKsxGZMyABri1RFqLA",
    other: { "trustpilot-one-time-domain-verification-id": "7c0a06a8-ac01-4d09-9f83-0c1ee9fd7ec8" },
  },
  robots: isProduction
    ? { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 }
    : { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-US" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
