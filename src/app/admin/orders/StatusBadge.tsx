/** An order status as WooCommerce's admin marks it (its status colours). */
import { ORDER_STATUS_NAMES } from "@/lib/commerce/orders";

const STATUS_COLOURS: Record<string, string> = {
  pending: "bg-[#e5e5e5] text-[#454545]",
  processing: "bg-[#c6e1c6] text-[#2c4700]",
  "on-hold": "bg-[#f8dda7] text-[#573b00]",
  completed: "bg-[#c8d7e1] text-[#003d66]",
  cancelled: "bg-[#e5e5e5] text-[#454545]",
  refunded: "bg-[#e5e5e5] text-[#454545]",
  failed: "bg-[#eba3a3] text-[#570000]",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-[12px] font-medium ${STATUS_COLOURS[status] ?? "bg-[#e5e5e5]"}`}>{ORDER_STATUS_NAMES[status] ?? status}</span>;
}

