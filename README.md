# @mastrojs/atproto

Helper scripts to integrate with the Atmosphere. Currently for pushing [standard.site](https://standard.site/) records for your blog posts.


## Install

If you haven't already, [set up a new Mastro project](https://mastrojs.github.io/#powerful-for-experienced-developers) and select the blog template. Then:

### Deno

    deno add jsr:@mastrojs/atproto

### Node.js

    pnpm add jsr:@mastrojs/atproto

### Bun

    bunx jsr add @mastrojs/atproto


## Usage

Then create a new file, e.g. `publishToAtmosphere.ts`, with this content and adjust with your settings:

```ts
import fs from "node:fs/promises";
import { createOrUpdateStandardSite, CredentialSession } from "@mastrojs/atproto";
import { readBlogFiles } from "../markdown.ts";

const identifier = "mastrojs.bsky.social";

const password = process.env.ATPROTO_PASSWORD;
if (!password) {
  console.error(`
No password found!

Get one from https://bsky.app/settings/app-passwords and locally run like:
ATPROTO_PASSWORD=xxxx-xxxx-xxxx-xxxx node publishToAtmosphere.ts
In your CI/CD pipeline, add it to its secret manager instead.
`);
  process.exit(1);
}

const publication = {
  url: new URL("https://example.com/news/"),
  name: "Peter's News",
  description: "",
  // Square image to identify the publication. Should be at least 256x256:
  icon: {
    blob: await fs.readFile("icon.png"),
    mimeType: "image/png",
  }
};

const posts = await readMarkdownFiles("data/posts/*.md");
const docs = posts.map((p) => ({
  title: p.meta.title!,
  publishedAt: new Date(p.meta.date!),
  // this path will be appended to publication.url to get the URL:
  path: p.path.slice("data/posts/".length, -3) + "/",
}));

const session = new CredentialSession(new URL("https://bsky.social"));
await session.login({ identifier, password });
createOrUpdateStandardSite(session, publication, docs);
```

Then run the script you just created with your password as an env variable:

### Deno

    ATPROTO_PASSWORD=xxxx-xxxx-xxxx-xxxx deno run -A publishToAtmosphere.ts

### Node.js

    ATPROTO_PASSWORD=xxxx-xxxx-xxxx-xxxx node publishToAtmosphere.ts

### Bun

    ATPROTO_PASSWORD=xxxx-xxxx-xxxx-xxxx bun publishToAtmosphere.ts

If you confirm to the script that the URLs and derived rkeys look good, it will create a file in `routes/.well-known/site.standard.publication` (The `routes` prefix is what may be `public` in other frameworks than Mastro – use the `opts` argument of [createOrUpdateStandardSite](https://jsr.io/@mastrojs/atproto/doc/~/createOrUpdateStandardSite) to customize.). After that, run it a second time to publish things to the Atmosphere.

You can use e.g. https://pdsls.dev to verify records on the PDS.

To see all functions `@mastrojs/atproto` exports, see its [API docs](https://jsr.io/@mastrojs/atproto/doc).
