/**
 * The picture field: shows the picture, "Upload" (sends the file to the R2 bucket through
 * /api/media/upload), "Media library" (pick a picture already in the bucket) and "Remove"; below,
 * the address and alt text. The upload is allowed with the editor's own Sanity login (the route checks
 * it with Sanity), so no key is needed in the browser.
 */
import { Box, Button, Card, Flex, Stack, Text } from "@sanity/ui";
import { useRef, useState } from "react";
import { set, unset, useClient, type ObjectInputProps } from "sanity";

import { mediaUrl } from "@/lib/media/url";

import { MediaLibraryDialog } from "./MediaLibraryDialog";

type Value = { _type?: string; url?: string; alt?: string; width?: number; height?: number };

export function useMediaAuth() {
  const client = useClient({ apiVersion: "2026-11-01" });
  const token = client.config().token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

/** A picture's size, measured in the browser (for pictures picked from the library). */
function measure(url: string): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({});
    img.src = url;
  });
}

export function R2ImageInput(props: ObjectInputProps<Value>) {
  const { value, onChange, renderDefault, readOnly } = props;
  const auth = useMediaAuth();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [library, setLibrary] = useState(false);

  const choose = (picked: { url: string; width?: number; height?: number }) => {
    onChange(set({ ...value, _type: "r2Image", url: picked.url, width: picked.width, height: picked.height, alt: value?.alt ?? "" }));
  };

  const upload = async (picked: File) => {
    if (!auth) {
      setError("Log out of the Studio and log in again (the upload needs your login).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", picked);
      const response = await fetch("/api/media/upload/", { method: "POST", headers: auth, body });
      const result = (await response.json()) as { url?: string; width?: number; height?: number; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? `Upload failed (${response.status})`);
      choose({ url: result.url, width: result.width, height: result.height });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  };

  const shown = mediaUrl(value?.url);
  return (
    <Stack gap={3}>
      <Card border radius={2} padding={2} tone="transparent">
        <Flex gap={3} align="center">
          <Box style={{ width: 120, height: 90, flex: "none", background: "#f3f3f3", borderRadius: 4, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt={value?.alt ?? ""} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            ) : (
              <Text size={1} muted>
                No picture
              </Text>
            )}
          </Box>
          <Stack gap={2} flex={1}>
            <Flex gap={2} wrap="wrap">
              <Button text={busy ? "Uploading…" : "Upload"} mode="ghost" disabled={readOnly || busy} onClick={() => file.current?.click()} />
              <Button text="Media library" mode="ghost" disabled={readOnly || busy} onClick={() => setLibrary(true)} />
              {value?.url && <Button text="Remove" mode="bleed" tone="critical" disabled={readOnly || busy} onClick={() => onChange(unset())} />}
            </Flex>
            {value?.width && value?.height ? (
              <Text size={1} muted>
                {value.width} × {value.height} px
              </Text>
            ) : null}
            {error && (
              <Text size={1} style={{ color: "#c0392b" }}>
                {error}
              </Text>
            )}
          </Stack>
        </Flex>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} />
      </Card>
      {renderDefault(props)}
      {library && (
        <MediaLibraryDialog
          auth={auth}
          onClose={() => setLibrary(false)}
          onPick={async (url) => {
            setLibrary(false);
            choose({ url, ...(await measure(mediaUrl(url))) });
          }}
        />
      )}
    </Stack>
  );
}
