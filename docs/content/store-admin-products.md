# Admin toko: produk, kategori, atribut, harga dan stok

Alamat: `/admin/products/`, `/admin/categories/` dan `/admin/attributes/` (login dengan akun staf: role
**administrator** atau **shop_manager**). Ini pengganti WooCommerce → Products, → Categories dan →
Attributes. Setelah disimpan, toko, halaman produk, keranjang dan checkout langsung memakai data baru
(cache katalog disegarkan saat itu juga).

## Siapa mengurus apa (satu tempat untuk tiap hal)

| Hal | Di mana |
| --- | --- |
| **Menambah produk baru** | Admin toko → **Add new product** |
| **Menghapus produk** | Admin toko → produk → **Archive**, lalu **Delete permanently** |
| Nama, alamat (slug), kategori, status tampil/tidak | Admin toko |
| Harga normal, harga diskon + tanggal diskon | Admin toko |
| Stok (status, atau jumlah yang dihitung), backorder | Admin toko |
| Varian (mis. MG 5/10, jenis pen) dan harga/stok per varian | Admin toko |
| Kategori: nama, induk, judul halaman, urutan gambar bulat, gambar, SEO; tambah/hapus kategori | Admin toko → **Categories** |
| Atribut toko (MG, Pen Type, IU, Storage): nama, tampil sebagai tombol/dropdown, nilai dan urutannya | Admin toko → **Attributes** |
| Deskripsi singkat, tab Description/Benefits, catatan "included supplies", kotak "Also available as" | Sanity Studio → Products |
| Gambar produk (kartu, hover, galeri) | Sanity Studio → Products → Pictures (upload ke R2) |

Di Sanity tidak ada tombol buat/hapus/duplikat produk, dan nama/alamat hanya bisa dibaca. Admin toko yang
membuat, mengganti nama, mengarsipkan dan menghapus dokumen produk di Sanity. Tiap produk di Studio punya
tombol **Open in the store admin**, dan tiap produk di admin punya tombol **Edit texts & pictures in Sanity**.

## Menambah produk

1. **Add new product** → isi nama (alamat dibuat otomatis dari nama), pilih **Simple** atau **Variable**.
2. Simple: harga normal (Rp), harga diskon (opsional) + tanggal, stok.
3. Variable: **+ Add attribute…** → pilih atribut toko (mis. **MG**) lalu centang nilainya (`5 MG`, `10 MG`),
   atau pilih **Custom attribute (this product only)** untuk atribut yang hanya dipakai produk ini (mis.
   "Fill Volume": `3ml, 10ml`) → **Create all combinations** → isi harga dan stok tiap varian. Varian dengan
   harga 0 tidak bisa dibeli. Nilai yang belum ada (mis. `25 MG`) ditambahkan dulu di **Attributes**.
4. Centang kategori, pilih status (**Draft** dulu kalau belum siap), **Create product**.
5. Klik **Edit texts & pictures in Sanity** untuk deskripsi dan gambar, lalu **Publish** di Sanity.
6. Ganti status ke **Published** di admin saat siap tampil.

Produk baru mendapat nomor mulai 200000 (produk lama tetap memakai nomor WooCommerce). Halaman produknya
memakai susunan halaman produk yang biasa (galeri, form, blok tombol #701, tab, produk terkait).

## Arsip vs hapus

- **Archive (remove from the shop)**: produk langsung hilang dari toko, pencarian, dan alamatnya menjadi
  "not found". Pesanan lama tetap menampilkannya. Bisa **Restore** kapan saja (kembali ke status sebelumnya).
- **Delete permanently**: hanya untuk produk yang sudah diarsipkan **dan belum pernah dipesan**. Menghapus
  harga, stok, varian, riwayat stok, dan dokumen Sanity-nya. Tidak bisa dibatalkan.
- Produk yang **pernah dipesan** tidak bisa dihapus, hanya diarsipkan, supaya riwayat pesanan tetap utuh.
  Admin menjelaskan ini di layar produk.
- Varian yang dihapus dari form: dihapus kalau belum pernah dipesan dan tidak punya riwayat stok; kalau sudah,
  varian itu dinonaktifkan (tidak tampil, tidak bisa dibeli).

## Kategori (`/admin/categories/`)

Daftar kategori tampil sebagai pohon (induk dulu, lalu sub-kategori), dengan alamat, jumlah produk yang
tampil di kategori itu (termasuk sub-kategori, seperti hitungan WooCommerce) dan posisinya.

- **Add new category**: isi nama, pilih induk (atau "None" untuk tingkat atas). Alamatnya dibuat dari nama
  (mis. `/product-category/vial/lab-shelf/`) dan **tidak bisa diubah lagi**, karena produk dan kupon
  memakainya. Judul SEO dan meta description otomatis memakai pola live ("<nama> in Bali - Atlas
  Longevity", "Shop <nama> at Atlas Longevity in Bali: …") kalau dikosongkan.
- **Ganti nama**: nama baru langsung tampil di kartu produk, breadcrumb, daftar kategori di samping, gambar
  bulat dan saran pencarian. Judul halaman dan SEO yang masih otomatis ikut berubah; yang sudah diketik
  sendiri tetap.
- **Pindah induk**: alamatnya ikut berubah (mis. dari `/product-category/vial/x/` ke
  `/product-category/pen-peptides/x/`). Alamat lama tetap membuka kategori ini, karena yang dihitung hanya
  bagian terakhir alamat, sama seperti WordPress, dan canonical-nya menunjuk alamat baru.
- **Position**: urutan gambar bulat di atas produk (angka kecil di depan), di antara kategori dengan induk
  yang sama. Kategori tingkat atas tampil berurutan di `/shop/`.
- **Picture**: pilih dari media library (gambar yang sama dengan di Sanity) atau upload gambar baru (JPEG,
  PNG, WebP, GIF, AVIF; maksimal 15 MB). Tampil 300×300 sebagai gambar bulat, jadi gambar persegi paling
  bagus. Tanpa gambar, tile memakai gambar placeholder toko.
- **Delete**: hanya kalau kategori kosong. Tidak ada produk di dalamnya (produk arsip juga dihitung), tidak
  punya sub-kategori, dan tidak dipakai kupon. Kalau masih dipakai, layar menjelaskan apa yang harus
  dipindah dulu.
- Produk dimasukkan ke kategori dari layar produknya (kotak **Categories**).

## Atribut (`/admin/attributes/`)

Atribut toko adalah atribut yang dipakai banyak produk: **MG**, **Pen Type**, **IU**, **Storage** (dari
WooCommerce; "Purity" dan "Primary Research Areas" ada di WooCommerce tapi tidak dipakai varian, jadi
tidak diimpor).

- **Name** dan **Shown as** (Pills = tombol, Dropdown = pilihan): berlaku untuk semua produk yang memakai
  atribut itu.
- **Values**: ganti nama nilai (mis. `10 MG` → `10 mg`), ubah urutan dengan ↑ ↓, tambah nilai baru (pisahkan
  dengan koma). Urutan di sini adalah urutan tombol di halaman produk. Nilai teknis (abu-abu) tetap sama
  karena varian menyimpannya.
- **Remove** nilai dan **Delete attribute** hanya bisa kalau tidak ada produk yang memakainya. Jumlah produk
  per nilai terlihat di layar.
- Atribut khusus satu produk (mis. "Vial Size", "Variation") tidak ada di sini. Atribut seperti itu diatur
  di layar produknya.

## Stok

- Tanpa **Manage stock**: pilih status (In stock / Out of stock / On backorder).
- Dengan **Manage stock**: isi jumlahnya. Jumlah 0 berarti habis, kecuali backorder diizinkan
  ("Allow, but notify customer" menampilkan "Available on backorder").
- Setiap perubahan jumlah dicatat (siapa, berapa) di riwayat stok (`inventory_movements`).

## Diskon

Isi **Sale price** (harus lebih kecil dari harga normal). Tanggal kosong berarti langsung berlaku sampai
dihapus. Dengan tanggal, diskon mulai/berakhir paling lambat 1 jam setelah waktunya (cache katalog).
Saat diskon berjalan, produk dihitung "on sale" untuk kupon yang mengecualikan barang diskon.

Tampilan (markup WooCommerce `wc_format_sale_price`): harga normal dicoret abu-abu, lalu harga diskon, di
kartu produk, halaman produk (juga harga varian yang dipilih), quick view, saran pencarian, dan daftar
top-up di keranjang. Produk variable: harga dicoret hanya kalau semua variasinya satu harga (kalau tidak,
tampil rentang harga, seperti WooCommerce); harga varian yang dipilih tetap tampil dicoret. Warna dan ukuran
dari CSS tema Woodmart (`#bbb`, 90%) dan snippet pemilik untuk halaman produk. Label "Sale" / "-20%" di
gambar belum ditampilkan (pengaturan label tema di live tidak bisa dilihat karena belum ada produk diskon).

## Untuk developer

- Data: tabel `product_records`, `product_variants`, `inventory`, `inventory_movements` (migrasi 0008),
  `product_categories` dan `product_attributes` (migrasi 0009; kategori baru bernomor mulai 300000).
  Impor awal dari salinan live: `node scripts/import/import-catalog.mjs` (produk, 25 kategori, 4 atribut;
  tidak menimpa editan admin; `--overwrite` menimpa). Sudah dijalankan di Neon dan `.data/pglite`
  (9 Nov 2026).
- Kategori dan atribut: `src/lib/commerce/taxonomy-admin.ts` (+ `taxonomy-admin.test.ts`), halaman
  `src/app/admin/categories/` dan `src/app/admin/attributes/`. Katalog (`build.ts` `categoriesFrom`,
  `withShopAttributes`) menulis ulang nama/alamat kategori di kartu, breadcrumb dan detail produk, dan
  memakai nama, tampilan dan urutan atribut toko. Jumlah produk per kategori dihitung dari produk yang
  tampil. `build.test.ts` membuktikan data impor tetap sama persis dengan toko live.
- Atribut khusus produk disimpan sebagai `attribute_<slug>`, atribut toko sebagai `attribute_pa_<slug>`.
  Form produk dan server memakai aturan slug yang sama (`src/lib/commerce/slug.ts`).
- Halaman kategori dan halaman shop ke-2 dst. memakai `ensureStatic = "navigation"`. Argumen seperti
  `?orderby=` / `?per_page=` dipindah proxy ke alamat internal (`…/view/orderby%3Ddate/`, `VIEW_SEGMENT`),
  karena rute "navigation" tidak boleh membaca query. Tanpa itu, kategori baru, kategori yang dipindah atau
  halaman ke-N baru selalu disajikan sebagai App Shell Next 16 (judul "Page Not Found", `noindex`).
  Alamat internal itu sendiri 404.
- Gambar kategori: media library `src/lib/media/library.ts` (juga dipakai `/api/media/list/` untuk Studio)
  dan upload `src/lib/media/upload.ts` lewat `/api/admin/media/upload/` (khusus staf; route, bukan server
  action, karena server action dibatasi 1 MB).
- Katalog toko: `src/lib/catalog/store.ts` (baca database, cache tag `catalog`) + `build.ts` (gabung dengan
  salinan live untuk gambar dan susunan halaman). Tanpa produk di database, toko memakai salinan live.
  `build.test.ts` membuktikan katalog dari data impor sama persis dengan toko live.
- Proxy (`src/proxy.ts`) membaca daftar alamat produk dari `/api/catalog/index/` (disimpan 30 detik; alamat
  produk yang tidak dikenal dicek ulang dengan daftar segar), jadi produk baru langsung bisa dibuka dan
  produk arsip langsung 404.
- Rute produk memakai `ensureStatic = "navigation"`: kunjungan pertama ke produk yang dibuat setelah build
  menunggu halaman lengkap (tanpa itu Next 16 mengirim App Shell dengan judul "Page Not Found" dulu).
- Build di komputer ini membaca Neon. Server uji database lokal (port 3006) memakai cache katalog hasil build
  sampai ada simpanan di admin atau 1 jam; uji admin di sana lewat admin itu sendiri.
- Server 3006 dan 3005 memakai folder `.next` yang sama: halaman yang di-render ulang server 3006 (dengan
  produk uji dari database lokal) ikut tersaji di 3005. Build ulang sebelum membandingkan tampilan dengan live.
- Operasi admin: `src/lib/commerce/product-admin.ts` (+ `product-admin.test.ts`), halaman `src/app/admin/products/`.
- Sinkron Sanity butuh `SANITY_API_WRITE_TOKEN` di server (juga di Vercel). Tanpa itu admin tetap menyimpan,
  dengan peringatan bahwa dokumen Sanity tidak ikut diperbarui.
- Coba admin tanpa menyentuh Neon: preview **prod-local-db** (`scripts/dev/start-local-db.mjs`, port 3006,
  database lokal `.data/pglite`).
