/**
 * The Cloudflare R2 bucket that holds the site's pictures (S3-compatible API, signed with aws4fetch).
 * Settings (.env.local / Vercel; see docs/setup/r2.md): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_URL (the bucket's public address, e.g. a custom domain
 * such as https://media.peptidesbali.online or the bucket's r2.dev address).
 */
import "server-only";

import { AwsClient } from "aws4fetch";

export type R2Config = { accountId: string; bucket: string; publicUrl: string; client: AwsClient };

let cached: R2Config | null | undefined;

export function r2Config(): R2Config | null {
  if (cached !== undefined) return cached;
  const { R2_ACCOUNT_ID: accountId, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, R2_BUCKET: bucket, R2_PUBLIC_URL: publicUrl } = process.env;
  cached =
    accountId && accessKeyId && secretAccessKey && bucket && publicUrl
      ? { accountId, bucket, publicUrl: publicUrl.replace(/\/+$/, ""), client: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" }) }
      : null;
  return cached;
}

const objectUrl = (config: R2Config, key: string) => `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;

export async function objectExists(config: R2Config, key: string): Promise<boolean> {
  const response = await config.client.fetch(objectUrl(config, key), { method: "HEAD" });
  return response.ok;
}

export async function putObject(config: R2Config, key: string, body: ArrayBuffer | Uint8Array, contentType: string): Promise<void> {
  const response = await config.client.fetch(objectUrl(config, key), {
    method: "PUT",
    body: body as BodyInit,
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
  });
  if (!response.ok) throw new Error(`R2 upload failed (${response.status})`);
}

export type R2Object = { key: string; size: number; lastModified: string };

/** One page (up to 1,000) of the bucket's objects under a prefix. */
export async function listObjects(config: R2Config, prefix: string, continuationToken?: string): Promise<{ objects: R2Object[]; next: string | null }> {
  const params = new URLSearchParams({ "list-type": "2", prefix, "max-keys": "1000", ...(continuationToken ? { "continuation-token": continuationToken } : {}) });
  const response = await config.client.fetch(`https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}?${params}`);
  if (!response.ok) throw new Error(`R2 list failed (${response.status})`);
  const xml = await response.text();
  const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? "";
  const decode = (text: string) => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const objects = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(([, block]) => ({ key: decode(tag(block, "Key")), size: Number(tag(block, "Size")), lastModified: tag(block, "LastModified") }));
  const truncated = tag(xml, "IsTruncated") === "true";
  return { objects, next: truncated ? decode(tag(xml, "NextContinuationToken")) : null };
}

export const publicUrlFor = (config: R2Config, key: string) => `${config.publicUrl}/${key}`;
