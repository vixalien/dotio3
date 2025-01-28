import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
	// Type-check frontmatter using a schema
	schema: z.object({
		title: z.coerce.string(),
		description: z.string(),
		// Transform string to Date object
		publish_date: z.coerce.date(),
		updated_date: z.coerce.date().optional(),
		hero_image: z.string().optional(),
		invert: z.boolean().default(false),
		tags: z.array(z.string()).default([]),
	}),
});

const portfolio = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: "./src/content/portfolio", pattern: "**/*.{md,mdx}" }),
	// Type-check frontmatter using a schema
	schema: z.object({
		title: z.coerce.string(),
		description: z.string(),
		hero_image: z.string().optional(),
		invert: z.boolean().default(false),
		bg_color: z.string().optional(),
		link: z.string(),
	}),
});

export const collections = { blog, portfolio };
