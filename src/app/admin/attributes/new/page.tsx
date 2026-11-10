/** /admin/attributes/new/: add a shop-wide attribute. */
import { Suspense } from "react";

import { staffOnly } from "../../orders/guard";
import { AttributeEditor } from "../AttributeEditor";

async function NewAttribute() {
  const access = await staffOnly();
  if ("refusal" in access) return access.refusal;
  return <AttributeEditor initial={null} />;
}

export default function NewAttributePage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <NewAttribute />
    </Suspense>
  );
}
