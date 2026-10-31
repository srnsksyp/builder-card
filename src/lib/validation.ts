import { z } from "zod";

// GitHub username rules: 1-39 characters, letters/digits/single hyphens,
// and no hyphen at the start or end.
const usernameSchema = z
  .string()
  .min(1, "Enter a GitHub username.")
  .max(39, "GitHub usernames are at most 39 characters long.")
  .regex(
    /^[a-z\d](?:[a-z\d]|-(?=[a-z\d]))*$/i,
    "Use only letters, numbers and single hyphens. A username cannot start or end with a hyphen.",
  );

export type UsernameResult = { ok: true; username: string } | { ok: false; message: string };

// Trims whitespace, accepts a pasted "@name", then validates.
export function parseUsername(input: string): UsernameResult {
  const cleaned = input.trim().replace(/^@/, "");
  const result = usernameSchema.safeParse(cleaned);
  if (result.success) return { ok: true, username: result.data };
  return { ok: false, message: result.error.issues[0]?.message ?? "Enter a valid GitHub username." };
}
