import { describe, expect, it } from "vitest";
import { parseUsername } from "./validation";

describe("parseUsername", () => {
  it.each(["octocat", "a", "Torvalds", "user-name", "a1-b2-c3", "x".repeat(39)])("accepts %s", (name) => {
    expect(parseUsername(name)).toEqual({ ok: true, username: name });
  });

  it("trims whitespace and a leading @", () => {
    expect(parseUsername("  @octocat ")).toEqual({ ok: true, username: "octocat" });
  });

  it.each([
    ["", "empty"],
    ["   ", "only spaces"],
    ["-start", "starts with hyphen"],
    ["end-", "ends with hyphen"],
    ["dou--ble", "double hyphen"],
    ["has space", "contains a space"],
    ["under_score", "underscore"],
    ["a/b", "slash"],
    ["../etc", "path traversal"],
    ["x".repeat(40), "too long"],
    ["https://github.com/x", "a URL"],
  ])("rejects %j (%s)", (input) => {
    expect(parseUsername(input).ok).toBe(false);
  });
});
