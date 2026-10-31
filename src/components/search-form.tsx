"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { parseUsername } from "@/lib/validation";

type Props = {
  onSearch: (username: string) => void;
  busy: boolean;
};

export function SearchForm({ onSearch, busy }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(input: string) {
    const result = parseUsername(input);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    onSearch(result.username);
  }

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
        className="flex flex-col gap-3 sm:flex-row"
        noValidate
      >
        <div className="flex-1">
          <label htmlFor="username" className="mb-1 block text-sm font-medium">
            GitHub username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="srnsksyp"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={40}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "username-error" : undefined}
            className="w-full rounded-lg border border-field bg-paper px-4 py-3 text-base"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 self-end rounded-lg bg-spruce px-6 py-3 font-medium text-white hover:bg-[#0b5a40] disabled:opacity-60 sm:self-end"
        >
          <Search size={18} aria-hidden="true" />
          {busy ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <p id="username-error" role="alert" className="mt-2 text-sm text-alert">
          {error}
        </p>
      )}

      <p className="mt-3 text-sm text-muted">
        No idea who to look up?{" "}
        <button
          type="button"
          onClick={() => {
            setValue("srnsksyp");
            submit("srnsksyp");
          }}
          disabled={busy}
          className="font-medium text-spruce underline underline-offset-2 disabled:opacity-60"
        >
          Try srnsksyp
        </button>
      </p>
    </div>
  );
}
