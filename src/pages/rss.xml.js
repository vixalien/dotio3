import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts";
import sanitizeHtml from "sanitize-html";
import MarkdownIt from "markdown-it";
const parser = new MarkdownIt();

export async function GET(context) {
  const posts = await getCollection("blog");
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    stylesheet: "/pretty-feed-v3.xsl",
    items: posts
      .toSorted((a, b) => b.data.publish_date - a.data.publish_date)
      .map((post) => ({
        title: post.data.title,
        description: post.data.description,
        author: post.data.author,
        categories: post.data.tags,
        pubDate: post.data.publish_date.toISOString(),
        // Note: this will not process components or JSX expressions in MDX files.
        content: sanitizeHtml(parser.render(post.body), {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
        }),
        link: `/blog/${post.id}/`,
      })),
  });
}
