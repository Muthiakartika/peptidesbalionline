/** "Original formatting" marks (copied from WordPress) are drawn like plain text: they only keep the
 * text looking as it did on the live site; editors don't need to notice them. */
import type { BlockAnnotationProps } from "sanity";

export function KeptFormatting(props: BlockAnnotationProps) {
  return <>{props.children}</>;
}
