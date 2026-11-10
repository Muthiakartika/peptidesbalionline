/**
 * The media library: the pictures in the R2 bucket (newest folders first), searchable by file name.
 * WordPress's resized copies (photo-300x300.jpg…) are hidden unless "Show all sizes" is ticked.
 */
import { Box, Button, Card, Checkbox, Dialog, Flex, Grid, Spinner, Stack, Text, TextInput } from "@sanity/ui";
import { useEffect, useState } from "react";

import { mediaUrl } from "@/lib/media/url";

type Item = { key: string; url: string; size: number };
type Page = { items: Item[]; next: string | null; configured: boolean; error?: string };

export function MediaLibraryDialog({ auth, onClose, onPick }: { auth: Record<string, string> | null; onClose: () => void; onPick: (url: string) => void }) {
  const [query, setQuery] = useState("");
  const [allSizes, setAllSizes] = useState(false);
  const [page, setPage] = useState<Page | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async (cursor: string | null) => {
    if (!auth) {
      setPage({ items: [], next: null, configured: true, error: "Log out of the Studio and log in again (the library needs your login)." });
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, sizes: allSizes ? "1" : "0", ...(cursor ? { cursor } : {}) });
      const response = await fetch(`/api/media/list/?${params}`, { headers: auth });
      const result = (await response.json()) as Page;
      setPage(result);
      setItems((previous) => (cursor ? [...previous, ...result.items] : result.items));
    } catch (reason) {
      setPage({ items: [], next: null, configured: true, error: reason instanceof Error ? reason.message : String(reason) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => load(null), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, allSizes]);

  return (
    <Dialog id="media-library" header="Media library" width={4} onClose={onClose}>
      <Stack gap={4} padding={4}>
        <Flex gap={3} align="center">
          <Box flex={1}>
            <TextInput placeholder="Search by file name, e.g. bpc-157" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
          </Box>
          <Flex gap={2} align="center">
            <Checkbox id="all-sizes" checked={allSizes} onChange={() => setAllSizes(!allSizes)} />
            <Text size={1}>
              <label htmlFor="all-sizes">Show all sizes</label>
            </Text>
          </Flex>
        </Flex>
        {page && !page.configured && (
          <Card padding={3} tone="caution" radius={2}>
            <Text size={1}>The R2 bucket isn&apos;t connected yet (docs/setup/r2.md). You can still paste a picture address in the field.</Text>
          </Card>
        )}
        {page?.error && (
          <Card padding={3} tone="critical" radius={2}>
            <Text size={1}>{page.error}</Text>
          </Card>
        )}
        <Grid gridTemplateColumns={[2, 3, 5]} gap={3}>
          {items.map((item) => (
            <Card key={item.key} as="button" radius={2} padding={1} border style={{ cursor: "pointer", textAlign: "left" }} onClick={() => onPick(item.url)}>
              <Stack gap={2}>
                <Box style={{ height: 110, background: "#f3f3f3", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(item.url)} alt="" loading="lazy" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                </Box>
                <Text size={0} textOverflow="ellipsis" title={item.key}>
                  {item.key.split("/").pop()}
                </Text>
              </Stack>
            </Card>
          ))}
        </Grid>
        <Flex justify="center">
          {loading ? <Spinner /> : page?.next ? <Button text="Load more" mode="ghost" onClick={() => load(page.next)} /> : items.length ? null : page && <Text muted>No pictures found.</Text>}
        </Flex>
      </Stack>
    </Dialog>
  );
}
