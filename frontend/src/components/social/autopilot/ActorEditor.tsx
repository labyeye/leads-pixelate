import { useRef, useState } from "react";
import { Loader2, Mic, Sparkles, Trash2, Upload, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCampaignApi } from "./CampaignContext";
import type { AutopilotStatus } from "./useAutopilot";

const VOICES = ["Warm, friendly female", "Confident, energetic male", "Calm, trustworthy female", "Cheerful young male"];

// The campaign's AI presenter: the face that talks to camera in every reel. Either a photo of a
// real person who agreed to it, or an original AI-made face from a description; plus a voice.
export function ActorEditor({ status, toast, onChanged }: { status: AutopilotStatus; toast: any; onChanged: () => Promise<unknown> }) {
  const api = useCampaignApi();
  const actor = status.actor;
  const [mode, setMode] = useState<"generate" | "upload">("generate");
  const [description, setDescription] = useState("");
  const [voice, setVoice] = useState(actor?.voice || VOICES[0]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      await onChanged();
      toast({ title: ok });
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const upload = (file?: File) => file && act(() => api.uploadActor(file, voice), "Presenter saved");

  return (
    <section className="space-y-3 rounded-lg border-2 border-black p-4 bg-primary/5">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 shrink-0 rounded-full border-2 border-black bg-primary flex items-center justify-center">
          <UserRound className="w-4 h-4 text-white" />
        </span>
        <div>
          <h3 className="font-semibold text-sm">AI presenter (optional)</h3>
          <p className="text-xs text-muted-foreground">
            A presenter who speaks to camera in every reel: a ~15 second talking video with voice and lip sync. Without one,
            reels are short scenes with background sound.
          </p>
        </div>
      </div>

      {actor?.url ? (
        <div className="flex flex-wrap items-center gap-4">
          <img src={actor.url} alt="Your AI presenter" className="w-24 h-24 rounded-lg object-cover border-2 border-black nb-shadow-sm" />
          <div className="space-y-2 flex-1 min-w-[200px]">
            <p className="text-xs text-muted-foreground">{actor.source === "upload" ? "Uploaded photo" : "AI-made presenter"}</p>
            <VoiceField voice={voice} setVoice={setVoice} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy || voice === actor.voice} onClick={() => act(() => api.saveActorVoice(voice), "Voice saved")}>
                <Mic className="w-3.5 h-3.5 mr-1" /> Save voice
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => api.deleteActor(), "Presenter removed")}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2" role="tablist">
            {(["generate", "upload"] as const).map((m) => (
              <Button key={m} size="sm" type="button" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)} aria-pressed={mode === m}>
                {m === "generate" ? "Create with AI" : "Use a real photo"}
              </Button>
            ))}
          </div>
          <VoiceField voice={voice} setVoice={setVoice} />
          {mode === "generate" ? (
            <div className="space-y-2">
              <Label htmlFor="actor-desc">Describe your presenter</Label>
              <Textarea
                id="actor-desc"
                rows={2}
                maxLength={300}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Indian woman in her 30s, owner of a small bakery, warm smile, wearing a cream apron"
              />
              <Button size="sm" disabled={busy || !description.trim()} onClick={() => act(() => api.generateActor(description.trim(), voice), "Presenter created")}>
                {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                {busy ? "Creating… (~15s)" : "Create presenter"}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">A clear, front-facing photo of one person, face and shoulders visible.</p>
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" className="mt-0.5 accent-primary" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>This is me, or the person in the photo has agreed to appear as our AI presenter in our posts.</span>
              </label>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
              <Button size="sm" disabled={busy || !consent} onClick={() => fileRef.current?.click()}>
                {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                Upload photo
              </Button>
            </div>
          )}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Speech works best in English or Hinglish. Each talking reel takes about 2 minutes to make and uses more AI credits than an image post.
      </p>
    </section>
  );
}

function VoiceField({ voice, setVoice }: { voice: string; setVoice: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor="actor-voice">Voice</Label>
      <Input id="actor-voice" list="actor-voices" maxLength={150} value={voice} onChange={(e) => setVoice(e.target.value)} />
      <datalist id="actor-voices">
        {VOICES.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </div>
  );
}
