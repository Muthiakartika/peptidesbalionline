/** Like WordPress's sanitize_file_name: letters, digits, dots, dashes and underscores only
 * ("Foto Produk BPC 157.JPG" → "Foto-Produk-BPC-157"), accents dropped, at most 80 characters. */
export function safeFileName(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return base.slice(0, 80) || "image";
}
