# @mastrojs/atproto

Helper scripts to integrate with the Atmosphere. Currently for pushing [standard.site](https://standard.site/) records for your blog posts.

## Usage

Set up a new Mastro project (e.g. `pnpm create @mastrojs/mastro`) and select the blog template.

Then `pnpm add @mastrojs/atproto` and create a new file, e.g. `publishToAtmosphere.ts`, with this content:

```ts
import fs from "node:fs/promises";
import { createOrUpdateStandardSite, CredentialSession } from "@mastrojs/atproto";
import { readMarkdownFiles } from "@mastrojs/markdown";

const session = new CredentialSession(new URL("https://bsky.social"));
await session.login({
  identifier: "your.bsky.social",
  password: process.env.ATPROTO_PASSWORD, // from https://bsky.app/settings/app-passwords
});

const publication = {
  url: new URL("https://example.com/news/"),
  name: "Peter's News",
  description: "",
  icon: await fs.readFile("icon.png"), // Square image to identify the publication. Should be at least 256x256.
};

const posts = await readMarkdownFiles("data/posts/*.md");
const docs = posts.map((p) => ({
  title: p.meta.title!,
  publishedAt: p.meta.date!,
  path: p.path.slice(11, -3) + "/",
}));

createOrUpdateStandardSite(session, publication, docs);
```
