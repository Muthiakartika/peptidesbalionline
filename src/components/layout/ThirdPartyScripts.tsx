/**
 * Analytics and live chat, with the same IDs as the live site (Q-11).
 * They load ONLY when SITE_ENV=production, so local and staging visits never pollute the
 * owner's analytics, session recordings or chat inbox. To see the Tawk.to chat bubble on a local
 * or staging site anyway, set ENABLE_LIVE_CHAT=true (analytics stay off). Every visit then shows in
 * the owner's Tawk dashboard, unless TAWK_PROPERTY_ID / TAWK_WIDGET_ID point to a test property
 * (src/lib/tawk.ts).
 */
import Script from "next/script";
import { isProduction } from "@/lib/site";
import { tawkEmbedUrl } from "@/lib/tawk";

import { TawkLauncher } from "./TawkLauncher";

const GTM_ID = "GTM-WXL8X6QM";
const CLARITY_ID = "ysc5h9iurz";
const TAWK_URL = checkedTawkUrl();
const chatOutsideProduction = process.env.ENABLE_LIVE_CHAT === "true";

/**
 * Wrong Tawk IDs in the environment stop the build with tawkEmbedUrl()'s message. A running server
 * (e.g. `next start` reading a .env.local changed after the build) keeps its pages working: the chat
 * is left out and the message goes to the server log.
 */
function checkedTawkUrl(): string | null {
  try {
    return tawkEmbedUrl();
  } catch (error) {
    if (process.env.NEXT_PHASE === "phase-production-build") throw error;
    console.error(`${error instanceof Error ? error.message : String(error)} The chat is left out until this is fixed.`);
    return null;
  }
}

/** Tawk.to's script and the owner's own chat button that replaces Tawk's launcher. */
function TawkChat() {
  if (!TAWK_URL) return null;
  return (
    <>
      <TawkLauncher />
      <Script id="tawk" strategy="lazyOnload">
        {`var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();(function(){var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];s1.async=true;s1.src='${TAWK_URL}';s1.charset='UTF-8';s1.setAttribute('crossorigin','*');s0.parentNode.insertBefore(s1,s0);})();`}
      </Script>
    </>
  );
}

export function ThirdPartyScripts() {
  if (!isProduction) return chatOutsideProduction ? <TawkChat /> : null;
  return (
    <>
      {/* Google Tag Manager (the live container also loads GA4 G-51PJX01T9F) */}
      <Script id="gtm" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>
      {/* Microsoft Clarity */}
      <Script id="clarity" strategy="lazyOnload">
        {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`}
      </Script>
      {/* Tawk.to live chat */}
      <TawkChat />
    </>
  );
}
