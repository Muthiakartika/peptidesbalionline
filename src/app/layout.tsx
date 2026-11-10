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
