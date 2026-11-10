# Mengedit konten di Sanity (seperti Elementor)

Studio ada di situs sendiri: `/studio/` (lokal: http://localhost:3005/studio/). Login dengan akun Sanity
yang diundang ke proyek (role **Editor** atau **Administrator**).

## Isi Studio

| Menu | Isinya |
| --- | --- |
| **Pages** | 75 halaman, dikelompokkan: Homepage, Compound, Price, Goal, Bali area, City, Blog index, Information, Legal, Affiliate |
| **Shared sections** | Section yang tampil di banyak tempat. Edit sekali → semua halaman yang memakainya ikut berubah. Contoh: band "Contact us today" (8 halaman), "Contact us to get started" (6 halaman), dan blok tombol di bawah "Add to cart" di **semua 182 halaman produk** (#701) |
| **Site settings** | Top bar emas (pesan berjalan), menu utama (desktop + mobile, termasuk mega menu), footer (kolom link, kontak, metode pembayaran, disclaimer, copyright), cookie bar, teks age gate |
| **Popups** | Popup homepage: tawaran 5% (#5869) dan form-nya (#6534) |
| **Blog posts** | Isi artikel (54) sebagai rich text. Judul, tanggal, kategori, gambar utama dan SEO artikel masih dari salinan WordPress (tahap berikutnya) |
| **Products** | Teks produk (182): short description, catatan "included supplies", kotak "Also available as", dan tab (Description, Benefits, …). Harga & stok **tidak pernah** di Sanity (admin toko). Nama, gambar, varian dan SEO produk masih dari salinan WordPress |

## Struktur halaman = struktur Elementor

```
Page
 └─ Sections            (urutkan dengan drag, tambah, hapus, duplikat, sembunyikan)
     └─ Columns         (satu per kolom Elementor; namanya "Column 1/2", "Column 2/2 › Column 1/3" …)
         └─ Widgets     (urutkan, tambah, hapus, duplikat)
```

Widget yang bisa diedit sebagai field biasa:

| Widget | Yang bisa diubah |
| --- | --- |
| **Heading** | teks (tebal, miring, link, warna) + **Heading level H1–H6** (juga P/DIV/SPAN) |
| **Text** | editor rich text (lihat bawah) |
| **Button** | teks, link, buka di tab baru |
| **Picture** | gambar (Upload / Media library), alt text, link |
| **Icon box** | judul, level judul, deskripsi, link |
| **Icon list** | item (teks + link): tambah/hapus/urutkan |
| **FAQ / accordion** | pertanyaan + jawaban (rich text): tambah/hapus/urutkan |
| **HTML widget** | grid produk, form, counter, carousel, divider, ikon, shortcode… (diisi otomatis oleh situs; HTML-nya bisa diedit kalau perlu) |

Hitungannya sekarang: 533 heading, 541 teks, 441 tombol, 267 icon box, 66 gambar, 34 icon list,
16 FAQ — dan hanya 84 HTML widget.

## Editor rich text (seperti editor teks Elementor)

- Dropdown gaya: **Paragraph, Heading 1–6, Quote**
- Bold, Italic, Underline, Strikethrough, Code, Superscript, Subscript
- **Link** (alamat, tab baru, rel), **Text colour** (warna situs: Gold #B79127, Light gold, Dark gold,
  Bronze, Sand, hitam/abu, Cream, White, atau kode warna sendiri)
- Bullet dan numbered list
- Sisipkan: **Picture** (blok), gambar di dalam teks, **HTML**, **Box** (kotak `<div>` dari WordPress,
  isinya rich text juga)

"Original formatting" (ikon ⌁) adalah format bawaan WordPress (mis. `font-weight: 400`) yang menjaga
tampilan persis seperti live. Biarkan saja; teks baru tidak membutuhkannya.

## Gambar

Semua gambar ada di Cloudflare R2 (lihat `docs/setup/r2.md`). Di field gambar:
**Upload** (file baru), **Media library** (pilih yang sudah ada, bisa dicari), **Remove**, dan **Alt text**.
Sebelum R2 tersambung, Upload/Media library memberi pesan; alamat gambar tetap bisa ditempel manual.

## Section baru vs section dari WordPress

- Section/widget dari WordPress membawa id & class Elementor aslinya (tersembunyi), jadi gaya halaman
  (warna, jarak, background) tetap sama walau teks/gambar/urutan diganti. **Duplikat** section/widget
  juga membawa gayanya.
- Section/widget **baru** memakai markup standar Elementor + gaya global situs (font, warna dasar),
  tanpa gaya khusus per elemen. Untuk tampilan yang sama dengan section lain: duplikat section yang
  mirip lalu ganti isinya.
- Layout (jumlah/lebar kolom, background, padding) tidak diedit di Sanity — itu bagian desain.

## Publish → situs berubah

1. Edit → **Publish** (kanan bawah). Draft tidak tampil di situs.
2. Dengan webhook (`docs/setup/sanity.md` §8): Sanity memanggil `/api/sanity/revalidate` → kunjungan
   berikutnya sudah versi baru. Tanpa webhook (mis. di komputer ini): halaman disimpan 1 menit; kunjungan
   pertama sesudahnya membuat ulang di belakang layar, kunjungan berikutnya menampilkan perubahan.
3. Shared section / Site settings: satu publish mengubah semua halaman yang memakainya.

Pencarian situs (`/?s=…`) ikut berubah, dengan jeda cache yang sama seperti halaman: teks produk
(short description dan tab Description) dan isi artikel yang sudah di-publish langsung dicari. Produk
baru dari admin toko ikut dicari begitu teksnya diisi di sini. Yang belum: teks **Pages** di pencarian
masih dari salinan WordPress.

## Saklar sumber konten (untuk developer)

| Variabel | Arti |
| --- | --- |
| `CONTENT_SOURCE=sanity` | situs membaca Sanity; yang tidak ada di Sanity jatuh kembali ke `src/content/` |
| `NEXT_PUBLIC_SANITY_DATASET=staging` | dataset yang dibaca situs **dan** Studio |

Di komputer ini, `.env.production.local` menyalakan keduanya untuk build produksi (`npm run build` +
`next start -p 3005`) → situs lokal membaca **staging**. `npm run dev` tetap memakai `.env.local`
(production dataset kosong → file `src/content/`).

Build di komputer ini: `NEXT_BUILD_CPUS=4 npm run build` (dengan 11 worker default, build yang membaca
Sanity pernah kehabisan memori).

Impor ulang dari salinan live (`src/content/`):

```bash
node scripts/sanity/import-content.mjs --dataset staging
```

Default **tidak menimpa** dokumen yang sudah ada (editan aman). `--overwrite` menimpa semuanya dengan
salinan live. Dataset `production` butuh `--yes` juga.

Cek dataset masih identik dengan live (berguna tepat setelah impor):

```bash
SANITY_VERIFY_DATASET=staging npx vitest run src/lib/content/render/sanity-dataset.test.ts
```

## Cara kerjanya (singkat)

- `scripts/sanity/lib/` memecah HTML Elementor jadi section → kolom → widget, dan teks jadi Portable Text
  (rich text Sanity). Yang tidak punya tempat di rich text disimpan tersembunyi di sebelahnya.
- `src/lib/content/render/` menyusun kembali HTML Elementor dari Sanity; `ElementorContent` menampilkan
  seperti sebelumnya (carousel, grid produk, FAQ, form tetap jalan).
- `src/lib/content/render/round-trip.test.ts` membuktikan ke-75 halaman, 2 popup dan blok #701 keluar
  identik dengan HTML live.
