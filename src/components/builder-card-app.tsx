"use client";

import { useRef, useState } from "react";
import type { ApiResponse, CardData } from "@/lib/types";
import { ActivityList } from "./activity-list";
import { ErrorState } from "./error-state";
import { FreshnessBar } from "./freshness-bar";
import { LanguageChart } from "./language-chart";
import { LoadingState } from "./loading-state";
import { ProfileCard } from "./profile-card";
import { RepositoryList } from "./repository-list";
import { SearchForm } from "./search-form";

type Failure = { code: string; message: string; retryAfterSeconds?: number };

// The page is always in exactly one of these states.
type State =
  | { status: "idle" }
  | { status: "loading"; username: string }
  | { status: "success"; data: CardData }
  | { status: "error"; username: string; failure: Failure };

const NETWORK_FAILURE: Failure = {
  code: "NETWORK_ERROR",
  message: "Could not reach the Builder Card server. Check your internet connection and try again.",
};

// Calls our own API route and always returns either data or a Failure.
async function requestCard(username: string, refresh: boolean, signal: AbortSignal): Promise<ApiResponse> {
  const url = `/api/github/${encodeURIComponent(username)}${refresh ? "?refresh=1" : ""}`;
  try {
    const response = await fetch(url, { signal });
    const body = (await response.json()) as ApiResponse;
    if (typeof body === "object" && body !== null && "ok" in body) return body;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
  }
  return { ok: false, error: NETWORK_FAILURE };
}

export function BuilderCardApp() {
  const [state, setState] = useState<State>({ status: "idle" });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  async function search(username: string) {
    controller.current?.abort(); // cancel any earlier request still running
    const current = new AbortController();
    controller.current = current;

    setRefreshError(null);
    setState({ status: "loading", username });
    try {
      const result = await requestCard(username, false, current.signal);
      setState(
        result.ok
          ? { status: "success", data: result.data }
          : { status: "error", username, failure: result.error },
      );
    } catch {
      // Aborted because a newer search started. Ignore.
    }
  }

  async function refresh(username: string) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;

    setRefreshing(true);
    setRefreshError(null);
    try {
      const result = await requestCard(username, true, current.signal);
      if (result.ok) setState({ status: "success", data: result.data });
      else setRefreshError(result.error.message); // keep showing the data we already have
      setRefreshing(false);
    } catch {
      // Aborted by a newer search. That search owns the state now.
    }
  }

  const busy = state.status === "loading";

  return (
    <>
      <header>
        <h1 className="font-display text-5xl font-semibold tracking-tight sm:text-6xl">Builder Card</h1>
        <p className="mt-3 max-w-xl text-lg text-muted">
          Turn any GitHub username into a one-page developer profile.
        </p>
        <p className="mt-2 max-w-xl text-sm text-muted">
          You get the public profile, the five most-starred repositories, the main languages across their repositories,
          and their recent public activity.
        </p>
      </header>

      <div className="mt-8 max-w-xl">
        <SearchForm
          busy={busy}
          onSearch={(username) => {
            void search(username);
          }}
        />
      </div>

      <div aria-live="polite">
        {state.status === "loading" && <LoadingState username={state.username} />}

        {state.status === "error" && (
          <ErrorState
            code={state.failure.code}
            message={state.failure.message}
            retryAfterSeconds={state.failure.retryAfterSeconds}
            onRetry={
              state.failure.code === "INVALID_USERNAME" || state.failure.code === "USER_NOT_FOUND"
                ? undefined
                : () => {
                    void search(state.username);
                  }
            }
          />
        )}

        {state.status === "success" && (
          <div className="mt-10">
            <p className="sr-only">Loaded the profile for {state.data.profile.username}.</p>
            <FreshnessBar
              meta={state.data.meta}
              refreshing={refreshing}
              refreshError={refreshError}
              onRefresh={() => {
                void refresh(state.data.profile.username);
              }}
            />
            <ProfileCard profile={state.data.profile} />
            <div className="mt-6 grid gap-6 md:grid-cols-5">
              <RepositoryList
                repositories={state.data.topRepositories}
                analyzed={state.data.meta.repositoriesAnalyzed}
              />
              <div className="space-y-6 md:col-span-2">
                <LanguageChart summary={state.data.languageSummary} />
                <ActivityList events={state.data.events} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
