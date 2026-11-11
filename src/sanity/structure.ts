import type { StructureResolver } from "sanity/structure";

import { FAMILIES } from "./schemas/documents/page";

/** The left-hand menu in Sanity Studio, grouped like the WordPress admin menu. */
export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      S.listItem().title("Site settings").id("siteSettings").child(S.document().schemaType("siteSettings").documentId("siteSettings")),
      S.divider(),
      S.listItem()
        .title("Pages")
        .id("pages")
        .child(
          S.list()
            .title("Pages")
            .items([
              // The tool pages (/calculator/; /protocol-builder/ isn't in Sanity at all) are fixed in
              // code, so they are left out here (see FIXED_PAGES in src/lib/elementor/pages.ts).
              S.listItem()
                .title("All pages")
                .id("all-pages")
                .child(
                  S.documentTypeList("page")
                    .title("All pages")
                    .filter('_type == "page" && family != "tools"')
                    .defaultOrdering([{ field: "path", direction: "asc" }]),
                ),
              S.divider(),
              ...FAMILIES.map((family) =>
                S.listItem()
                  .title(family.title)
                  .id(`pages-${family.value}`)
                  .child(
                    S.documentTypeList("page")
                      .title(family.title)
                      .filter('_type == "page" && family == $family')
                      .params({ family: family.value })
                      .defaultOrdering([{ field: "path", direction: "asc" }]),
                  ),
              ),
            ]),
        ),
      S.documentTypeListItem("sharedSection").title("Shared sections"),
      S.documentTypeListItem("popup").title("Popups"),
      S.divider(),
      S.documentTypeListItem("product").title("Products"),
      S.documentTypeListItem("productCategory").title("Product categories"),
      S.documentTypeListItem("productAttribute").title("Product attributes"),
      S.divider(),
      S.documentTypeListItem("post").title("Blog posts"),
      S.documentTypeListItem("blogCategory").title("Blog categories"),
      S.documentTypeListItem("author").title("Blog authors"),
    ]);
