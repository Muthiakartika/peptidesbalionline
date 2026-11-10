"use client";

/**
 * Choose a picture from the media library (the R2 bucket, as the Studio's picture fields show it):
 * type part of a file name, click a picture; or upload a new one (/api/admin/media/upload/).
 */
import { useState, useTransition } from "react";

import type { LibraryItem } from "@/lib/media/library";

import { findPicturesAction } from "./media-actions";

export function PicturePicker({ onPick }: { onPick: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const search = () =>
    start(async () => {
      const result = await findPicturesAction(query);
      setItems(result.items);
      setError(result.error ?? null);
    });

  const upload = (file: File | undefined) => {
    if (!file) return;
    start(async () => {
      setError(null);
      const body = new FormData();
      body.append("file", file);
      try {
        const response = await fetch("/api/admin/media/upload/", { method: "POST", body });
        const result = (await response.json()) as { url?: string; error?: string };
        if (result.url) {
          onPick(result.url);
          setOpen(false);
        } else setError(result.error ?? "The picture couldn't be uploaded.");
      } catch {
        setError("The picture couldn't be uploaded. Please try again.");
      }
    });
  };

  const uploadButton = (
    <label className="cursor-pointer text-[13px] text-[#2271b1]">
      {busy ? "Working…" : "Upload a new picture…"}
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="hidden" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
    </label>
  );

  if (!open) {
    return (
      <div className="grid gap-1">
        <button
          type="button"
          className="text-left text-[13px] text-[#2271b1]"
          onClick={() => {
            setOpen(true);
            search();
          }}
        >
          Choose from the media library…
        </button>
        {uploadButton}
        {error ? <p className="text-[12px] text-[#b32d2e]">{error}</p> : null}
      </div>
    );
  }
  return (
    <div className="rounded border border-[#dcdcde] p-2">
      <div className="mb-2">{uploadButton}</div>
      <div className="mb-2 flex gap-1">
        <input
          className="w-full rounded border border-[#8c8f94] px-2 py-1 text-[13px]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder="file name, e.g. bpc"
        />
        <button type="button" className="rounded border border-[#2271b1] px-2 text-[13px] text-[#2271b1]" onClick={search} disabled={busy}>
          Search
        </button>
      </div>
      {error ? <p className="text-[12px] text-[#b32d2e]">{error}</p> : null}
      {busy && !items ? <p className="text-[12px] text-[#646970]">Loading…</p> : null}
      {items && !items.length && !error ? <p className="text-[12px] text-[#646970]">No pictures found.</p> : null}
      <div className="grid max-h-[260px] grid-cols-3 gap-1 overflow-y-auto">
        {(items ?? []).map((item) => (
          <button
            key={item.key}
            type="button"
            title={item.key.split("/").at(-1)}
            className="aspect-square overflow-hidden rounded border border-[#dcdcde] bg-[#f6f7f7] hover:border-[#2271b1]"
            onClick={() => {
              onPick(item.url);
              setOpen(false);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails straight from the media library */}
            <img src={item.url} alt="" loading="lazy" className="size-full object-contain" />
          </button>
        ))}
      </div>
      <button type="button" className="mt-2 text-[12px] text-[#646970]" onClick={() => setOpen(false)}>
        Close
      </button>
    </div>
  );
}
