import { assertEquals } from "jsr:@std/assert";
import { rkeyFromPath } from "./document.ts";

Deno.test("rkeyFromPath: simple path", () => {
  assertEquals(rkeyFromPath("/my-post"), "self-my-post");
});

Deno.test("rkeyFromPath: / prefix treated same as default", () => {
  assertEquals(rkeyFromPath("/my-post", "/"), "self-my-post");
});

Deno.test("rkeyFromPath: slashes stripped from path segments", () => {
  // TODO: can we change this easily without overcomplicating the implementation?
  assertEquals(rkeyFromPath("/posts/my-post"), "self-postsmy-post");
});

Deno.test("rkeyFromPath: dots and tildes preserved", () => {
  assertEquals(rkeyFromPath("/my-post.html"), "self-my-post.html");
});

Deno.test("rkeyFromPath: special characters stripped", () => {
  assertEquals(rkeyFromPath("/my post!"), "self-mypost");
});

Deno.test("rkeyFromPath: custom prefix", () => {
  assertEquals(rkeyFromPath("/my-post", "/blog/"), "blog-my-post");
});

Deno.test("rkeyFromPath: custom prefix", () => {
  assertEquals(rkeyFromPath("/my-post", "/blog"), "blog-my-post");
});

Deno.test("rkeyFromPath: truncates at 512 chars", () => {
  assertEquals(rkeyFromPath("/" + "a".repeat(600)).length, 512);
});
