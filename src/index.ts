import { Agent } from "@atproto/api";
import fs from "node:fs/promises";
import { dirname } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import { createOrUpdatePublication, type Publication, pubUriFromFile } from "./publication.ts";
import {
  createOrUpdateDocuments,
  type Document,
  normalizeRkey,
  validateAndAddRkey,
} from "./document.ts";

export { CredentialSession } from "@atproto/api";
export { type Document, rkeyFromPath } from "./document.ts";
export type { BasicTheme, Color, Publication } from "./publication.ts";

/**
 * If in an interactive terminal and project is not already set up, this does the setup.
 * If set up, it creates or updates the publication and the latest 100 documents in the Atmosphere.
 */
export const createOrUpdateStandardSite = async (
  session: ConstructorParameters<typeof Agent>[0],
  pub: Publication,
  docs: Document[],
  opts?: {
    /** Defaults to `routes`, but for other frameworks than Mastro may need to be set to `public` */
    baseFolder?: string;
  },
): Promise<void> => {
  const agent = new Agent(session);

  const { pathname } = pub.url;
  const pubRkey = pathname === "/" ? "self" : normalizeRkey(pathname);
  const wellKnown = `${opts?.baseFolder || "routes"}/.well-known/site.standard.publication${
    pathname === "/" ? "" : (pathname.endsWith("/") ? `${pathname}index.html` : pathname)
  }`;
  const publicationUri = await pubUriFromFile(wellKnown);

  docs.sort((a, b) => a.publishedAt < b.publishedAt ? 1 : -1);
  // limit to 100 until we implement pagination in fetchDocuments
  const newDocs = validateAndAddRkey(docs, pubRkey).slice(0, 100);

  const addLinkText = `
Don't forget to add the following link tag to your document detail pages using
import { rkeyFromPath } from "@mastrojs/atproto";
To verify you got it correct, use e.g. https://site-validator.fly.dev

<link rel="site.standard.document"
  href="at://${agent.did}/site.standard.document/\${rkeyFromPath(doc.path, "${pubRkey}")}">
`;

  if (!publicationUri) {
    if (!stdout.isTTY || process.env.CI) {
      console.error(
        `No publication URI found in ${wellKnown}. Run this script locally to set things up.`,
      );
      process.exit(1);
    }
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question(`
Detected the following documents:
${newDocs.map((d) => `URL: ${pub.url}${d.path}\n  -> rkey: ${d.rkey}`).join("\n")}

Open the URLs in your browser to make sure they're correct.
The derived rkeys are used to uniquely identify them in the Atmosphere.

Same for the publication URL:
${pub.url}

Are all the above URLs correct? (y/n -> Enter)
`);
    // TODO: use `process.stdin.setRawMode(true)` etc. to immediately detect keypress
    rl.close();
    stdin.destroy();
    if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
      await fs.mkdir(dirname(wellKnown), { recursive: true });
      await fs.writeFile(wellKnown, `at://${agent.did}/site.standard.publication/${pubRkey}`);
      console.clear();
      console.log(`
Successfully wrote ${wellKnown}
Add that file to your git repository.

Next time you run this script, it will publish things into the Atmosphere.
Either run this script manually whenver you have a new post,
or set up your CI/CD build step to run it automatically.

${addLinkText}
`);
    }
  } else {
    await createOrUpdatePublication(agent, { ...pub, rkey: pubRkey });
    await createOrUpdateDocuments(agent, publicationUri, newDocs);
    console.log("\ncreateOrUpdateStandardSite finished successfully.\n" + addLinkText);
  }
};
