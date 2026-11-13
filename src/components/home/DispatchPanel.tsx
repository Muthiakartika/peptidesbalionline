"use client";

/**
 * The homepage hero's dispatch panel (island "dispatch-panel", src/lib/home/dispatch.ts):
 *
 *   ┌ ● Order now for same-day Bali delivery            5h 39m ┐
 *   │   Order by 5 PM · Bali time                  left to order │
 *   └ [Vials →]  [Pens →]  [Nasal sprays →]                     ┘
 *
 * The time is Bali's (UTC+8, no daylight saving) whatever the visitor's own time zone. After the
 * cut-off it counts down to tomorrow's. The page is built in advance, so the time only appears once
 * the browser has worked it out (no mismatch between server and browser). Styles: src/styles/dispatch.css.
 */
import "@/styles/dispatch.css";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import type { DispatchPanelProps } from "@/lib/home/dispatch";

const HOUR = 3_600_000;
const BALI_OFFSET = 8;

/** The next cut-off (ms since 1970) and whether it is still today's, Bali time. */
export function nextCutoff(now: number, cutoffHour: number): { at: number; today: boolean } {
  const bali = new Date(now + BALI_OFFSET * HOUR);
  const today = Date.UTC(bali.getUTCFullYear(), bali.getUTCMonth(), bali.getUTCDate(), cutoffHour - BALI_OFFSET);
  return now < today ? { at: today, today: true } : { at: today + 24 * HOUR, today: false };
}

const twelveHour = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;

/** A clock that ticks every 20 seconds: the time rounded to 20 s (the same between two reads), and
 * null while the page is built and hydrated (the server doesn't know the visitor's "now"). */
const TICK = 20_000;
const subscribeClock = (onTick: () => void) => {
  const timer = window.setInterval(onTick, TICK);
  return () => window.clearInterval(timer);
};
const readClock = () => Math.floor(Date.now() / TICK) * TICK;
const serverClock = () => null;

export function DispatchPanel({ cutoffHour, tiles }: DispatchPanelProps) {
  const now = useSyncExternalStore(subscribeClock, readClock, serverClock);

  const cutoff = now === null ? null : nextCutoff(now, cutoffHour);
  const left = cutoff && now !== null ? Math.max(0, cutoff.at - now) : null;
  const hours = left === null ? null : Math.floor(left / HOUR);
  const minutes = left === null ? null : Math.floor((left % HOUR) / 60_000);
  const sameDay = cutoff?.today ?? true;

  return (
    <div className="dispatch">
      <div className="dispatch__timer" role="timer" aria-live="off">
        <span className="dispatch__dot" aria-hidden="true" />
        <span className="dispatch__text">
          <strong>{sameDay ? "Order now for same-day Bali delivery" : "Order now for delivery tomorrow"}</strong>
          <span>{sameDay ? `Order by ${twelveHour(cutoffHour)} · Bali time` : `Same-day dispatch for orders before ${twelveHour(cutoffHour)} · Bali time`}</span>
        </span>
        <span className="dispatch__clock">
          <strong>{hours === null ? "—" : `${hours}h ${String(minutes).padStart(2, "0")}m`}</strong>
          <span>{sameDay ? "left to order" : "to the next cut-off"}</span>
        </span>
      </div>
      <div className="dispatch__tiles">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href} className="dispatch__tile">
            <span className="dispatch__thumb">
              {/* eslint-disable-next-line @next/next/no-img-element -- the menu's own small pictures */}
              <img src={tile.image} alt="" width={56} height={56} loading="lazy" decoding="async" />
            </span>
            <span className="dispatch__label">
              <strong>{tile.label}</strong>
              <span>
                {tile.cta} <span aria-hidden="true">→</span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
