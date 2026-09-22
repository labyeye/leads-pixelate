import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { indiamartAPI, justdialSyncAPI, tradeindiaSyncAPI } from "@/services/api";

type Kind = "indiamart" | "tradeindia" | "justdial";

interface Props {
  kind: Kind;
  name: string;
  color: string;
  logo: string;
  onClose: () => void;
  onDisconnected: () => void;
}

const API = {
  indiamart: { getStatus: indiamartAPI.getStatus, disconnect: indiamartAPI.disconnect },
  tradeindia: { getStatus: tradeindiaSyncAPI.getStatus, disconnect: tradeindiaSyncAPI.disconnect },
  justdial: { getStatus: justdialSyncAPI.getStatus, disconnect: justdialSyncAPI.disconnect },
} as const;

// A saved connection's key never comes back from the server in full — only masked (••••1234) — so
// "renew" always means typing the replacement key fresh, never editing the old one in place.
export function ManageKeyIntegrationPanel({ kind, name, color, logo, onClose, onDisconnected }: Props) {
  const { toast } = useToast();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    API[kind]
      .getStatus()
      .then((res) => setStatus(res.data))
      .catch(() => toast({ title: "Couldn't load connection details", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const disconnect = async () => {
    if (!confirm(`Disconnect ${name}? Leads will stop coming in until you reconnect.`)) return;
    setDisconnecting(true);
    try {
      await API[kind].disconnect();
      toast({ title: `${name} disconnected` });
      onDisconnected();
    } catch (err: any) {
      toast({ title: "Couldn't disconnect", description: err.message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b-2 border-black p-4 sm:p-5 flex items-center gap-4" style={{ backgroundColor: "#FFF7ED" }}>
        <div className="w-12 h-12 border-2 border-black flex items-center justify-center bg-white shrink-0 overflow-hidden">
          <img src={logo} alt={name} className="w-8 h-8 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-xl text-black">{name}</h2>
          <p className="text-xs text-muted-foreground">Manage connection</p>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-bold text-muted-foreground hover:text-black border-2 border-transparent hover:border-black px-3 py-1.5 transition-all"
        >
          ✕ Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 sm:p-6 max-w-xl space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="border-2 border-black p-4 space-y-3 bg-[#F9FAFB]">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Saved credentials</p>
              {kind === "tradeindia" && status?.userId && <MaskedRow label="User ID" value={status.userId} plain />}
              {kind === "tradeindia" && status?.profileId && <MaskedRow label="Profile ID" value={status.profileId} plain />}
              {kind === "tradeindia" && status?.apiUrlMasked && <MaskedRow label="API Link" value={status.apiUrlMasked} />}
              <MaskedRow label={kind === "justdial" ? "API Key" : "CRM API Key"} value={status?.apiKeyMasked || "Not set"} />
              <p className="text-[11px] text-muted-foreground">
                For your security the full key is never shown again after it's saved. Use Renew below to replace it.
              </p>
            </div>

            {!renewing ? (
              <div className="flex gap-3">
                <button
                  onClick={() => setRenewing(true)}
                  className="nb-btn flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-2"
                  style={{ backgroundColor: color, color: "#fff" }}
                >
                  <RefreshCw className="w-4 h-4" /> Renew / Update Key
                </button>
                <button
                  onClick={disconnect}
                  disabled={disconnecting}
                  className="nb-btn flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-2 bg-white text-red-600 border-red-600"
                >
                  {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Disconnect
                </button>
              </div>
            ) : (
              <RenewForm kind={kind} onDone={() => setRenewing(false)} color={color} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MaskedRow({ label, value, plain }: { label: string; value: string; plain?: boolean }) {
  const { toast } = useToast();
  const [show, setShow] = useState(!!plain);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-black w-24 shrink-0">{label}</span>
      <span className="flex-1 font-mono text-sm text-gray-700 truncate">{show ? value : "•".repeat(Math.min(value.length, 12))}</span>
      {!plain && (
        <button type="button" onClick={() => setShow((s) => !s)} className="p-1 hover:bg-black/5" title={show ? "Hide" : "Reveal"}>
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast({ title: "Copied!" });
        }}
        className="p-1 hover:bg-black/5"
        title="Copy"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function RenewForm({ kind, onDone, color }: { kind: Kind; onDone: () => void; color: string }) {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [userId, setUserId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (kind === "tradeindia" ? !userId || !apiKey || !apiUrl : kind === "indiamart" ? !apiKey : false) {
      toast({ title: "Fill in the required fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (kind === "indiamart") await indiamartAPI.connect(apiKey);
      else if (kind === "tradeindia") await tradeindiaSyncAPI.connect(userId, profileId, apiKey, apiUrl);
      else await justdialSyncAPI.connect(apiKey);
      toast({ title: "Key updated" });
      onDone();
    } catch (err: any) {
      toast({ title: "Couldn't save the new key", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value: string, onChange: (v: string) => void, placeholder = "") => (
    <div>
      <label className="block text-sm font-bold text-black mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm font-medium border-2 border-black outline-none"
      />
    </div>
  );

  return (
    <div className="space-y-4 border-2 border-black p-4">
      {kind === "tradeindia" && (
        <>
          {field("TradeIndia User ID", userId, setUserId)}
          {field("TradeIndia Profile ID (optional)", profileId, setProfileId)}
          {field("New API Link", apiUrl, setApiUrl, "https://...")}
        </>
      )}
      {field(kind === "justdial" ? "New API Key (optional)" : "New API Key", apiKey, setApiKey)}
      <div className="flex gap-3">
        <button onClick={onDone} className="nb-btn flex-1 py-2 text-sm font-bold bg-white text-black">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="nb-btn flex-1 py-2 text-sm font-bold flex items-center justify-center gap-2"
          style={{ backgroundColor: color, color: "#fff" }}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save new key
        </button>
      </div>
    </div>
  );
}
