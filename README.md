# @mastrojs/atproto

Helper scripts to integrate with the [Atmosphere](https://atproto.com).

Create and update [standard.site](https://standard.site/) records from your existing website without the headache. No need to store [rkeys](https://atproto.com/specs/record-key) in your YAML frontmatter or database. Instead, we derive them from the URL paths of your existing website. For more info, see [our blog post](https://mastrojs.github.io/blog/2026-06-05-how-to-add-standard-site-support-to-your-website/).

**Disclaimer**: While our approach works on Bluesky, note that the Standard.site schema apparently says the rkeys should be of type `TID`. There is an [ongoing discussion](https://tangled.org/standard.site/lexicons/issues/7#comment-3mnm5xd5prb22) whether this can be relaxed to type `any`.


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
if (!password) {
  console.error(`
No password found!

Get one from https://bsky.app/settings/app-passwords and run locally with:
ATPROTO_PASSWORD=xxxx-xxxx-xxxx-xxxx node publishToAtmosphere.ts
In a CI/CD pipeline, add the password to your secret manager instead.
`);
  process.exit(1);
}

const publication: Publication = {
  url: new URL("https://example.com/news/"),
  name: "Peter's News",
  description: "",
  // Optional square image for the publication, should be at least 256x256:
  icon: {
    blob: await fs.readFile("icon.png"),
    mimeType: "image/png",
  },
  // Optional RGB colors:
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
  // this path will be appended to publication.url to get the full URL:
  path: p.path.slice("data/posts/".length, -3) + "/",
}));

const session = new CredentialSession(new URL("https://bsky.social"));
await session.login({ identifier, password });

await createOrUpdateStandardSite(session, publication, docs);
```

Then run the above script with your password as an env variable:

### Deno

    ATPROTO_PASSWORD=xxxx-xxxx-xxxx-xxxx deno run -A publishToAtmosphere.ts

### Node.js

    ATPROTO_PASSWORD=xxxx-xxxx-xxxx-xxxx node publishToAtmosphere.ts

### Bun

    ATPROTO_PASSWORD=xxxx-xxxx-xxxx-xxxx bun publishToAtmosphere.ts

If you confirm to the script that the URLs and derived rkeys look good, it will create a file in `routes/.well-known/site.standard.publication` (The `routes` prefix is what may be `public` in other frameworks than Mastro – use the `opts` argument of [createOrUpdateStandardSite](https://jsr.io/@mastrojs/atproto/doc/~/createOrUpdateStandardSite) to customize).

After that, run it a second time to publish things to the Atmosphere. Optionally, you can then set up your CI/CD pipeline to run the script on each deploy.

Don't forget to add the following link tag to your document detail pages using
`import { rkeyFromPath } from "@mastrojs/atproto";`

```js
<link rel="site.standard.document"
  href={`at://${agent.did}/site.standard.document/${rkeyFromPath(doc.path)}`}>
```

You can use e.g. https://site-validator.fly.dev to verify [standard.site](https://standard.site/) records on the PDS.

To see all functions `@mastrojs/atproto` exports, see its [API docs](https://jsr.io/@mastrojs/atproto/doc).


## Contribute

This project is happy to accept bug reports and/or contributions! To debug things, https://pdsls.dev can be helpful.
