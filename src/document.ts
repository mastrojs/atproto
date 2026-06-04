import type { Agent } from "@atproto/api";

export type Action = "createRecord" | "putRecord";

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

/**
 * Use this to reconstruct the rkey that was used to publish this document to the Atmosphere.
 * Pass in the same `path` that your document had when you called `createOrUpdateDocuments`.
 *
 * If your blog doesn't live on the homepage of the domain, the optional second argument
 * should be `publication.url.pathname` (e.g. `/blog/`). It defaults to `self`.
 *
 * ```
 * <link rel="site.standard.document"
 *   href="at://${myDid}/site.standard.document/${rkeyFromPath(doc.path, pub.url.pathname)}">
 * ```
 */
export const rkeyFromPath = (path: string, prefix = "self"): string =>
  normalizeRkey(`${prefix === "/" ? "self" : prefix}-${path}`);

export const normalizeRkey = (path: string) => path.replace(/[^a-zA-Z0-9._~-]/g, "").slice(0, 512);

export const validateAndAddRkey = (docs: Document[], rkeyPrefix: string) => {
  const usedRKeys: Record<string, boolean> = {};
  for (const doc of docs) {
    // Basic validation in case people don't typecheck their YAML metadata.
    if (!doc.path) throw Error(`path not found for doc ${doc.title || JSON.stringify(doc)}`);
    if (!normalizeRkey(doc.path)) throw Error(`Couldn't construct rkey for doc ${doc.path}`);
    if (!doc.title) throw Error(`title not found for doc ${doc.path}`);
    if (!doc.publishedAt) throw Error(`publishedAt not found for doc ${doc.path}`);
    const rkey = rkeyFromPath(doc.path, rkeyPrefix);
    if (usedRKeys[rkey]) throw Error(`rkey ${rkey} was already used by another document`);
    usedRKeys[rkey] = true;
    (doc as DocumentWithRkey).rkey = rkey;
  }
  return docs as DocumentWithRkey[];
};

export const createOrUpdateDocuments = async (
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
