import Image from "next/image";
import { ExternalLink, MapPin } from "lucide-react";
import { formatCount } from "@/lib/utils";
import type { Profile } from "@/lib/types";

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-display text-2xl font-semibold">{formatCount(value)}</dd>
    </div>
  );
}

export function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <section aria-labelledby="profile-heading" className="relative rounded-2xl border border-line bg-paper px-6 pb-6 pt-10 sm:px-8">
      {/* Decorative conference-badge slot */}
      <div aria-hidden="true" className="absolute left-1/2 top-3 h-2.5 w-16 -translate-x-1/2 rounded-full bg-lichen ring-1 ring-line" />

      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <Image
          src={profile.avatarUrl}
          alt={`Avatar of ${profile.username}`}
          width={112}
          height={112}
          unoptimized
          className="size-28 shrink-0 rounded-full border border-line"
        />
        <div className="min-w-0">
          <h2 id="profile-heading" className="font-display text-3xl font-semibold leading-tight">
            {profile.name ?? profile.username}
          </h2>
          {profile.name && <p className="text-muted">@{profile.username}</p>}
          <p className="mt-2 max-w-prose">
            {profile.bio ?? <span className="text-muted">No bio provided.</span>}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {profile.location && (
              <span className="inline-flex items-center gap-1.5 text-muted">
                <MapPin size={15} aria-hidden="true" />
                {profile.location}
              </span>
            )}
            <a
              href={profile.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-spruce underline underline-offset-2"
            >
              View on GitHub
              <ExternalLink size={14} aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-5">
        <Stat value={profile.publicRepos} label="Public repos" />
        <Stat value={profile.followers} label="Followers" />
        <Stat value={profile.following} label="Following" />
      </dl>
    </section>
  );
}
