import { Agent, type BlobRef } from "@atproto/api";
import fs from "node:fs/promises";
import { dirname } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

export { CredentialSession } from "@atproto/api";

/**
 * https://standard.site/docs/lexicons/publication/
 */
export interface Publication {
  url: URL;
  name: string;
  description?: string;
  icon?: {
    blob: Buffer;
    mimeType: string;
  };
}
type PublicationWithRkey = Publication & { rkey: string };

/**
 * https://standard.site/docs/lexicons/document/
 */
interface Document {
  /**
   * Document title
   */
  title: string;
  /**
   * the path is appended to your publication url
   */
  path: string;
  publishedAt: Date;
  description?: string;
  /**
   * Full plaintext of the article. No markdown."
   */
  textContent?: string;
  // tags?: string[];
}

type DocumentWithRkey = Document & { rkey: string };

const documentStringFields = [
  "title",
  "description",
  "textContent",
] as const satisfies Array<keyof Document>;

const publicationStringFields = [
  "name",
  "description",
] as const satisfies Array<keyof Publication>;

type Action = "createRecord" | "putRecord";

/**
 * Use this to construct the rkey we used to publish to the Atmosphere from your document's path.
 *
 * ```
 * <link rel="site.standard.document"
 *   href="at://${myDid}/site.standard.document/${pubPath || "self"}-${rkeyFromPath(doc.path)}">
 * ```
 */
export const rkeyFromPath = (path: string): string =>
  path.replace(/[^a-zA-Z0-9._~-]/g, "").slice(0, 512);

/**
 * If in an interactive terminal and project is not already set up, this does the setup.
 * If set up, it creates or updates the publication and the latest 100 documents in the Atmosphere.
 */
export const createOrUpdateStandardSite = async (
  session: ConstructorParameters<typeof Agent>[0],
  pub: Publication,
  docs: Document[],
  opts?: { baseFolder?: string },
): Promise<void> => {
  const agent = new Agent(session);

  const { pathname } = pub.url;
  const pubRkey = pathname === "/" ? "self" : rkeyFromPath(pathname);
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
To verify you got it correct, search the at-URI on https://pdsls.dev

<link rel="site.standard.document"
  href="at://${agent.did}/site.standard.document/${pubRkey}-\${rkeyFromPath(doc.path)}">
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

/**
 * Publication helpers
 */

const pubUriFromFile = async (wellKnownFilePath: string) => {
  try {
    const pubUri = await fs.readFile(wellKnownFilePath, { encoding: "utf8" });
    if (!pubUri.startsWith("at://")) {
      throw Error(`publicationUri must be an at:// protocol URI, was ${pubUri}`);
    }
    return pubUri;
  } catch (e: any) {
    if (e.code !== "ENOENT") {
      throw e;
    }
  }
};

const createOrUpdatePublication = async (agent: Agent, pub: PublicationWithRkey) => {
  const oldPub = await fetchPublication(agent, pub.rkey);
  if (!oldPub) {
    await pushPublication(agent, "createRecord", pub);
  } else if (publicationStringFields.some((field) => oldPub[field] !== pub[field])) {
    if (oldPub.icon && pub.icon && oldPub.icon.size === Buffer.byteLength(pub.icon.blob)) {
      // don't upload a new blob if the icon still has the same size (probably not changed)
      delete pub.icon;
    }
    await pushPublication(agent, "putRecord", pub);
  }
};

const fetchPublication = async (agent: Agent, rkey: string) => {
  try {
    const pub = await agent.com.atproto.repo.getRecord({
      repo: agent.did!,
      collection: "site.standard.publication",
      rkey,
    });
    return pub.data.value as {
      name: string;
      description: string;
      icon?: BlobRef;
      preferences: { showInDiscover: boolean };
    };
  } catch (e: any) {
    if (e.error === "RecordNotFound") {
      return;
    } else {
      throw e;
    }
  }
};

const pushPublication = async (agent: Agent, action: Action, pub: PublicationWithRkey) => {
  let icon;
  if (pub.icon) {
    const res = await agent.com.atproto.repo.uploadBlob(
      new Uint8Array(pub.icon.blob),
      { encoding: pub.icon.mimeType },
    );
    const { blob } = res.data;
    icon = {
      $type: "blob",
      ref: { $link: blob.ref.toString() },
      mimeType: blob.mimeType,
      size: blob.size,
    };
  }

  const res = await agent.com.atproto.repo[action]({
    repo: agent.did!,
    collection: "site.standard.publication",
    rkey: pub.rkey,
    record: {
      $type: "site.standard.publication",
      url: pub.url.toString(),
      name: pub.name,
      description: pub.description,
      icon,
      preferences: { showInDiscover: true },
    },
  });
  console.log(`${action === "createRecord" ? "Created" : "Updated"} publication ${res.data.uri}`);
  return res;
};

/**
 * Document helpers
 */

const validateAndAddRkey = (docs: Document[], rkeyPrefix: string) => {
  const usedRKeys: Record<string, boolean> = {};
  for (const doc of docs) {
    // Basic validation in case people don't typecheck their YAML metadata.
    if (!doc.path) throw Error(`path not found for doc ${doc.title || JSON.stringify(doc)}`);
    if (!doc.title) throw Error(`title not found for doc ${doc.path}`);
    if (!doc.publishedAt) throw Error(`publishedAt not found for doc ${doc.path}`);
    let rkey = rkeyFromPath(doc.path);
    if (!rkey) throw Error(`Couldn't construct rkey for doc ${doc.path}`);
    rkey = `${rkeyPrefix}-${rkey}`;
    if (usedRKeys[rkey]) throw Error(`rkey ${rkey} was already used by another document`);
    usedRKeys[rkey] = true;
    (doc as DocumentWithRkey).rkey = rkey;
  }
  return docs as DocumentWithRkey[];
};

const createOrUpdateDocuments = async (
  agent: Agent,
  publicationUri: string,
  docs: DocumentWithRkey[],
) => {
  const existingDocs: Record<string, Record<string, string>> = {};
  for (const oldDoc of await fetchDocuments(agent, publicationUri)) {
    existingDocs[oldDoc.rkey] = oldDoc;
  }
  for (const newDoc of docs) {
    const oldDoc = existingDocs[newDoc.rkey];
    if (!oldDoc) {
      await pushDocument(agent, publicationUri, "createRecord", newDoc);
    } else if (
      documentStringFields.some((field) =>
        oldDoc[field] !== newDoc[field] || oldDoc.publishedAt !== newDoc.publishedAt.toISOString()
      )
    ) {
      await pushDocument(agent, publicationUri, "putRecord", newDoc);
    }
  }
};

const fetchDocuments = async (agent: Agent, publicationUri: string) => {
  const docs = await agent.com.atproto.repo.listRecords({
    repo: agent.did!,
    collection: "site.standard.document",
    limit: 100,
  });
  return docs.data.records
    .filter((r) => r.value.site === publicationUri)
    .map((r) => ({ ...r.value, rkey: r.uri.split("/").pop() as string }));
};

const pushDocument = async (
  agent: Agent,
  publicationUri: string,
  action: Action,
  doc: DocumentWithRkey,
) => {
  const res = await agent.com.atproto.repo[action]({
    repo: agent.did!,
    collection: "site.standard.document",
    rkey: doc.rkey,
    record: {
      $type: "site.standard.document",
      site: publicationUri,
      title: doc.title,
      publishedAt: doc.publishedAt.toISOString(),
      path: doc.path,
      description: doc.description,
      textContent: doc.textContent,
      // tags: doc.tags,
      // Optional: link back to a Bluesky post for comments
      // bskyPostRef: { uri: "at://mastrojs.bsky.social/app.bsky.feed.post/3mmrn4yif6s2c", cid: "..." },
    },
  });
  console.log(`${action === "createRecord" ? "Created" : "Updated"} document ${res.data.uri}`);
  return res;
};
