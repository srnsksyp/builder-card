// Database tables. Drizzle turns this file into SQL migrations (npm run db:generate).

import { bigint, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// GitHub IDs can be larger than a 32-bit integer, so they are stored as bigint.
// { mode: "number" } makes them plain JavaScript numbers (safe below 2^53).
const githubId = (name: string) => bigint(name, { mode: "number" });

export const githubProfiles = pgTable(
  "github_profiles",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    githubId: githubId("github_id").notNull().unique(), // GitHub's stable user ID = identity key
    username: text("username").notNull(),
    name: text("name"),
    avatarUrl: text("avatar_url").notNull(),
    bio: text("bio"),
    location: text("location"),
    publicRepos: integer("public_repos").notNull(),
    followers: integer("followers").notNull(),
    following: integer("following").notNull(),
    profileUrl: text("profile_url").notNull(),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Lookups are by username ignoring case. A plain (non-unique) index is used
    // because a user can rename themselves and someone else can take the old name.
    index("github_profiles_username_lower_idx").on(sql`lower(${table.username})`),
  ],
);

export const githubRepositories = pgTable(
  "github_repositories",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    githubId: githubId("github_id").notNull().unique(), // GitHub's repository ID
    ownerGithubId: githubId("owner_github_id")
      .notNull()
      .references(() => githubProfiles.githubId, { onDelete: "cascade" }),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    description: text("description"),
    language: text("language"),
    stars: integer("stars").notNull().default(0),
    forks: integer("forks").notNull().default(0),
    url: text("url").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("github_repositories_owner_idx").on(table.ownerGithubId)],
);

export const githubEvents = pgTable(
  "github_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // Event IDs are long numeric strings, so text is the safest type.
    githubEventId: text("github_event_id").notNull().unique(),
    ownerGithubId: githubId("owner_github_id")
      .notNull()
      .references(() => githubProfiles.githubId, { onDelete: "cascade" }),
    type: text("type").notNull(),
    repoName: text("repo_name"),
    detail: text("detail"), // short summary built from the event payload; the payload itself is not stored
    eventCreatedAt: timestamp("event_created_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("github_events_owner_created_idx").on(table.ownerGithubId, table.eventCreatedAt)],
);
