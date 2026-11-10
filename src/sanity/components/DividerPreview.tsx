/** A divider line in rich text is drawn as a line in the editor too, not as its HTML (<hr>). */
import { Box, Flex, Text } from "@sanity/ui";
export function DividerPreview() {
  return (
    <Flex align="center" gap={3} paddingX={3} paddingY={3}>
      <Box flex={1} style={{ borderTop: "1px solid var(--card-border-color, #ccc)" }} />
      <Text size={1} muted>
        Divider line
      </Text>
      <Box flex={1} style={{ borderTop: "1px solid var(--card-border-color, #ccc)" }} />
    </Flex>
  );
}
