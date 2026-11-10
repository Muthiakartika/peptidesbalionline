"use client";

/**
 * The attribute form (add and edit): name, slug (only when adding), display, and its values: rename,
 * move up / down, add, remove (only values no product uses). Delete at the bottom when unused.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { slugify } from "@/lib/commerce/slug";
import type { AdminAttribute } from "@/lib/commerce/taxonomy-admin";

import { deleteAttributeAction, saveAttributeAction } from "./actions";

type Term = { key: string; value?: string; label: string; products: number };

const input = "w-full rounded border border-[#8c8f94] px-2 py-1 text-[13px]";
const label = "mb-1 block text-[13px] font-semibold";
const box = "mb-4 border border-[#c3c4c7] bg-white";
const boxTitle = "border-b border-[#c3c4c7] px-3 py-2 font-semibold";
const hint = "mt-1 text-[12px] text-[#646970]";

let counter = 0;

type Message = { tone: "error" | "ok"; text: string };

/** A message kept for the form made again after a save (router.refresh with the saved values); only
 * for a few seconds, so it never shows up later on another form. */
let flash: (Message & { at: number }) | null = null;
const takeFlash = (): Message | null => {
  const kept = flash && Date.now() - flash.at < 5000 ? { tone: flash.tone, text: flash.text } : null;
  flash = null;
  return kept;
};

export function AttributeEditor({ initial }: { initial: AdminAttribute | null }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [message, setMessage] = useState<Message | null>(takeFlash);
  const [name, setName] = useState(initial?.label ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [swatches, setSwatches] = useState(initial?.swatches ?? false);
  const [terms, setTerms] = useState<Term[]>(() => (initial?.terms ?? []).map((t) => ({ ...t, key: t.value })));
  const [adding, setAdding] = useState("");

  const move = (index: number, by: number) => {
    const next = [...terms];
    const [term] = next.splice(index, 1);
    next.splice(index + by, 0, term);
    setTerms(next);
  };
  const add = () => {
    const labels = adding.split(",").map((s) => s.trim()).filter(Boolean);
    if (!labels.length) return;
    setTerms([...terms, ...labels.map((l) => ({ key: `new-${++counter}`, label: l, products: 0 }))]);
    setAdding("");
  };

  const run = (action: () => Promise<{ ok: true; id: string } | { ok: false; error: string }>, success: string, after?: (id: string) => void) =>
    start(async () => {
      setMessage(null);
      try {
        const result = await action();
        if (!result.ok) setMessage({ tone: "error", text: result.error });
        else {
          setMessage({ tone: "ok", text: success });
          // The page reloads the saved values (the form is made again): the message is shown again there.
          flash = { tone: "ok", text: success, at: Date.now() };
          if (after) after(result.id);
          else router.refresh();
        }
      } catch (error) {
        setMessage({ tone: "error", text: error instanceof Error ? error.message : "Something went wrong." });
      }
    });

  const save = () =>
    run(
      () => saveAttributeAction(initial?.slug ?? null, { label: name, slug, swatches, terms: terms.map(({ value, label }) => ({ value, label })) }),
      initial ? "Attribute updated. Every product using it shows it now." : "Attribute created.",
      initial ? undefined : (id) => router.push(`/admin/attributes/${id}/`),
    );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-normal">{initial ? "Edit attribute" : "Add new attribute"}</h1>
        <Link href="/admin/attributes/" className="ml-auto text-[13px] text-[#2271b1]">
          ← All attributes
        </Link>
      </div>
      {message ? (
        <p className={`mb-3 border-l-4 bg-white px-3 py-2 text-[13px] ${message.tone === "error" ? "border-[#d63638]" : "border-[#00a32a]"}`} role="status">
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div>
          <section className={box}>
            <div className="grid gap-3 p-3 md:grid-cols-2">
              <div>
                <span className={label}>Name</span>
                <input className={`${input} text-[16px]`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MG" />
                <p className={hint}>Shown above the value buttons on product pages and cards.</p>
              </div>
              <div>
                <span className={label}>Slug</span>
                {initial ? (
                  <p className="text-[13px]">
                    pa_{initial.slug} <span className="text-[#646970]">(fixed: variations use it)</span>
                  </p>
                ) : (
                  <>
                    <input className={input} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="made from the name when empty" />
                    <p className={hint}>Will be pa_{slugify(slug || name) || "…"}.</p>
                  </>
                )}
              </div>
              <div>
                <span className={label}>Shown as</span>
                <select className={input} value={swatches ? "pills" : "select"} onChange={(e) => setSwatches(e.target.value === "pills")}>
                  <option value="pills">Pills (buttons)</option>
                  <option value="select">Dropdown</option>
                </select>
              </div>
            </div>
          </section>

          <section className={box}>
            <div className={boxTitle}>Values ({terms.length})</div>
            <div className="p-3">
              {terms.map((t, i) => (
                <div key={t.key} className="mb-1 flex items-center gap-2">
                  <input className={`${input} max-w-[260px]`} value={t.label} onChange={(e) => setTerms(terms.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <span className="w-[110px] truncate text-[12px] text-[#646970]" title="value (variations store it)">
                    {t.value ?? slugify(t.label)}
                  </span>
                  <span className="w-[80px] text-[12px] text-[#646970]">{t.products ? `${t.products} product${t.products === 1 ? "" : "s"}` : "unused"}</span>
                  <button type="button" className="text-[13px] text-[#2271b1] disabled:text-[#c3c4c7]" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${t.label} up`}>
                    ↑
                  </button>
                  <button type="button" className="text-[13px] text-[#2271b1] disabled:text-[#c3c4c7]" disabled={i === terms.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${t.label} down`}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className="text-[13px] text-[#b32d2e] disabled:text-[#c3c4c7]"
                    disabled={t.products > 0}
                    title={t.products ? "Used by products: remove it from them first" : undefined}
                    onClick={() => setTerms(terms.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="mt-3 flex gap-2">
                <input
                  className={`${input} max-w-[360px]`}
                  value={adding}
                  onChange={(e) => setAdding(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      add();
                    }
                  }}
                  placeholder="new values, comma separated: 25 MG, 75 MG"
                />
                <button type="button" className="rounded border border-[#2271b1] px-2 text-[13px] text-[#2271b1]" onClick={add}>
                  + Add
                </button>
              </div>
              <p className={hint}>The order here is the order on product pages. A value&apos;s name can change; its value (grey) stays, because variations store it.</p>
            </div>
          </section>
        </div>

        <aside>
          <section className={box}>
            <div className={boxTitle}>Save</div>
            <div className="grid gap-3 p-3">
              <button type="button" disabled={busy} onClick={save} className="rounded bg-[#2271b1] px-3 py-1.5 text-[13px] text-white hover:bg-[#135e96] disabled:opacity-60">
                {busy ? "Saving…" : initial ? "Update" : "Create attribute"}
              </button>
              {initial ? <p className={hint}>Used by {initial.products} product{initial.products === 1 ? "" : "s"}.</p> : null}
            </div>
          </section>
          {initial ? (
            <section className={box}>
              <div className={boxTitle}>Delete</div>
              <div className="grid gap-2 p-3 text-[13px]">
                {initial.products ? (
                  <p className="text-[12px] text-[#646970]">This attribute can&apos;t be deleted while products use it.</p>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded border border-[#d63638] px-3 py-1 text-[#d63638]"
                    onClick={() => {
                      if (window.confirm(`Delete the attribute “${initial.label}” and its values? This can't be undone.`)) run(() => deleteAttributeAction(initial.slug), "Attribute deleted.", () => router.push("/admin/attributes/"));
                    }}
                  >
                    Delete attribute
                  </button>
                )}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
