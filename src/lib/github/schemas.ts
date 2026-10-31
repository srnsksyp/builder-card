// Runtime validation for GitHub responses. TypeScript types disappear at runtime,
// so we check the real JSON before trusting it. Only the fields we use are listed.
// Extra fields from GitHub are ignored. Fields that can be null are marked nullish.

import { z } from "zod";

export const userSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullish(),
  avatar_url: z.string().startsWith("https://"),
  bio: z.string().nullish(),
  location: z.string().nullish(),
  public_repos: z.number(),
  followers: z.number(),
  following: z.number(),
  html_url: z.string().startsWith("https://"),
});

export const repositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullish(),
  language: z.string().nullish(),
  stargazers_count: z.number(),
  forks_count: z.number(),
  html_url: z.string().startsWith("https://"),
  fork: z.boolean(),
});

export const eventSchema = z.object({
  id: z.string(),
  type: z.string(),
  repo: z.object({ name: z.string() }).nullish(),
  created_at: z.string().nullish(),
  payload: z.record(z.string(), z.unknown()).nullish(),
});

export const repositoryListSchema = z.array(repositorySchema);
export const eventListSchema = z.array(eventSchema);

export type GitHubUser = z.infer<typeof userSchema>;
export type GitHubRepository = z.infer<typeof repositorySchema>;
export type GitHubEvent = z.infer<typeof eventSchema>;
