/** /admin/attributes/<slug>/: edit a shop-wide attribute (name, display, values and their order). */
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getEditorAttribute } from "@/lib/commerce/taxonomy-admin";

import { staffOnly } from "../../orders/guard";
import { AttributeEditor } from "../AttributeEditor";

async function EditAttribute({ params }: { params: Promise<{ slug: string }> }) {
  const access = await staffOnly();
  if ("refusal" in access) return access.refusal;
  const attribute = await getEditorAttribute(decodeURIComponent((await params).slug));
  if (!attribute) notFound();
  return <AttributeEditor key={JSON.stringify(attribute)} initial={attribute} />;
}

export default function EditAttributePage({ params }: PageProps<"/admin/attributes/[slug]">) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <EditAttribute params={params} />
    </Suspense>
  );
}
