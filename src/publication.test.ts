import { assertEquals } from "jsr:@std/assert";
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
  url: "https://example.com",
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

Deno.test("comparePubs: identical publications", () => {
  const changedPub = comparePubs(oldPub(), newPub());
  assertEquals(changedPub, undefined);
});

Deno.test("comparePubs: name changed", () => {
  const name = "New Name";
  const changedPub = comparePubs(oldPub(), { ...newPub(), name });
  assertEquals(changedPub?.name, name);
  assertEquals(changedPub?.icon, icon(100));
});

Deno.test("comparePubs: description changed", () => {
  const description = "New description";
  const changedPub = comparePubs(oldPub(), { ...newPub(), description });
  assertEquals(changedPub?.description, description);
  assertEquals(changedPub?.icon, icon(100));
});

Deno.test("comparePubs: icon same size, nothing else changed", () => {
  const pub = { ...newPub(), icon: blob(100) };
  const changedPub = comparePubs(oldPub(), pub);
  assertEquals(changedPub, undefined);
});

Deno.test("comparePubs: name changed, no icon stays", () => {
  const pub = {
    ...newPub(),
    name: "New Name",
    icon: undefined,
  };
  const changedPub = comparePubs({ ...oldPub(), icon: undefined }, pub);
  assertEquals(changedPub, pub);
});

Deno.test("comparePubs: icon size changed", () => {
  const newIcon = blob(200);
  const changedPub = comparePubs(oldPub(), { ...newPub(), icon: newIcon });
  assertEquals(changedPub?.icon, newIcon);
});

Deno.test("comparePubs: new icon added for upload", () => {
  const pub = newPub();
  const changedPub = comparePubs({ ...oldPub(), icon: undefined }, pub);
  assertEquals(changedPub, pub);
});

Deno.test("comparePubs: icon removed", () => {
  const changedPub = comparePubs(oldPub(), { ...newPub(), icon: undefined });
  assertEquals(changedPub?.icon, undefined);
});

Deno.test("comparePubs: no icon in either publication", () => {
  const changedPub = comparePubs({ ...oldPub(), icon: undefined }, {
    ...newPub(),
    icon: undefined,
  });
  assertEquals(changedPub, undefined);
});

Deno.test("comparePubs: theme color changed", () => {
  const background = { r: 128, g: 0, b: 0 };
  const pub = { ...newPub(), basicTheme: { ...theme(), background } };
  const changedPub = comparePubs(oldPub(), pub);
  assertEquals(changedPub?.basicTheme?.background, background);
  assertEquals(changedPub?.icon, icon(100));
});

Deno.test("comparePubs: no theme in either publication", () => {
  const changedPub = comparePubs({ ...oldPub(), basicTheme: undefined }, {
    ...newPub(),
    basicTheme: undefined,
  });
  assertEquals(changedPub, undefined);
});

Deno.test("comparePubs: theme added", () => {
  const changedPub = comparePubs({ ...oldPub(), basicTheme: undefined }, newPub());
  assertEquals(changedPub?.basicTheme, theme());
  assertEquals(changedPub?.icon, icon(100));
});

Deno.test("comparePubs: theme removed", () => {
  const changedPub = comparePubs(oldPub(), { ...newPub(), basicTheme: undefined });
  assertEquals(changedPub?.basicTheme, undefined);
  assertEquals(changedPub?.icon, icon(100));
});
