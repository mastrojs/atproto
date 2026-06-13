# @mastrojs/atproto

Helper scripts to integrate with the [Atmosphere](https://atproto.com).

Create and update [standard.site](https://standard.site/) records from your existing website without the headache. No need to store [rkeys](https://atproto.com/specs/record-key) in your YAML frontmatter or database. Instead, we derive them from the URL paths of your existing website. For more info, see [our blog post](https://mastrojs.github.io/blog/2026-06-05-how-to-add-standard-site-support-to-your-website/).


## How?

The easiest way to get started, is to [set up a new Mastro project](https://mastrojs.github.io/#powerful-for-experienced-developers) and select the blog template.

But you can use this library with any stack that allows you to get your blog posts into a JavaScript variable. Simply call `createOrUpdateStandardSite(session, publication, docs)` whenever your blog posts changed – e.g. for a statically generated site, on each deploy.


## Install

### Deno

    deno add jsr:@mastrojs/atproto

### Node.js

    pnpm add jsr:@mastrojs/atproto

### Bun

    bunx jsr add @mastrojs/atproto


## Usage

Create a new file, e.g. `publishToAtmosphere.ts`, with the following content and adjust with your settings:

```ts
import fs from "node:fs/promises";
import { readMarkdownFiles } from "@mastrojs/markdown";
import {
  createOrUpdateStandardSite,
  CredentialSession,
  type Publication,
} from "@mastrojs/atproto";

const identifier = "your.bsky.social";
const password = process.env.ATPROTO_PASSWORD;
const pubUrl = new URL("https://example.com/news/");

const publication: Publication = {
  url: pubUrl,
  name: "Peter's News",
  description: "",
  // Optional square image for the publication, should be at least 256x256:
  icon: {
    blob: await fs.readFile("icon.png"),
    mimeType: "image/png",
  },
  // Optional RGB colors, make sure you have enough contrast:
  basicTheme: {
    background: { r: 255, g: 255, b: 255 },
    foreground: { r: 23, g: 24, b: 28 },
    accent: { r: 0, g: 0, b: 0 }, // button color
    accentForeground: { r: 255, g: 255, b: 255 }, // button text
  },
};

const posts = await readMarkdownFiles("data/posts/*.md");
const docs = posts.map((p) => ({
  title: p.meta.title!,
  publishedAt: new Date(p.meta.date!),
  // `readMarkdownFiles` returns file names under p.path
  // slice off "data/posts/" from the start, and ".md" from the end:
  url: new URL(p.path.slice("data/posts/".length, -3) + "/", pubUrl),
}));

await createOrUpdateStandardSite({ identifier, password }, publication, docs);
```

Then run the above script with your password as an env variable:

### Deno

    ATPROTO_PASSWORD=xxxx-xxxx-xxxx-xxxx deno run -A publishToAtmosphere.ts

### Node.js

    ATPROTO_PASSWORD=xxxx-xxxx-xxxx-xxxx node publishToAtmosphere.ts

### Bun

    ATPROTO_PASSWORD=xxxx-xxxx-xxxx-xxxx bun publishToAtmosphere.ts

If you confirm to the script that everything looks good, it will create a publication in the Atmosphere, and write a file to `routes/.well-known/site.standard.publication` (The `routes` prefix is what may be `public` in other frameworks than Mastro – use the `opts` argument of [createOrUpdateStandardSite](https://jsr.io/@mastrojs/atproto/doc/~/createOrUpdateStandardSite) to customize).

After that, run it a second time to publish your documents to the Atmosphere. Optionally, you can then set up your CI/CD pipeline to run the script on each deploy.

Don't forget to add the following link tag to your document detail pages using
`import { rkeyFromUrl } from "@mastrojs/atproto";`

```js
<link rel="site.standard.document"
  href={`at://${agent.did}/site.standard.document/${rkeyFromUrl(doc.url)}`}>
```

You can use e.g. https://site-validator.fly.dev or [pdsls.dev](https://pdsls.dev) to verify [standard.site](https://standard.site/) records on the PDS. To browse and edit records manually, use [Taproot](https://atproto.at).

To see all functions `@mastrojs/atproto` exports, see its [API docs](https://jsr.io/@mastrojs/atproto/doc).


## Contribute

This project is happy to accept bug reports and/or contributions! Just open a GitHub issue or talk to us on [Bluesky](https://bsky.app/profile/mastrojs.bsky.social)
