/**
 * At the top of a product in the Studio: where its price, stock, variations, categories and status are
 * changed (the store admin), with a link to the product there, and its status in the shop.
 */
import { Button, Card, Flex, Stack, Text } from "@sanity/ui";
import { useFormValue, type StringInputProps } from "sanity";

const STATUS: Record<string, string> = { publish: "Published in the shop", draft: "Draft (hidden from the shop)", private: "Private (hidden from the shop)", archived: "Archived (hidden from the shop)" };

export function StoreAdminLink(props: StringInputProps) {
  void props;
  const ownId = useFormValue(["shopId"]) as number | undefined;
  const legacyId = useFormValue(["legacyWooId"]) as number | undefined;
  const shopId = ownId ?? legacyId;
  const status = useFormValue(["storeStatus"]) as string | undefined;
  return (
    <Card padding={3} radius={2} tone="primary" border>
      <Stack gap={3}>
        <Text size={1}>
          Price, stock, variations, categories and whether the product is in the shop are changed in the store admin. Products are also added and deleted there (this document follows).
        </Text>
        <Flex gap={3} align="center" wrap="wrap">
          {shopId ? <Button as="a" href={`/admin/products/${shopId}/`} target="_blank" rel="noreferrer" text="Open in the store admin ↗" tone="primary" /> : <Button as="a" href="/admin/products/" target="_blank" rel="noreferrer" text="Store admin ↗" />}
          {status ? (
            <Text size={1} muted>
              {STATUS[status] ?? status}
            </Text>
          ) : null}
        </Flex>
      </Stack>
    </Card>
  );
}
