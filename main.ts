import { Agent } from "@atproto/api";
import fs from "node:fs/promises";
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
  icon?: Buffer;
}
type ExistingPublication = Publication & { rkey: string };

/**
 * https://standard.site/docs/lexicons/document/
 */
export interface Document {
  /**
   * Document title
   */
  title: string;
  /**
   * the path is appended to your publication url
   */
  path: string;
  /**
   * e.g. `2024-01-20T14:30:00.000Z`
   */
  publishedAt: string;
  description?: string;
  /**
   * Full plaintext of the article. No markdown."
   */
  textContent?: string;
  // tags?: string[];
}

type ExistingDocument = Document & { rkey: string };

const documentStringFields = [
  "title",
  "publishedAt",
  "description",
  "textContent",
] as const satisfies Array<keyof Document>;

const publicationStringFields = [
  "name",
  "description",
  // TODO: handle "icon",
] as const satisfies Array<keyof Publication>;

type Action = "createRecord" | "putRecord";

/**
 * Use this to construct the rkey we used to publish to the Atmosphere from your document's path.
 *
 * ```
 * <link rel="site.standard.document"
 *   href="at://${myDid}/site.standard.document/${pathToRkey(doc.path)}">
 * ```
 */
export const pathToRkey = (path: string) => path.replace(/[^a-zA-Z0-9._~-]/g, "").slice(0, 512);

/**
 * If in an interactive terminal and project is not already set up, this does the setup.
 * If set up, it creates or updates the publication and the latest 100 documents in the Atmosphere.
 */
export const createOrUpdateStandardSite = async (
  session: ConstructorParameters<typeof Agent>[0],
  pub: Publication,
  docs: Document[],
) => {
  const agent = new Agent(session);

  const { pathname } = pub.url;
  const wellKnown = "routes/.well-known/site.standard.publication" +
    (pathname === "/" ? "" : pathname);
  const publicationUri = await pubUriFromFile(wellKnown);

  // limit to 100 until we implement pagination in fetchDocuments
  docs = docs.sort((a, b) => a.publishedAt > b.publishedAt ? 1 : -1).slice(0, 100);
  for (const doc of docs) {
    // Basic validation in case people don't typecheck their YAML metadata.
    if (!doc.path) throw Error(`path not found for doc ${doc.title || JSON.stringify(doc)}`);
    if (!doc.title) throw Error(`title not found for doc ${doc.path}`);
    if (!doc.publishedAt) throw Error(`publishedAt not found for doc ${doc.path}`);
  }

  if (!publicationUri) {
    if (!stdout.isTTY || process.env.CI) {
      console.error(
        `No publication URI found in ${wellKnown}. Run this script locally to set things up.`,
      );
      process.exit(1);
    }
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question(`
Detected the following document URLs:
${docs.map((d) => pub.url + d.path).join("\n")}

Open the URLs in your browser to make sure they're correct.
We use them to uniquely identify your records in the Atmosphere.

Same for the publication URL:
${pub.url}

Are all the above URLs correct? (y/n -> Enter)
`);
    // TODO: use `process.stdin.setRawMode(true)` etc. to immediately detect keypress
    rl.close();
    stdin.destroy();
    if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
      const rkey = pathname === "/" ? "self" : pathToRkey(pub.url.pathname);
      await fs.writeFile(wellKnown, `at://${agent.did}/site.standard.publication/${rkey}`);
      console.log(`
Successfully wrote ${wellKnown}. Add that file to your git repository.

Next time you run this script, it will publish things into the Atmosphere.
Either run this script manually whenver you have a new post,
or set up your CI/CD build step to run it automatically.

Finally, don't forget to add the following snippet containing your DID
to your document detail pages (import { pathToRkey } from "@mastrojs/atproto")
<link rel="site.standard.document"
  href="at://${agent.did}/site.standard.document/\${pathToRkey(doc.path)}">
`);
    }
  } else {
    await createOrUpdatePublication(agent, pub);
    await createOrUpdateDocuments(agent, publicationUri, docs);
  }
};

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

const createOrUpdatePublication = async (agent: Agent, pub: Publication) => {
  const rkey = pub.url.pathname === "/" ? "self" : pub.url.pathname.replaceAll("/", "");
  const oldPub = await fetchPublication(agent, rkey);
  if (!oldPub) {
    await pushPublication(agent, "createRecord", pub);
  } else if (publicationStringFields.some((field) => oldPub[field] !== pub[field])) {
    await pushPublication(agent, "putRecord", { ...pub, rkey });
  }
};

const fetchPublication = async (agent: Agent, rkey: string) => {
  try {
    const pub = await agent.com.atproto.repo.getRecord({
      repo: agent.did!,
      collection: "site.standard.publication",
      rkey,
    });
    return pub.data.value as unknown as ExistingPublication;
  } catch (err) {
    if (err instanceof Error && err.message.includes("RecordNotFound")) {
      return;
    } else {
      throw err;
    }
  }
};

function pushPublication(
  agent: Agent,
  action: "createRecord",
  pub: Publication,
): ReturnType<typeof agent.com.atproto.repo.createRecord>;
function pushPublication(
  agent: Agent,
  action: "putRecord",
  pub: ExistingPublication,
): ReturnType<typeof agent.com.atproto.repo.putRecord>;
async function pushPublication(agent: Agent, action: Action, pub: Publication) {
  let icon;
  if (pub.icon) {
    const res = await agent.com.atproto.repo.uploadBlob(
      new Uint8Array(pub.icon),
      { encoding: "image/png" }, // TODO: detect extension
    );
    const { blob } = res.data;
    icon = {
      $type: "blob",
      ref: { $link: blob.ref.toString() },
      mimeType: blob.mimeType,
      size: blob.size,
    };
  }

  return await agent.com.atproto.repo[action]({
    repo: agent.did!,
    collection: "site.standard.publication",
    rkey: "self",
    record: {
      $type: "site.standard.publication",
      url: pub.url,
      name: pub.name,
      description: pub.description,
      icon,
      preferences: { showInDiscover: true },
    },
  });
}

const createOrUpdateDocuments = async (agent: Agent, publicationUri: string, docs: Document[]) => {
  const existingDocs: Record<string, ExistingDocument> = {};
  for (const doc of await fetchDocuments(agent, publicationUri)) {
    // we use the path (which may contain slashes etc.) to identify records
    // TODO: maybe we should use rkey and check for collisions withhin the new documents
    existingDocs[doc.path] = doc;
  }
  for (const newDoc of docs) {
    const oldDoc = existingDocs[newDoc.path];
    if (!oldDoc) {
      const rkey = pathToRkey(newDoc.path);
      await pushDocument(agent, publicationUri, "createRecord", { ...newDoc, rkey });
    } else if (documentStringFields.some((field) => oldDoc[field] !== newDoc[field])) {
      await pushDocument(agent, publicationUri, "putRecord", { ...newDoc, rkey: oldDoc.rkey });
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
    .map((r) => ({ ...r.value, rkey: r.uri.split("/").pop() } as ExistingDocument));
};

const pushDocument = (
  agent: Agent,
  publicationUri: string,
  action: Action,
  doc: ExistingDocument,
) => {
  return agent.com.atproto.repo[action]({
    repo: agent.did!,
    collection: "site.standard.document",
    rkey: (doc as ExistingDocument).rkey,
    record: {
      $type: "site.standard.document",
      site: publicationUri,
      title: doc.title,
      publishedAt: doc.publishedAt,
      path: doc.path,
      description: doc.description,
      textContent: doc.textContent,
      // tags: doc.tags,
      // Optional: link back to a Bluesky post for comments
      // bskyPostRef: { uri: "at://mastrojs.bsky.social/app.bsky.feed.post/3mmrn4yif6s2c", cid: "..." },
    },
  });
};
