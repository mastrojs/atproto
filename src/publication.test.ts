import { assert, assertEquals, assertFalse } from "jsr:@std/assert";
import { type FetchedPublication, pubChanged, type PublicationWithRkey } from "./publication.ts";

const icon = (size: number): any => ({
  size,
  $type: "blob",
  ref: { $link: "baf" },
  mimeType: "image/png",
});

const blob = (size: number) => ({ blob: Buffer.alloc(size), mimeType: "image/png" });

const theme = () => ({
  background: { r: 255, g: 255, b: 255 },
  foreground: { r: 0, g: 0, b: 0 },
  accent: { r: 0, g: 100, b: 200 },
  accentForeground: { r: 255, g: 255, b: 255 },
});

const oldPub = (): FetchedPublication => ({
  name: "My Blog",
  description: "A blog",
  icon: icon(100),
  basicTheme: theme(),
  preferences: { showInDiscover: true },
});

const newPub = (): PublicationWithRkey => ({
  url: new URL("https://example.com"),
  name: "My Blog",
  description: "A blog",
  rkey: "self",
  icon: blob(100),
  basicTheme: theme(),
});

Deno.test("pubChanged: identical publications", () => {
  assertFalse(pubChanged(oldPub(), newPub()));
});

Deno.test("pubChanged: name changed", () => {
  assert(pubChanged(oldPub(), { ...newPub(), name: "Other" }));
});

Deno.test("pubChanged: description changed", () => {
  assert(pubChanged(oldPub(), { ...newPub(), description: "New desc" }));
});

Deno.test("pubChanged: icon same size — deletes icon from pub to skip re-upload", () => {
  const pub = newPub();
  assertFalse(pubChanged(oldPub(), pub));
  assertEquals(pub.icon, undefined);
});

Deno.test("pubChanged: icon size changed", () => {
  assert(pubChanged(oldPub(), { ...newPub(), icon: blob(200) }));
});

Deno.test("pubChanged: icon added", () => {
  assert(pubChanged({ ...oldPub(), icon: undefined }, newPub()));
});

Deno.test("pubChanged: icon removed", () => {
  assert(pubChanged(oldPub(), { ...newPub(), icon: undefined }));
});

Deno.test("pubChanged: icon still not there", () => {
  assertFalse(pubChanged({ ...oldPub(), icon: undefined }, { ...newPub(), icon: undefined }));
});

Deno.test("pubChanged: theme color changed", () => {
  assert(pubChanged(oldPub(), {
    ...newPub(),
    basicTheme: { ...theme(), background: { r: 0, g: 0, b: 0 } },
  }));
});

Deno.test("pubChanged: no theme on either side", () => {
  assertFalse(pubChanged(
    { ...oldPub(), basicTheme: undefined },
    { ...newPub(), basicTheme: undefined },
  ));
});

Deno.test("pubChanged: theme added", () => {
  assert(pubChanged(
    { ...oldPub(), basicTheme: undefined },
    newPub(),
  ));
});

Deno.test("pubChanged: theme removed", () => {
  assert(pubChanged(
    oldPub(),
    { ...newPub(), basicTheme: undefined },
  ));
});
