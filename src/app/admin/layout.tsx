/**
 * The shop's staff area (/admin/…): WooCommerce → Orders, Products, Categories and Attributes for the rebuilt shop. Not part of the public site
 * (wp-admin isn't copied), so it has its own plain layout and is never indexed. Only accounts with the
 * administrator or shop_manager role get in (scripts/dev/set-role.mjs).
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Store admin - Atlas Longevity", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f0f0f1] text-[#1d2327] text-[14px] leading-[1.5]">
      <header className="flex items-center justify-between bg-[#1d2327] px-5 py-3 text-white">
        <div className="flex items-center gap-5">
          <span className="font-semibold">Atlas Longevity</span>
          <Link href="/admin/orders/" className="text-[13px] text-[#c3c4c7] hover:text-white">
            Orders
          </Link>
          <Link href="/admin/products/" className="text-[13px] text-[#c3c4c7] hover:text-white">
            Products
          </Link>
          <Link href="/admin/categories/" className="text-[13px] text-[#c3c4c7] hover:text-white">
            Categories
          </Link>
          <Link href="/admin/attributes/" className="text-[13px] text-[#c3c4c7] hover:text-white">
            Attributes
          </Link>
        </div>
        <nav className="flex gap-4 text-[13px] text-[#c3c4c7]">
          <Link href="/" className="hover:text-white">
            Visit shop
          </Link>
          <Link href="/my-account/" className="hover:text-white">
            My account
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-[1200px] p-5">{children}</main>
    </div>
  );
}
