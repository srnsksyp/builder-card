// All SQL operations live here: one read function and one write function.

import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "./index";
import { githubEvents, githubProfiles, githubRepositories } from "./schema";
import type { FetchedData } from "../types";

export type CachedCard = FetchedData & { fetchedAt: string };

// Reads the saved card for a username (case-insensitive). Returns null if never saved.
export async function readCachedCard(username: string): Promise<CachedCard | null> {
  const db = getDb();

  const [row] = await db
    .select()
    .from(githubProfiles)
    .where(sql`lower(${githubProfiles.username}) = ${username.toLowerCase()}`)
    .orderBy(desc(githubProfiles.lastFetchedAt))
    .limit(1);
  if (!row) return null;

  const [repoRows, eventRows] = await Promise.all([
    db.select().from(githubRepositories).where(eq(githubRepositories.ownerGithubId, row.githubId)),
    db
      .select()
      .from(githubEvents)
      .where(eq(githubEvents.ownerGithubId, row.githubId))
      .orderBy(desc(githubEvents.eventCreatedAt))
      .limit(30),
  ]);

  return {
    fetchedAt: row.lastFetchedAt.toISOString(),
    profile: {
      githubId: row.githubId,
      username: row.username,
      name: row.name,
      avatarUrl: row.avatarUrl,
      bio: row.bio,
      location: row.location,
      publicRepos: row.publicRepos,
      followers: row.followers,
      following: row.following,
      profileUrl: row.profileUrl,
    },
    repositories: repoRows.map((r) => ({
      githubId: r.githubId,
      name: r.name,
      fullName: r.fullName,
      description: r.description,
      language: r.language,
      stars: r.stars,
      forks: r.forks,
      url: r.url,
    })),
    events: eventRows.map((e) => ({
      githubEventId: e.githubEventId,
      type: e.type,
      repoName: e.repoName,
      detail: e.detail,
      createdAt: e.eventCreatedAt.toISOString(),
    })),
  };
}

// Saves a whole card in ONE atomic batch: either every statement succeeds or none do.
// (Neon's HTTP driver has no interactive transactions, but db.batch() runs as one transaction.)
// The GitHub requests happen BEFORE this call, never inside it.
export async function saveCard(data: FetchedData, fetchedAt: Date): Promise<void> {
  const db = getDb();
  const { profile, repositories, events } = data;

  const profileValues = {
    githubId: profile.githubId,
    username: profile.username,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    location: profile.location,
    publicRepos: profile.publicRepos,
    followers: profile.followers,
    following: profile.following,
    profileUrl: profile.profileUrl,
    lastFetchedAt: fetchedAt,
  };

  // 1. Insert the profile, or update it if this GitHub user already exists.
  const statements: [BatchItem<"pg">, ...BatchItem<"pg">[]] = [
    db
      .insert(githubProfiles)
      .values(profileValues)
      .onConflictDoUpdate({
        target: githubProfiles.githubId,
        set: { ...profileValues, updatedAt: fetchedAt },
      }),
  ];

  // 2. Repositories: remove ones that no longer exist, then insert/update the current ones.
  const repoIds = repositories.map((r) => r.githubId);
  const ownRepos = eq(githubRepositories.ownerGithubId, profile.githubId);
  statements.push(
    db
      .delete(githubRepositories)
      .where(repoIds.length > 0 ? and(ownRepos, notInArray(githubRepositories.githubId, repoIds)) : ownRepos),
  );
  if (repositories.length > 0) {
    statements.push(
      db
        .insert(githubRepositories)
        .values(repositories.map((r) => ({ ...r, ownerGithubId: profile.githubId, fetchedAt })))
        .onConflictDoUpdate({
          target: githubRepositories.githubId,
          set: {
            ownerGithubId: sql`excluded.owner_github_id`,
            name: sql`excluded.name`,
            fullName: sql`excluded.full_name`,
            description: sql`excluded.description`,
            language: sql`excluded.language`,
            stars: sql`excluded.stars`,
            forks: sql`excluded.forks`,
            url: sql`excluded.url`,
            fetchedAt: sql`excluded.fetched_at`,
          },
        }),
    );
  }

  // 3. Events: keep exactly the events GitHub currently reports. Duplicates are ignored.
  const eventIds = events.map((e) => e.githubEventId);
  const ownEvents = eq(githubEvents.ownerGithubId, profile.githubId);
  statements.push(
    db
      .delete(githubEvents)
      .where(eventIds.length > 0 ? and(ownEvents, notInArray(githubEvents.githubEventId, eventIds)) : ownEvents),
  );
  if (events.length > 0) {
    statements.push(
      db
        .insert(githubEvents)
        .values(
          events.map((e) => ({
            githubEventId: e.githubEventId,
            ownerGithubId: profile.githubId,
            type: e.type,
            repoName: e.repoName,
            detail: e.detail,
            eventCreatedAt: new Date(e.createdAt),
            fetchedAt,
          })),
        )
        .onConflictDoNothing({ target: githubEvents.githubEventId }),
    );
  }

  await db.batch(statements);
}
