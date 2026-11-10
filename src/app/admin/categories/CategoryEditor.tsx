"use client";

/**
 * The category form (add and edit): name, address (only when adding), parent, page heading, carousel
 * position, picture, SEO title and description; delete at the bottom when nothing uses the category.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { AdminCategory } from "@/lib/commerce/taxonomy-admin";
import { slugify } from "@/lib/commerce/slug";

import { PicturePicker } from "../PicturePicker";
import { deleteCategoryAction, saveCategoryAction } from "./actions";

type Option = Pick<AdminCategory, "id" | "name" | "depth" | "path" | "parentId">;

const input = "w-full rounded border border-[#8c8f94] px-2 py-1 text-[13px]";
const label = "mb-1 block text-[13px] font-semibold";
const box = "mb-4 border border-[#c3c4c7] bg-white";
const boxTitle = "border-b border-[#c3c4c7] px-3 py-2 font-semibold";
const hint = "mt-1 text-[12px] text-[#646970]";

type Message = { tone: "error" | "ok"; text: string };

/** A message kept for the form made again after a save (router.refresh with the saved values); only
 * for a few seconds, so it never shows up later on another form. */
let flash: (Message & { at: number }) | null = null;
const takeFlash = (): Message | null => {
  const kept = flash && Date.now() - flash.at < 5000 ? { tone: flash.tone, text: flash.text } : null;
  flash = null;
  return kept;
};

export function CategoryEditor({ initial, categories, deleteBlocked }: { initial: AdminCategory | null; categories: Option[]; deleteBlocked: string | null }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [message, setMessage] = useState<Message | null>(takeFlash);
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [parentId, setParentId] = useState(initial?.parentId ?? 0);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [picture, setPicture] = useState(initial?.tileImage?.src ?? "");
  const [seoTitle, setSeoTitle] = useState(initial?.seo.title ?? "");
  const [seoDescription, setSeoDescription] = useState(initial?.seo.description ?? "");

  // A category can't go under itself or one of its own sub-categories.
  const own = new Set<number>(initial ? [initial.id] : []);
  for (let grew = Boolean(initial); grew; ) {
    grew = false;
    for (const c of categories) {
      if (!own.has(c.id) && own.has(c.parentId)) {
        own.add(c.id);
        grew = true;
      }
    }
  }
  const parent = categories.find((c) => c.id === parentId);
  const finalSlug = initial ? initial.slug : slugify(slug || name);
  const address = `${parent ? parent.path : "/product-category/"}${finalSlug || "…"}/`;

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
      () => saveCategoryAction(initial?.id ?? null, { name, slug, parentId, title, sortOrder, picture, seoTitle, seoDescription }),
      initial ? "Category updated. The shop shows it now." : "Category created.",
      initial ? undefined : (id) => router.push(`/admin/categories/${id}/`),
    );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-normal">{initial ? "Edit category" : "Add new category"}</h1>
        {initial ? (
          <a href={initial.path} target="_blank" rel="noreferrer" className="text-[13px] text-[#2271b1]">
            View category ↗
          </a>
        ) : null}
        <Link href="/admin/categories/" className="ml-auto text-[13px] text-[#2271b1]">
          ← All categories
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
            <div className="grid gap-3 p-3">
              <div>
                <span className={label}>Name</span>
                <input className={`${input} text-[16px]`} value={name} onChange={(e) => setName(e.target.value)} />
                <p className={hint}>Shown on product cards, breadcrumbs, the categories list and the round pictures.</p>
              </div>
              <div>
                <span className={label}>Address</span>
                {initial ? (
                  <p className="text-[13px]">
                    {address} <span className="text-[#646970]">(fixed: products and coupons use it)</span>
                  </p>
                ) : (
                  <>
                    <input className={input} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="made from the name when empty" />
                    <p className={hint}>
                      Will be <strong>{address}</strong>. It can&apos;t be changed later.
                    </p>
                  </>
                )}
              </div>
              <div>
                <span className={label}>Parent category</span>
                <select className={input} value={parentId} onChange={(e) => setParentId(Number(e.target.value))}>
                  <option value={0}>None (top level)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} disabled={own.has(c.id)}>
                      {"— ".repeat(c.depth)}
                      {c.name}
                    </option>
                  ))}
                </select>
                {initial && parentId !== initial.parentId ? <p className="mt-1 text-[12px] text-[#996800]">Moving changes the address to {address}. The old address still opens this category (only the last part counts, as on WordPress).</p> : null}
              </div>
              <div>
                <span className={label}>Page heading</span>
                <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="the name when empty" />
              </div>
            </div>
          </section>

          <section className={box}>
            <div className={boxTitle}>Search engines (SEO)</div>
            <div className="grid gap-3 p-3">
              <div>
                <span className={label}>SEO title</span>
                <input className={input} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={`${name || "Name"} in Bali - Atlas Longevity`} />
              </div>
              <div>
                <span className={label}>Meta description</span>
                <textarea className={input} rows={3} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder={`Shop ${name || "Name"} at Atlas Longevity in Bali: …`} />
              </div>
              <p className={hint}>Empty: the automatic text, as on the live site. While a field still has its automatic text it follows a new name.</p>
            </div>
          </section>
        </div>

        <aside>
          <section className={box}>
            <div className={boxTitle}>Save</div>
            <div className="grid gap-3 p-3">
              <div>
                <span className={label}>Position in the round pictures</span>
                <input className={input} inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value.replace(/[^\d-]/g, "")) || 0)} />
                <p className={hint}>Lower comes first among the categories with the same parent.</p>
              </div>
              <button type="button" disabled={busy} onClick={save} className="rounded bg-[#2271b1] px-3 py-1.5 text-[13px] text-white hover:bg-[#135e96] disabled:opacity-60">
                {busy ? "Saving…" : initial ? "Update" : "Create category"}
              </button>
            </div>
          </section>

          <section className={box}>
            <div className={boxTitle}>Picture</div>
            <div className="grid gap-2 p-3">
              {picture ? (
                // eslint-disable-next-line @next/next/no-img-element -- an address typed by staff, previewed as it is
                <img src={picture} alt="" className="mx-auto size-[120px] rounded-full border border-[#dcdcde] object-cover" />
              ) : (
                <p className="text-[12px] text-[#646970]">No picture: the round tile shows the shop&apos;s placeholder.</p>
              )}
              <PicturePicker onPick={setPicture} />
              <input className={input} value={picture} onChange={(e) => setPicture(e.target.value)} placeholder="or paste an address: https://…/picture.webp" />
              {picture ? (
                <button type="button" className="text-left text-[12px] text-[#b32d2e]" onClick={() => setPicture("")}>
                  Remove picture
                </button>
              ) : null}
              <p className={hint}>The round tile above the products (shown 300×300, so a square picture looks best). Uploads go to the same media library as the Studio&apos;s.</p>
            </div>
          </section>

          {initial ? (
            <section className={box}>
              <div className={boxTitle}>Delete</div>
              <div className="grid gap-2 p-3 text-[13px]">
                {deleteBlocked ? (
                  <p className="text-[12px] text-[#646970]">This category can&apos;t be deleted. {deleteBlocked}</p>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded border border-[#d63638] px-3 py-1 text-[#d63638]"
                    onClick={() => {
                      if (window.confirm(`Delete the category “${initial.name}”? Its page ${initial.path} stops working. This can't be undone.`)) {
                        run(() => deleteCategoryAction(initial.id), "Category deleted.", () => router.push("/admin/categories/"));
                      }
                    }}
                  >
                    Delete category
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
