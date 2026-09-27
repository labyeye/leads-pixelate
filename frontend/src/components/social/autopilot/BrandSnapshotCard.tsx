import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import type { BrandProfile } from "./useAutopilot";

// A Wikipedia-infobox-style read-only summary of what Autopilot already knows about the brand,
// shown alongside the scan animation so the wide right-hand column isn't empty while it runs.
// Fills in from status.brandProfile — on a first-ever scan that's still empty, so we show a
// placeholder instead; on a re-scan it shows the *previous* profile while the new one is built.
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 py-1.5 border-t border-black/10 text-sm">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {items.map((it) => (
        <span key={it} className="rounded-full border border-black/20 bg-muted px-2 py-0.5 text-xs">
          {it}
        </span>
      ))}
    </div>
  );
}

export function BrandSnapshotCard({
  profile,
  accountName,
  avatar,
  stale,
}: {
  profile: BrandProfile;
  accountName?: string;
  avatar?: string;
  stale?: boolean; // a previous scan's data, while a new scan is running
}) {
  const hasAnything =
    profile.summary || profile.industry || profile.audience || profile.tone || profile.visualStyle || profile.palette.length > 0;

  // Instagram/Facebook profile picture URLs are signed and often fail to load cross-origin.
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => setAvatarFailed(false), [avatar]);
  const showAvatar = avatar && !avatarFailed;

  if (!hasAnything) {
    return (
      <div className="rounded-lg border-2 border-black/20 border-dashed bg-muted/30 p-5 text-center text-sm text-muted-foreground h-fit">
        <BookOpen className="w-6 h-6 mx-auto mb-2 opacity-50" />
        Your brand snapshot will appear here — industry, tone, visual style and colours — as soon as the scan finishes.
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-black bg-background nb-shadow-sm overflow-hidden h-fit">
      {showAvatar && (
        <div className="border-b-2 border-black bg-muted aspect-video overflow-hidden">
          <img src={avatar} alt="" className="w-full h-full object-cover" onError={() => setAvatarFailed(true)} />
        </div>
      )}
      <div className="p-4 space-y-0.5">
        <p className="font-display font-bold text-base leading-tight">{accountName || "Your brand"}</p>
        {stale && <p className="text-[11px] text-amber-700 mb-2">From your last scan — updating…</p>}
        <Row label="Industry" value={profile.industry} />
        <Row label="Audience" value={profile.audience} />
        <Row label="Tone" value={profile.tone} />
        <Row label="Hashtag style" value={profile.hashtagStyle} />
        {profile.visualStyle && (
          <div className="py-1.5 border-t border-black/10 text-sm">
            <p className="font-semibold text-muted-foreground">Visual style</p>
            <p className="mt-0.5">{profile.visualStyle}</p>
          </div>
        )}
        {profile.palette.length > 0 && (
          <div className="py-1.5 border-t border-black/10 text-sm">
            <p className="font-semibold text-muted-foreground mb-1">Palette</p>
            <div className="flex flex-wrap gap-1.5 justify-end">
              {profile.palette.map((c) => (
                <span key={c} title={c} className="w-5 h-5 rounded border border-black/30" style={{ background: c }} />
              ))}
            </div>
          </div>
        )}
        {profile.contentPillars.length > 0 && (
          <div className="py-1.5 border-t border-black/10 text-sm">
            <p className="font-semibold text-muted-foreground mb-1">Content pillars</p>
            <Chips items={profile.contentPillars} />
          </div>
        )}
        {profile.summary && (
          <div className="pt-2 mt-1 border-t-2 border-black/20 text-xs text-muted-foreground leading-relaxed">{profile.summary}</div>
        )}
      </div>
    </div>
  );
}
