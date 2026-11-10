/**
 * Lets the media routes check that a request comes from someone logged in to this project's Sanity
 * Studio: the Studio sends the editor's own Sanity token, and Sanity tells us who it belongs to and
 * their role. Viewers (read-only) are refused. The token is never stored or logged.
 */
import "server-only";

import { projectId } from "@/sanity/env";

const WRITE_ROLES = new Set(["administrator", "editor", "developer", "contributor"]);

export type StudioUser = { id: string; roles: string[] };

export async function studioUser(request: Request): Promise<StudioUser | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token || !projectId) return null;
  const response = await fetch(`https://${projectId}.api.sanity.io/v2021-06-07/users/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) return null;
  const me = (await response.json()) as { id?: string; roles?: { name?: string }[] };
  const roles = (me.roles ?? []).map((role) => role.name ?? "");
  if (!me.id || !roles.some((role) => WRITE_ROLES.has(role))) return null;
  return { id: me.id, roles };
}
