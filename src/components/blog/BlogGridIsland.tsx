/**
 * The Woodmart blog widget on /insights/ (an Elementor page): the newest posts in a grid of 3, and a
 * "Load more posts" button that adds the next ones (12 at a time on the live site, which fetches them
 * with AJAX; here they are already in the page and shown on click). The cards are the archive cards
 * without the category label and the "Posted by" row (the widget's options), from the blog data.
 */
import { getAllPosts, getCategoryById } from "@/lib/blog/data";

import { styleFromString } from "../elementor/ProductGridIsland";
import { BlogPostCard, type CardParts } from "./BlogPostCard";
import { LoadMorePosts } from "./LoadMorePosts";

export type BlogGridProps = { gridClass: string; gridStyle: string; perPage: number; parts: CardParts; loadMore: boolean };

export function BlogGridIsland({ gridClass, gridStyle, perPage, parts, loadMore, sharePath }: BlogGridProps & { sharePath: string }) {
  const posts = getAllPosts();
  const cards = posts.map((post) => (
    <BlogPostCard key={post.id} post={post} categories={post.categories.map((id) => getCategoryById(id)).filter((c) => c !== null)} sharePath={sharePath} parts={parts} />
  ));
  return (
    <div className="elementor-widget-container">
      <div className="wd-blog-element">
        <LoadMorePosts gridClass={gridClass} gridStyle={styleFromString(gridStyle)} perPage={perPage} loadMore={loadMore}>
          {cards}
        </LoadMorePosts>
      </div>
    </div>
  );
}
