import { assertEquals } from "jsr:@std/assert";
import { anyFromPath, extractDate, tidFromPath } from "./rkey.ts";

Deno.test("extractDate", () => {
  assertEquals(extractDate("/2026-05-26-component-scoped-css/"), "2026-05-26");
  assertEquals(extractDate("2026-05-26-component-scoped-css"), "2026-05-26");
  assertEquals(extractDate("/blog/2026-05-26/component-scoped-css/"), "2026-05-26");
  assertEquals(extractDate("/2026/05/26/foobar-baz/"), "2026-05-26");
  assertEquals(extractDate("2026/05/26/foobar-baz"), "2026-05-26");

  assertEquals(extractDate("/posts/foo/"), undefined);
  assertEquals(extractDate("/foo"), undefined);
});

Deno.test("tidFromPath: date path matches createTid", () => {
  assertEquals(tidFromPath("/2026-05-26-component-scoped-css/"), "3mmpoqlvc22er");
});

Deno.test("tidFromPath: non-date path matches createTid", () => {
  assertEquals(tidFromPath("/posts/foo/"), "3wnfep4ezvzar");
});

Deno.test("anyFromPath: simple path", () => {
  assertEquals(anyFromPath("/my-post"), "my-post");
});

Deno.test("anyFromPath: path with trailing slash", () => {
  assertEquals(anyFromPath("/my-post/"), "my-post");
});

Deno.test("anyFromPath: slashes stripped from path segments", () => {
  assertEquals(anyFromPath("/posts/my-post"), "posts-my-post");
});

Deno.test("anyFromPath: dots and tildes preserved", () => {
  assertEquals(anyFromPath("/my-post.html"), "my-post.html");
});

Deno.test("anyFromPath: special characters stripped", () => {
  assertEquals(anyFromPath("/my post!"), "mypost");
});

Deno.test("anyFromPath: truncates at 512 chars", () => {
  assertEquals(anyFromPath("/" + "a".repeat(600)).length, 512);
});
