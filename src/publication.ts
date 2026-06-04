import type { Agent, BlobRef } from "@atproto/api";
import fs from "node:fs/promises";

import type { Action } from "./document.ts";

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
  basicTheme?: BasicTheme;
}

export type PublicationWithRkey = Publication & { rkey: string };

export interface FetchedPublication {
  name: string;
  description: string;
  icon?: BlobRef;
  basicTheme?: BasicTheme;
  preferences: { showInDiscover: boolean };
}

/**
 * https://standard.site/docs/lexicons/theme/
 */
export interface BasicTheme {
  /** Color used for content background */
  background: Color;
  /** Color used for content text */
  foreground: Color;
  /** Color used for links and button backgrounds */
  accent: Color;
  /** Color used for button text */
  accentForeground: Color;
}

/**
 * RGB Color
 */
export type Color = { r: number; g: number; b: number };

const themeKeys = [
  "background",
  "foreground",
  "accent",
  "accentForeground",
] as const satisfies Array<keyof BasicTheme>;

export const pubUriFromFile = async (wellKnownFilePath: string) => {
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

export const createOrUpdatePublication = async (agent: Agent, pub: PublicationWithRkey) => {
  const oldPub = await fetchPublication(agent, pub.rkey);
  if (!oldPub) {
    await pushPublication(agent, "createRecord", pub);
  } else if (pubChanged(oldPub, pub)) {
    await pushPublication(agent, "putRecord", pub);
  }
};

export const pubChanged = (oldPub: FetchedPublication, pub: PublicationWithRkey): boolean => {
  const iconChanged =
    oldPub.icon?.size !== (pub.icon ? Buffer.byteLength(pub.icon.blob) : undefined);
  if (!iconChanged) {
    // don't upload a new blob but potentially still update the other fields
    delete pub.icon;
  }
  const oldTheme = oldPub.basicTheme;
  const newTheme = pub.basicTheme;
  const themeChanged = themeKeys.some((key) =>
    oldTheme?.[key].r !== newTheme?.[key].r ||
    oldTheme?.[key].g !== newTheme?.[key].g ||
    oldTheme?.[key].b !== newTheme?.[key].b
  );
  return iconChanged || themeChanged || oldPub.name !== pub.name ||
    oldPub.description !== pub.description;
};

const fetchPublication = async (agent: Agent, rkey: string) => {
  try {
    const pub = await agent.com.atproto.repo.getRecord({
      repo: agent.did!,
      collection: "site.standard.publication",
      rkey,
    });
    return pub.data.value as unknown as FetchedPublication;
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
    console.log("Uploaded new icon");
    const { blob } = res.data;
    icon = {
      $type: "blob",
      ref: { $link: blob.ref.toString() },
      mimeType: blob.mimeType,
      size: blob.size,
    };
  }

  const theme = pub.basicTheme;
  const basicTheme = theme
    ? {
      "$type": "site.standard.theme.basic",
      ...Object.fromEntries(
        themeKeys.map((key) => [key, { ...theme[key], $type: "site.standard.theme.color#rgb" }]),
      ),
    }
    : undefined;

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
      basicTheme,
      preferences: { showInDiscover: true },
    },
  });
  console.log(`${action === "createRecord" ? "Created" : "Updated"} publication ${res.data.uri}`);
  return res;
};
