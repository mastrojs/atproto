import { assert, assertEquals, assertFalse } from "jsr:@std/assert";
import { comparePubs, type FetchedPublication, type PublicationWithRkey } from "./publication.ts";

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
  const { pubChanged, updatedPub } = comparePubs(oldPub(), newPub());
  assertFalse(pubChanged);
  assertEquals(updatedPub.icon, icon(100));
});

Deno.test("pubChanged: name changed", () => {
  const { pubChanged, updatedPub } = comparePubs(oldPub(), { ...newPub(), name: "New Name" });
  assert(pubChanged);
  assertEquals(updatedPub.icon, icon(100));
});

Deno.test("pubChanged: description changed", () => {
  const { pubChanged, updatedPub } = comparePubs(oldPub(), {
    ...newPub(),
    description: "New description",
  });
  assert(pubChanged);
  assertEquals(updatedPub.icon, icon(100));
});

Deno.test("pubChanged: icon same size — keeps existing BlobRef to skip re-upload", () => {
  const pub = { ...newPub(), icon: blob(100) };
  const { pubChanged, updatedPub } = comparePubs(oldPub(), pub);
  assertFalse(pubChanged);
  assertEquals(updatedPub.icon, icon(100));
});

Deno.test("pubChanged: name changed, icon stays", () => {
  const { pubChanged, updatedPub } = comparePubs(oldPub(), { ...newPub(), name: "New Name" });
  assert(pubChanged);
  assertEquals(updatedPub.icon, icon(100));
});

Deno.test("pubChanged: name changed, no icon stays", () => {
  const { pubChanged, updatedPub } = comparePubs({ ...oldPub(), icon: undefined }, {
    ...newPub(),
    name: "New Name",
    icon: undefined,
  });
  assert(pubChanged);
  assertEquals(updatedPub.icon, undefined);
});

Deno.test("pubChanged: icon size changed", () => {
  const newIcon = blob(200);
  const { pubChanged, updatedPub } = comparePubs(oldPub(), { ...newPub(), icon: newIcon });
  assert(pubChanged);
  assertEquals(updatedPub.icon, newIcon);
});

Deno.test("pubChanged: new icon added for upload", () => {
  const { pubChanged, updatedPub } = comparePubs({ ...oldPub(), icon: undefined }, newPub());
  assert(pubChanged);
  assertEquals(updatedPub.icon, blob(100));
});

Deno.test("pubChanged: icon removed", () => {
  const { pubChanged, updatedPub } = comparePubs(oldPub(), { ...newPub(), icon: undefined });
  assert(pubChanged);
  assertEquals(updatedPub.icon, undefined);
});

Deno.test("pubChanged: no icon in either publication", () => {
  const { pubChanged, updatedPub } = comparePubs({ ...oldPub(), icon: undefined }, {
    ...newPub(),
    icon: undefined,
  });
  assertFalse(pubChanged);
  assertEquals(updatedPub.icon, undefined);
});

Deno.test("pubChanged: theme color changed", () => {
  const pub = { ...newPub(), basicTheme: { ...theme(), background: { r: 128, g: 0, b: 0 } } };
  const { pubChanged, updatedPub } = comparePubs(oldPub(), pub);
  assert(pubChanged);
  assertEquals(updatedPub.icon, icon(100));
});

Deno.test("pubChanged: no theme in either publication", () => {
  const { pubChanged, updatedPub } = comparePubs({ ...oldPub(), basicTheme: undefined }, {
    ...newPub(),
    basicTheme: undefined,
  });
  assertFalse(pubChanged);
  assertEquals(updatedPub.icon, icon(100));
});

Deno.test("pubChanged: theme added", () => {
  const { pubChanged, updatedPub } = comparePubs({ ...oldPub(), basicTheme: undefined }, newPub());
  assert(pubChanged);
  assertEquals(updatedPub.icon, icon(100));
});

Deno.test("pubChanged: theme removed", () => {
  const { pubChanged, updatedPub } = comparePubs(oldPub(), { ...newPub(), basicTheme: undefined });
  assert(pubChanged);
  assertEquals(updatedPub.icon, icon(100));
});
