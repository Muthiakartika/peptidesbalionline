/**
 * Types for `import Swiper, { A11y, Autoplay, Pagination } from "swiper"` (Swiper 8.4.5, the version
 * the live site runs). Swiper 8 ships its types, but its package.json "exports" doesn't point
 * TypeScript at them, so this file does (they're borrowed from "swiper/types", which it does export).
 */
declare module "swiper" {
  import { Swiper, type SwiperModule } from "swiper/types";

  export default Swiper;
  export const A11y: SwiperModule;
  export const Autoplay: SwiperModule;
  export const Pagination: SwiperModule;
}
