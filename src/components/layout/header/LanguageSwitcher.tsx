"use client";

/**
 * English / Indonesian flags. The live site uses the GTranslate plugin, which translates the page
 * in the browser with Google Translate (no separate /id/ pages). We load the same GTranslate
 * script with the same settings, so the behaviour is identical. Decision on real translations: Q-09.
 *
 * The wrapper starts empty, exactly like the live HTML: the GTranslate script adds the two flag
 * links itself (it appends, so pre-rendering them would show four flags). React must not manage
 * those children, hence suppressHydrationWarning and no JSX children.
 */
import Script from "next/script";

export function LanguageSwitcher({ widgetId }: { widgetId: string }) {
  const settings = {
    default_language: "en",
    languages: ["en", "id"],
    url_structure: "none",
    flag_style: "2d",
    flag_size: 24,
    wrapper_selector: `#gt-wrapper-${widgetId}`,
    alt_flags: [],
    horizontal_position: "inline",
    flags_location: "/brand/flags/",
  };
  return (
    <>
      <div id={`gt-wrapper-${widgetId}`} className="gtranslate_wrapper" suppressHydrationWarning />
      <Script id={`gt-settings-${widgetId}`} strategy="afterInteractive">
        {`window.gtranslateSettings = window.gtranslateSettings || {}; window.gtranslateSettings['${widgetId}'] = ${JSON.stringify(settings)};`}
      </Script>
      <Script id={`gt-widget-${widgetId}`} src="https://cdn.gtranslate.net/widgets/latest/flags.js" data-gt-widget-id={widgetId} strategy="afterInteractive" />
    </>
  );
}
