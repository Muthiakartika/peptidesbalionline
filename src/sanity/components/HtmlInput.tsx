/** A monospace text area for HTML fields, with a warning that the HTML is shown as written. */
import { Stack, Text, TextArea } from "@sanity/ui";
import { set, unset, type StringInputProps } from "sanity";

export function HtmlInput(props: StringInputProps) {
  const { value, onChange, elementProps } = props;
  return (
    <Stack gap={2}>
      <TextArea
        {...elementProps}
        rows={Math.min(24, Math.max(4, (value ?? "").split("\n").length + 1))}
        value={value ?? ""}
        style={{ fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", fontSize: 12 }}
        onChange={(event) => onChange(event.currentTarget.value ? set(event.currentTarget.value) : unset())}
      />
      <Text size={1} muted>
        Shown on the site exactly as written. Scripts are removed.
      </Text>
    </Stack>
  );
}
