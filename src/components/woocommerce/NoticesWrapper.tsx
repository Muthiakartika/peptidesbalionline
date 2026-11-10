/** WooCommerce's (empty) place for messages at the top of most of its pages. Its own file, so the
 * forms (client components) can use it without pulling in WooPage's server-only parts. */
export function NoticesWrapper() {
  return <div className="woocommerce-notices-wrapper" />;
}
