/**
 * Text colour for the rich text editor: the site's own colours (Elementor kit globals and the colours
 * the copied pages use) as swatches, or any colour code. ColorAnnotation shows the coloured text in
 * the editor.
 */
import { Box, Button, Flex, Stack, Text, TextInput } from "@sanity/ui";
import { set, unset, type BlockAnnotationProps, type StringInputProps } from "sanity";

/** From src/styles/legacy/elementor-kit.css (--e-global-color-*) and the colours used in the pages. */
export const SITE_COLORS = [
  { name: "Gold", value: "#B79127" },
  { name: "Light gold", value: "#D1B157" },
  { name: "Dark gold", value: "#B07F1E" },
  { name: "Bronze", value: "#A56C1E" },
  { name: "Sand", value: "#CDA582" },
  { name: "Olive gold", value: "#A69037" },
  { name: "Black", value: "#000000" },
  { name: "Near black", value: "#0D0D0D" },
  { name: "Charcoal", value: "#202020" },
  { name: "Dark grey", value: "#2A2A2A" },
  { name: "Grey", value: "#383838" },
  { name: "Text grey", value: "#333333" },
  { name: "Cream", value: "#FEFDF9" },
  { name: "White", value: "#FFFFFF" },
];

export function ColorInput(props: StringInputProps) {
  const { value, onChange, elementProps } = props;
  return (
    <Stack gap={3}>
      <Flex gap={2} wrap="wrap">
        {SITE_COLORS.map((color) => (
          <Button
            key={color.value}
            mode={value?.toLowerCase() === color.value.toLowerCase() ? "default" : "ghost"}
            padding={2}
            title={`${color.name} ${color.value}`}
            onClick={() => onChange(set(color.value.toLowerCase()))}
          >
            <Flex align="center" gap={2}>
              <span style={{ width: 16, height: 16, borderRadius: 3, background: color.value, border: "1px solid rgba(0,0,0,.2)", display: "inline-block" }} />
              <Text size={1}>{color.name}</Text>
            </Flex>
          </Button>
        ))}
      </Flex>
      <Flex gap={2} align="center">
        <Box flex={1}>
          <TextInput {...elementProps} value={value ?? ""} placeholder="#b79127" onChange={(event) => onChange(event.currentTarget.value ? set(event.currentTarget.value) : unset())} />
        </Box>
        <span style={{ width: 28, height: 28, borderRadius: 4, background: value || "transparent", border: "1px solid rgba(0,0,0,.2)", display: "inline-block" }} />
      </Flex>
    </Stack>
  );
}

/** The annotated text, drawn in its colour inside the editor. */
export function ColorAnnotation(props: BlockAnnotationProps) {
  const color = (props.value as { color?: string } | undefined)?.color;
  return <span style={{ color }}>{props.renderDefault(props)}</span>;
}
