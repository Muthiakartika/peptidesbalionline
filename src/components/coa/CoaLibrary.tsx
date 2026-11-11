"use client";

/**
 * The COA library on /lab-results-certificates-of-analysis/ (11 Nov 2026), modelled on the feature
 * set of a COA archive (search, filters, sort, share view, compare, preview) in this site's design.
 *
 *   header      the page's "Find Your Product" texts + four numbers (certificates, average purity,
 *               compounds, labs)
 *   toolbar     search (Ctrl/⌘ + K or "/"), filters (compound, lab, purity, month tested), sort,
 *               grid / list, "Share view" (copies a link that reopens these filters)
 *   results     cards or rows; tick to compare side by side or list their reports
 *   preview     a certificate's details; our PDFs are shown inside, Janoshik reports open on
 *               Janoshik (their site can't be embedded)
 *
 * Data: src/lib/coa/library.ts reads it from the page's COA cards. Styles: src/styles/coa-library.css.
 */
import "@/styles/coa-library.css";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { emailCoaLinks } from "@/lib/coa/actions";

import { COA_LINKS_SUBJECT, coaLinksText } from "./links-text";
import type { Coa, CoaLibraryProps } from "./types";

type Sort = "newest" | "oldest" | "purity" | "name";
type View = "grid" | "list";

const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "purity", label: "Highest purity" },
  { value: "name", label: "Name A–Z" },
];
const PURITY_STEPS = [99, 99.5, 99.8];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1] ?? ""} ${key.slice(0, 4)}`;
const MAX_COMPARE = 4;

/* ── Small icons (stroke icons, 1.8px) ─────────────────────────────────────────────────────────── */
const PATHS = {
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4.35-4.35",
  chevron: "m6 9 6 6 6-6",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  external: "M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6M9 17h4",
  close: "M6 6l12 12M18 6 6 18",
  compare: "M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M12 2v20",
  copy: "M9 9h10v10H9zM5 15V5h10",
  shield: "M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Zm-3 9 2 2 4-4",
  arrow: "M5 12h14M13 6l6 6-6 6",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
} as const;

function Icon({ name, className }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg className={`coa-icon${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────────────────────────────── */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

const haystack = (c: Coa) => [c.peptide, c.title, c.amount, c.lab, c.batch, c.task, c.verificationKey, c.searchCode, c.accession, c.testedLabel, c.purityText].filter(Boolean).join(" ").toLowerCase();

/** Width of the purity bar: the 99–100 % range fills the bar (results under 99 % show a sliver). */
const meter = (purity: number) => `${Math.max(4, Math.min(100, (purity - 99) * 100))}%`;

function Modal({ title, eyebrow, onClose, wide, children, footer }: { title: string; eyebrow?: string; onClose: () => void; wide?: boolean; children: ReactNode; footer?: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);
  return createPortal(
    <div className="coa-modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`coa-modal__panel${wide ? " coa-modal__panel--wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="coa-modal__head">
          <div>
            {eyebrow ? <p className="coa-eyebrow">{eyebrow}</p> : null}
            <h2 className="coa-modal__title">{title}</h2>
          </div>
          <button ref={closeRef} type="button" className="coa-icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="coa-modal__body">{children}</div>
        {footer ? <footer className="coa-modal__foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

function FilterMenu({ id, label, count, open, onToggle, children }: { id: string; label: string; count: number; open: boolean; onToggle: (id: string | null) => void; children: ReactNode }) {
  return (
    <div className={`coa-filter${open ? " is-open" : ""}`} data-filter-menu={id}>
      <button type="button" className={`coa-filter__btn${count ? " is-active" : ""}`} aria-expanded={open} onClick={() => onToggle(open ? null : id)}>
        {label}
        {count ? <span className="coa-filter__count">{count}</span> : null}
        <Icon name="chevron" className="coa-filter__chev" />
      </button>
      {open ? <div className="coa-filter__menu">{children}</div> : null}
    </div>
  );
}

/** The lab's codes for a certificate, as label/value pairs (Janoshik task + key, Freedom search code + accession). */
function codesOf(c: Coa): { label: string; value: string; copy?: boolean }[] {
  const out: { label: string; value: string; copy?: boolean }[] = [];
  if (c.task) out.push({ label: "Task", value: `#${c.task}` });
  if (c.verificationKey) out.push({ label: "Verification key", value: c.verificationKey, copy: true });
  if (c.searchCode) out.push({ label: "Search code", value: c.searchCode, copy: true });
  if (c.accession) out.push({ label: "Accession", value: `#${c.accession}` });
  return out;
}

/* ── "Request COA verification links" ─────────────────────────────────────────────────────────── */
type RequestState = { step: "form" | "sending" } | { step: "done"; status: "sent" | "saved-locally" } | { step: "fallback" } | { step: "error"; message: string };

function RequestLinks({ coas, onClose, say }: { coas: Coa[]; onClose: () => void; say: (message: string) => void }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<RequestState>({ step: "form" });
  const libraryUrl = typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}#result`;
  const text = coaLinksText(coas, libraryUrl);
  const mailto = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(`${COA_LINKS_SUBJECT} (${coas.length})`)}&body=${encodeURIComponent(text)}`;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState({ step: "sending" });
    try {
      const result = await emailCoaLinks(email, coas.map((c) => c.id));
      if (result.status === "error") setState({ step: "error", message: result.message });
      else if (result.status === "not-sent") setState({ step: "fallback" });
      else setState({ step: "done", status: result.status });
    } catch {
      setState({ step: "fallback" });
    }
  };

  return (
    <Modal title="Request COA verification links" eyebrow={`${coas.length} ${coas.length === 1 ? "certificate" : "certificates"}`} onClose={onClose}>
      <p className="coa-request__intro">We&apos;ll email you the links to the issuing laboratory, so you can verify the requested reports directly.</p>
      <ul className="coa-request__list">
        {coas.map((c) => (
          <li key={c.id}>
            <span>{c.title}</span>
            <span className="coa-request__meta">
              {c.purityText} · {c.lab}
            </span>
          </li>
        ))}
      </ul>
      {state.step === "done" ? (
        <p className="coa-request__ok" role="status">
          {state.status === "sent" ? (
            <>
              Sent. Check your inbox at <strong>{email.trim()}</strong>.
            </>
          ) : (
            <>Saved on this computer in .data/mail/ (no e-mail provider is set up yet, so nothing was sent).</>
          )}
        </p>
      ) : state.step === "fallback" ? (
        <div className="coa-request__fallback" role="status">
          <p>
            Emails can&apos;t be sent from the site yet. Your links are ready below: open them in your own email app, or copy them.
          </p>
          <textarea readOnly value={text} rows={7} aria-label="Verification links" onFocus={(e) => e.currentTarget.select()} />
          <div className="coa-request__actions">
            <a className="coa-btn coa-btn--gold" href={mailto}>
              <Icon name="mail" />
              Open in my email app
            </a>
            <button type="button" className="coa-btn coa-btn--ghost" onClick={async () => say((await copyText(text)) ? "Links copied." : "Couldn't copy.")}>
              <Icon name="copy" />
              Copy all links
            </button>
          </div>
        </div>
      ) : (
        <form className="coa-request__form" onSubmit={submit} noValidate>
          <label htmlFor="coa-request-email">Email address</label>
          <input id="coa-request-email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          {state.step === "error" ? (
            <p className="coa-request__error" role="alert">
              {state.message}
            </p>
          ) : null}
          <button type="submit" className="coa-btn coa-btn--gold" disabled={state.step === "sending"}>
            <Icon name="mail" />
            {state.step === "sending" ? "Sending…" : "Email COA links"}
          </button>
          <p className="coa-request__privacy">We only use this address to send these links.</p>
        </form>
      )}
    </Modal>
  );
}

/* ── The library ───────────────────────────────────────────────────────────────────────────────── */
export function CoaLibrary({ coas, intro }: CoaLibraryProps) {
  const [query, setQuery] = useState("");
  const [peptides, setPeptides] = useState<string[]>([]);
  const [labs, setLabs] = useState<string[]>([]);
  const [minPurity, setMinPurity] = useState<number | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("newest");
  const [view, setView] = useState<View>("grid");
  const [selected, setSelected] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"compare" | "reports" | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** Certificates whose verification links the visitor asked for (the request window is open). */
  const [requestIds, setRequestIds] = useState<string[] | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(query);

  const options = useMemo(() => {
    const count = (values: string[]) => [...values.reduce((map, v) => map.set(v, (map.get(v) ?? 0) + 1), new Map<string, number>())];
    return {
      peptides: count(coas.map((c) => c.peptide)).sort((a, b) => a[0].localeCompare(b[0])),
      labs: count(coas.map((c) => c.lab)).sort((a, b) => b[1] - a[1]),
      months: count(coas.map((c) => monthKey(c.testedOn)).filter(Boolean)).sort((a, b) => b[0].localeCompare(a[0])),
    };
  }, [coas]);

  const stats = useMemo(() => {
    const purities = coas.map((c) => c.purity).filter((p) => Number.isFinite(p));
    const average = purities.length ? purities.reduce((a, b) => a + b, 0) / purities.length : 0;
    return { total: coas.length, average: `${average.toFixed(2)}%`, compounds: options.peptides.length, labs: options.labs.length, highest: Math.max(...purities) };
  }, [coas, options]);

  const results = useMemo(() => {
    const words = deferredQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const list = coas.filter((c) => {
      if (peptides.length && !peptides.includes(c.peptide)) return false;
      if (labs.length && !labs.includes(c.lab)) return false;
      if (minPurity !== null && !(c.purity >= minPurity)) return false;
      if (months.length && !months.includes(monthKey(c.testedOn))) return false;
      const text = haystack(c);
      return words.every((w) => text.includes(w));
    });
    const by: Record<Sort, (a: Coa, b: Coa) => number> = {
      newest: (a, b) => b.testedOn.localeCompare(a.testedOn) || a.peptide.localeCompare(b.peptide),
      oldest: (a, b) => a.testedOn.localeCompare(b.testedOn) || a.peptide.localeCompare(b.peptide),
      purity: (a, b) => b.purity - a.purity,
      name: (a, b) => a.peptide.localeCompare(b.peptide) || b.testedOn.localeCompare(a.testedOn),
    };
    return [...list].sort(by[sort]);
  }, [coas, deferredQuery, peptides, labs, minPurity, months, sort]);

  const filterCount = peptides.length + labs.length + months.length + (minPurity !== null ? 1 : 0);
  const preview = previewId ? (coas.find((c) => c.id === previewId) ?? null) : null;
  const chosen = selected.map((id) => coas.find((c) => c.id === id)).filter((c): c is Coa => Boolean(c));
  const allVisibleSelected = results.length > 0 && results.every((c) => selected.includes(c.id));

  const say = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2400);
  }, []);

  // Filters (and an open certificate) from the address: links made with "Share view" / "Copy link".
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const list = (key: string) => (p.get(key) ?? "").split(",").map((v) => v.trim()).filter(Boolean);
    /* eslint-disable react-hooks/set-state-in-effect -- reading the address once, after hydration */
    if (p.get("q")) setQuery(p.get("q") ?? "");
    if (list("compound").length) setPeptides(list("compound").filter((v) => coas.some((c) => c.peptide === v)));
    if (list("lab").length) setLabs(list("lab").filter((v) => coas.some((c) => c.lab === v)));
    if (list("tested").length) setMonths(list("tested"));
    const purity = Number(p.get("purity"));
    if (PURITY_STEPS.includes(purity)) setMinPurity(purity);
    const s = p.get("sort") as Sort | null;
    if (s && SORTS.some((o) => o.value === s)) setSort(s);
    if (p.get("view") === "list") setView("list");
    const open = p.get("coa");
    if (open && coas.some((c) => c.id === open)) {
      setPreviewId(open);
      rootRef.current?.scrollIntoView({ block: "start" });
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [coas]);

  // Ctrl/⌘ + K or "/" jumps to the search; Escape closes a menu.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
      if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") || (event.key === "/" && !typing)) {
        event.preventDefault();
        searchRef.current?.focus({ preventScroll: true });
        searchRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      } else if (event.key === "Escape") {
        if (previewId || panel || requestIds) {
          setPreviewId(null);
          setPanel(null);
          setRequestIds(null);
        } else setMenu(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewId, panel, requestIds]);

  // A click outside an open filter menu closes it.
  useEffect(() => {
    if (!menu) return;
    const onDown = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(`[data-filter-menu="${menu}"]`)) setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  const toggleIn = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const clearAll = () => {
    setQuery("");
    setPeptides([]);
    setLabs([]);
    setMinPurity(null);
    setMonths([]);
  };

  const viewUrl = (extra?: Record<string, string>) => {
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (peptides.length) p.set("compound", peptides.join(","));
    if (labs.length) p.set("lab", labs.join(","));
    if (minPurity !== null) p.set("purity", String(minPurity));
    if (months.length) p.set("tested", months.join(","));
    if (sort !== "newest") p.set("sort", sort);
    if (view !== "grid") p.set("view", view);
    for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
    const search = p.toString();
    return `${window.location.origin}${window.location.pathname}${search ? `?${search}` : ""}#result`;
  };

  const shareView = async () => say((await copyText(viewUrl())) ? "Link copied: it opens the library with these filters." : "Couldn't copy the link.");
  const copyCode = async (label: string, value: string) => say((await copyText(value)) ? `${label} copied: ${value}` : "Couldn't copy.");

  const chips: { label: string; clear: () => void }[] = [
    ...peptides.map((v) => ({ label: v, clear: () => setPeptides((l) => l.filter((x) => x !== v)) })),
    ...labs.map((v) => ({ label: v, clear: () => setLabs((l) => l.filter((x) => x !== v)) })),
    ...(minPurity !== null ? [{ label: `≥ ${minPurity}% purity`, clear: () => setMinPurity(null) }] : []),
    ...months.map((v) => ({ label: `Tested ${monthLabel(v)}`, clear: () => setMonths((l) => l.filter((x) => x !== v)) })),
  ];

  /** As on the old cards: "Verify on <lab>" (the lab's own copy), "View report", plus our Preview. */
  const actions = (c: Coa, compact = false) => (
    <div className={`coa-actions${compact ? " coa-actions--compact" : ""}`}>
      {c.verifyUrl ? (
        <a className="coa-btn coa-btn--gold coa-actions__verify" href={c.verifyUrl} target="_blank" rel="noopener noreferrer" aria-label={`Verify ${c.title} on ${c.lab} (opens in a new tab)`}>
          <Icon name="shield" />
          Verify on {c.lab}
        </a>
      ) : null}
      {c.reportUrl ? (
        <a className="coa-btn coa-btn--ghost" href={c.reportUrl} target="_blank" rel="noopener noreferrer" aria-label={`View the report of ${c.title} (opens in a new tab)`}>
          <Icon name="file" />
          {c.reportIsPdf ? "View report PDF" : "View report"}
        </a>
      ) : null}
      <button type="button" className="coa-btn coa-btn--ghost" onClick={() => setPreviewId(c.id)} aria-label={`Preview ${c.title}`}>
        <Icon name="eye" />
        Preview
      </button>
    </div>
  );

  const checkbox = (c: Coa) => (
    <label className="coa-check">
      <input type="checkbox" checked={selected.includes(c.id)} onChange={() => setSelected((s) => toggleIn(s, c.id))} />
      <span className="coa-check__box" aria-hidden="true" />
      <span className="coa-sr-only">Select {c.title} for comparing</span>
    </label>
  );

  return (
    <div className="coa-lib" ref={rootRef}>
      <div className="coa-wrap">
        <header className="coa-head">
          <p className="coa-eyebrow">{intro.eyebrow}</p>
          <h2 className="coa-title">{intro.title}</h2>
          <p className="coa-lede">{intro.text}</p>
        </header>

        <dl className="coa-stats">
          <div>
            <dt>Certificates</dt>
            <dd>{stats.total}</dd>
          </div>
          <div>
            <dt>Average purity</dt>
            <dd>{stats.average}</dd>
          </div>
          <div>
            <dt>Compounds tested</dt>
            <dd>{stats.compounds}</dd>
          </div>
          <div>
            <dt>Independent labs</dt>
            <dd>{stats.labs}</dd>
          </div>
        </dl>

        <div className="coa-toolbar">
          <label className="coa-search">
            <span className="coa-sr-only">Search certificates</span>
            <Icon name="search" />
            <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, batch or code" autoComplete="off" />
            <kbd className="coa-kbd" aria-hidden="true">
              Ctrl K
            </kbd>
          </label>

          <div className="coa-toolbar__row">
            <div className="coa-filters" role="group" aria-label="Filters">
              <FilterMenu id="compound" label="Compound" count={peptides.length} open={menu === "compound"} onToggle={setMenu}>
                <div className="coa-menu__list">
                  {options.peptides.map(([value, n]) => (
                    <label key={value} className="coa-option">
                      <input type="checkbox" checked={peptides.includes(value)} onChange={() => setPeptides((l) => toggleIn(l, value))} />
                      <span>{value}</span>
                      <span className="coa-option__n">{n}</span>
                    </label>
                  ))}
                </div>
                {peptides.length ? (
                  <button type="button" className="coa-menu__clear" onClick={() => setPeptides([])}>
                    Clear
                  </button>
                ) : null}
              </FilterMenu>
              <FilterMenu id="lab" label="Laboratory" count={labs.length} open={menu === "lab"} onToggle={setMenu}>
                <div className="coa-menu__list">
                  {options.labs.map(([value, n]) => (
                    <label key={value} className="coa-option">
                      <input type="checkbox" checked={labs.includes(value)} onChange={() => setLabs((l) => toggleIn(l, value))} />
                      <span>{value}</span>
                      <span className="coa-option__n">{n}</span>
                    </label>
                  ))}
                </div>
              </FilterMenu>
              <FilterMenu id="purity" label="Purity" count={minPurity !== null ? 1 : 0} open={menu === "purity"} onToggle={setMenu}>
                <div className="coa-menu__list">
                  {[null, ...PURITY_STEPS].map((step) => (
                    <label key={String(step)} className="coa-option">
                      <input type="radio" name="coa-purity" checked={minPurity === step} onChange={() => setMinPurity(step)} />
                      <span>{step === null ? "Any purity" : `${step}% or higher`}</span>
                      <span className="coa-option__n">{step === null ? coas.length : coas.filter((c) => c.purity >= step).length}</span>
                    </label>
                  ))}
                </div>
              </FilterMenu>
              <FilterMenu id="tested" label="Date tested" count={months.length} open={menu === "tested"} onToggle={setMenu}>
                <div className="coa-menu__list">
                  {options.months.map(([value, n]) => (
                    <label key={value} className="coa-option">
                      <input type="checkbox" checked={months.includes(value)} onChange={() => setMonths((l) => toggleIn(l, value))} />
                      <span>{monthLabel(value)}</span>
                      <span className="coa-option__n">{n}</span>
                    </label>
                  ))}
                </div>
              </FilterMenu>
            </div>

            <div className="coa-tools">
              <label className="coa-sort">
                <span className="coa-sr-only">Sort by</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  {SORTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <Icon name="chevron" />
              </label>
              <div className="coa-segment" role="group" aria-label="Layout">
                <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")} aria-label="Cards">
                  <Icon name="grid" />
                </button>
                <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} aria-label="List">
                  <Icon name="list" />
                </button>
              </div>
              <button type="button" className="coa-btn coa-btn--ghost coa-share" onClick={shareView} aria-label="Share view: copy a link to these results">
                <Icon name="share" />
                <span className="coa-share__text">Share view</span>
              </button>
            </div>
          </div>

          {chips.length ? (
            <div className="coa-chips">
              {chips.map((chip) => (
                <button key={chip.label} type="button" className="coa-chip" onClick={chip.clear} aria-label={`Remove filter ${chip.label}`}>
                  {chip.label}
                  <Icon name="close" />
                </button>
              ))}
              <button type="button" className="coa-link" onClick={clearAll}>
                Clear all
              </button>
            </div>
          ) : null}
        </div>

        <div className="coa-resultbar">
          <label className="coa-check coa-check--all">
            <input type="checkbox" checked={allVisibleSelected} disabled={!results.length} onChange={() => setSelected(allVisibleSelected ? selected.filter((id) => !results.some((c) => c.id === id)) : [...new Set([...selected, ...results.map((c) => c.id)])])} />
            <span className="coa-check__box" aria-hidden="true" />
            <span>Select all</span>
          </label>
          <p className="coa-count" aria-live="polite">
            Showing <strong>{results.length}</strong> of {coas.length} certificates
            {filterCount || query ? "" : ` · highest ${stats.highest}%`}
          </p>
          {selected.length ? (
            <div className="coa-selection">
              <span className="coa-selection__n">{selected.length} selected</span>
              <button type="button" className="coa-btn coa-btn--dark" onClick={() => setPanel("compare")} disabled={selected.length < 2} title={selected.length < 2 ? "Select at least two certificates" : undefined}>
                <Icon name="compare" />
                Compare
              </button>
              <button type="button" className="coa-btn coa-btn--ghost" onClick={() => setPanel("reports")}>
                <Icon name="file" />
                Reports
              </button>
              <button type="button" className="coa-btn coa-btn--ghost" onClick={() => setRequestIds(selected)}>
                <Icon name="mail" />
                Email links
              </button>
              <button type="button" className="coa-link" onClick={() => setSelected([])}>
                Clear
              </button>
            </div>
          ) : null}
        </div>

        {results.length === 0 ? (
          <div className="coa-empty">
            <p className="coa-empty__title">No certificate matches {query ? <>“{query}”</> : "these filters"}.</p>
            <p>Try another word or remove a filter. Can&apos;t find a batch? Ask us and we&apos;ll check.</p>
            <div className="coa-empty__actions">
              <button type="button" className="coa-btn coa-btn--dark" onClick={clearAll}>
                Show all certificates
              </button>
              <Link className="coa-btn coa-btn--ghost" href="/contact-peptides-bali/">
                Request a certificate
              </Link>
            </div>
          </div>
        ) : view === "grid" ? (
          <div className="coa-grid">
            {results.map((c) => (
              <article key={c.id} className={`coa-card${selected.includes(c.id) ? " is-selected" : ""}`}>
                <header className="coa-card__head">
                  {checkbox(c)}
                  <div className="coa-card__name">
                    <p className="coa-card__peptide">{c.peptide}</p>
                    <h3 className="coa-card__title">{c.title}</h3>
                  </div>
                  <span className="coa-purity" title="Purity">
                    {c.purityText}
                  </span>
                </header>
                <div className="coa-meter" role="img" aria-label={`Purity ${c.purityText}`}>
                  <span style={{ width: meter(c.purity) }} />
                </div>
                <dl className="coa-facts">
                  <div>
                    <dt>Laboratory</dt>
                    <dd>{c.lab}</dd>
                  </div>
                  <div>
                    <dt>Tested</dt>
                    <dd>
                      <time dateTime={c.testedOn}>{c.testedLabel}</time>
                    </dd>
                  </div>
                  <div>
                    <dt>{c.searchCode ? "Search code" : "Batch / ref."}</dt>
                    <dd className="coa-mono">
                      {c.searchCode ? (
                        <button type="button" className="coa-copy" onClick={() => copyCode("Search code", c.searchCode!)} title="Copy the search code">
                          {c.searchCode}
                          <Icon name="copy" />
                        </button>
                      ) : (
                        (c.batch ?? "—")
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{c.task ? "Task" : "Accession"}</dt>
                    <dd className="coa-mono">{c.task ? `#${c.task}` : c.accession ? `#${c.accession}` : "—"}</dd>
                  </div>
                </dl>
                <footer className="coa-card__foot">
                  {actions(c)}
                  {c.productPath ? (
                    <Link className="coa-card__product" href={c.productPath}>
                      View product
                      <Icon name="arrow" />
                    </Link>
                  ) : null}
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <div className="coa-table-wrap">
            <table className="coa-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="coa-sr-only">Select</span>
                  </th>
                  <th scope="col">Certificate</th>
                  <th scope="col">Purity</th>
                  <th scope="col">Laboratory</th>
                  <th scope="col">Tested</th>
                  <th scope="col">Reference</th>
                  <th scope="col">
                    <span className="coa-sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((c) => (
                  <tr key={c.id} className={selected.includes(c.id) ? "is-selected" : undefined}>
                    <td>{checkbox(c)}</td>
                    <td>
                      <p className="coa-card__peptide">{c.peptide}</p>
                      {c.productPath ? <Link href={c.productPath}>{c.title}</Link> : c.title}
                    </td>
                    <td>
                      <span className="coa-purity">{c.purityText}</span>
                    </td>
                    <td data-label="Lab">{c.lab}</td>
                    <td data-label="Tested">
                      <time dateTime={c.testedOn}>{c.testedLabel}</time>
                    </td>
                    <td data-label="Ref." className="coa-mono">
                      {c.task ? `Task #${c.task}` : (c.searchCode ?? c.batch ?? "—")}
                    </td>
                    <td>{actions(c, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {preview ? (
        <Modal
          wide={preview.reportIsPdf}
          eyebrow={`${preview.lab} · ${preview.testedLabel}`}
          title={preview.title}
          onClose={() => setPreviewId(null)}
          footer={
            <>
              <button
                type="button"
                className="coa-btn coa-btn--ghost"
                onClick={() => {
                  setRequestIds([preview.id]);
                  setPreviewId(null);
                }}
              >
                <Icon name="mail" />
                Email links
              </button>
              <button type="button" className="coa-btn coa-btn--ghost" onClick={async () => say((await copyText(viewUrl({ coa: preview.id }))) ? "Link to this certificate copied." : "Couldn't copy the link.")}>
                <Icon name="share" />
                Copy link
              </button>
              {preview.productPath ? (
                <Link className="coa-btn coa-btn--ghost" href={preview.productPath}>
                  View product
                </Link>
              ) : null}
              {preview.reportUrl && preview.reportUrl !== preview.verifyUrl ? (
                <a className="coa-btn coa-btn--ghost" href={preview.reportUrl} target="_blank" rel="noopener noreferrer">
                  <Icon name="file" />
                  {preview.reportIsPdf ? "View report PDF" : "View report"}
                </a>
              ) : null}
              {preview.verifyUrl ? (
                <a className="coa-btn coa-btn--gold" href={preview.verifyUrl} target="_blank" rel="noopener noreferrer">
                  <Icon name="shield" />
                  Verify on {preview.lab}
                </a>
              ) : null}
            </>
          }
        >
          <div className={`coa-preview${preview.reportIsPdf ? " coa-preview--pdf" : ""}`}>
            <div className="coa-preview__facts">
              <div className="coa-preview__purity">
                <span className="coa-preview__value">{preview.purityText}</span>
                <span className="coa-preview__label">Purity</span>
                <div className="coa-meter">
                  <span style={{ width: meter(preview.purity) }} />
                </div>
              </div>
              <dl className="coa-facts coa-facts--stack">
                <div>
                  <dt>Compound</dt>
                  <dd>
                    {preview.peptide}
                    {preview.amount ? ` · ${preview.amount}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Laboratory</dt>
                  <dd>{preview.lab}</dd>
                </div>
                <div>
                  <dt>Tested</dt>
                  <dd>
                    <time dateTime={preview.testedOn}>{preview.testedLabel}</time>
                  </dd>
                </div>
                {preview.batch ? (
                  <div>
                    <dt>Batch / ref.</dt>
                    <dd className="coa-mono">{preview.batch}</dd>
                  </div>
                ) : null}
                {codesOf(preview).map((code) => (
                  <div key={code.label}>
                    <dt>{code.label}</dt>
                    <dd className="coa-mono">
                      {code.copy ? (
                        <button type="button" className="coa-copy" onClick={() => copyCode(code.label, code.value)} title={`Copy the ${code.label.toLowerCase()}`}>
                          {code.value}
                          <Icon name="copy" />
                        </button>
                      ) : (
                        code.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              {preview.searchCode && preview.verifyUrl ? (
                <p className="coa-note">&ldquo;Verify on {preview.lab}&rdquo; opens this certificate from the lab&apos;s own document server ({preview.searchCode}).</p>
              ) : null}
            </div>
            {preview.reportIsPdf && preview.reportUrl ? (
              <div className="coa-preview__doc">
                <iframe src={`${preview.reportUrl}#view=FitH`} title={`${preview.title}: certificate of analysis (PDF)`} loading="lazy" />
              </div>
            ) : (
              <div className="coa-preview__lab">
                <Icon name="shield" className="coa-preview__shield" />
                <p className="coa-preview__lab-title">Verified on {preview.lab}</p>
                <p>
                  {preview.lab} publishes this report on its own verification page{preview.verificationKey ? ", under the key shown here" : ""}. It opens in a new tab: the lab&apos;s site
                  can&apos;t be shown inside ours.
                </p>
                {preview.verifyUrl ? (
                  <a className="coa-btn coa-btn--dark" href={preview.verifyUrl} target="_blank" rel="noopener noreferrer">
                    <Icon name="external" />
                    Verify on {preview.lab}
                  </a>
                ) : null}
              </div>
            )}
          </div>
        </Modal>
      ) : null}

      {panel === "compare" && chosen.length ? (
        <Modal wide title="Side-by-side comparison" eyebrow={`${Math.min(chosen.length, MAX_COMPARE)} certificates`} onClose={() => setPanel(null)}>
          {chosen.length > MAX_COMPARE ? <p className="coa-note">Showing the first {MAX_COMPARE} of {chosen.length} selected certificates.</p> : null}
          <div className="coa-compare" style={{ "--coa-cols": Math.min(chosen.length, MAX_COMPARE) } as CSSProperties}>
            {(() => {
              const shown = chosen.slice(0, MAX_COMPARE);
              const best = Math.max(...shown.map((c) => c.purity));
              return shown.map((c) => (
                <section key={c.id} className="coa-compare__col">
                  <p className="coa-card__peptide">{c.peptide}</p>
                  <h3 className="coa-card__title">{c.title}</h3>
                  <p className={`coa-compare__purity${c.purity === best ? " is-best" : ""}`}>
                    {c.purityText}
                    {c.purity === best && shown.length > 1 ? <span>Highest</span> : null}
                  </p>
                  <div className="coa-meter">
                    <span style={{ width: meter(c.purity) }} />
                  </div>
                  <dl className="coa-facts coa-facts--stack">
                    <div>
                      <dt>Laboratory</dt>
                      <dd>{c.lab}</dd>
                    </div>
                    <div>
                      <dt>Tested</dt>
                      <dd>{c.testedLabel}</dd>
                    </div>
                    <div>
                      <dt>Amount</dt>
                      <dd>{c.amount || "—"}</dd>
                    </div>
                    <div>
                      <dt>Batch / ref.</dt>
                      <dd className="coa-mono">{c.batch ?? c.searchCode ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>{c.task ? "Task" : "Accession"}</dt>
                      <dd className="coa-mono">{c.task ? `#${c.task}` : c.accession ? `#${c.accession}` : "—"}</dd>
                    </div>
                  </dl>
                  {actions(c, true)}
                </section>
              ));
            })()}
          </div>
        </Modal>
      ) : null}

      {panel === "reports" && chosen.length ? (
        <Modal title="Reports of the selected certificates" eyebrow={`${chosen.length} selected`} onClose={() => setPanel(null)}>
          <ul className="coa-reports">
            {chosen.map((c) => (
              <li key={c.id}>
                <div>
                  <p className="coa-reports__name">{c.title}</p>
                  <p className="coa-reports__meta">
                    {c.purityText} · {c.lab} · {c.testedLabel}
                  </p>
                </div>
                {c.reportUrl ? (
                  <a className="coa-btn coa-btn--gold" href={c.reportUrl} target="_blank" rel="noopener noreferrer">
                    <Icon name={c.reportIsPdf ? "file" : "external"} />
                    {c.reportIsPdf ? "PDF" : c.lab}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </Modal>
      ) : null}

      {requestIds?.length ? <RequestLinks coas={requestIds.map((id) => coas.find((c) => c.id === id)).filter((c): c is Coa => Boolean(c))} onClose={() => setRequestIds(null)} say={say} /> : null}

      {toast ? (
        <div className="coa-toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
