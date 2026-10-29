import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Copy,
  FileText,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  Smartphone,
  Trash2,
} from "lucide-react";
import { authAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import {
  passkeysSupported,
  serializeAttestation,
  toCreationOptions,
} from "@/lib/webauthn";

const timeAgo = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return "Active now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
};

function Card({
  icon,
  tint,
  title,
  subtitle,
  badge,
  children,
}: {
  icon: ReactNode;
  tint: string;
  title: string;
  subtitle: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-2 bg-white p-5 flex flex-col">
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-12 h-12 border-2 border-black flex items-center justify-center shrink-0"
          style={{ background: `${tint}1A` }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-medium text-base text-black">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

const VerifiedBadge = ({ text = "Verified" }: { text?: string }) => (
  <span className="nb-badge nb-tag-lime flex items-center gap-0.5 text-[10px] shrink-0">
    <CheckCircle2 className="w-2.5 h-2.5" /> {text}
  </span>
);

const btn =
  "border-2 border-black px-4 py-2 text-sm font-medium flex items-center gap-1.5 disabled:opacity-50";

// ── Email verification ────────────────────────────────────────────────────
export function EmailVerificationCard({
  email,
  verified,
  onVerified,
}: {
  email: string;
  verified: boolean;
  onVerified: (email: string) => void;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState(email);
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setValue(email), [email]);

  const changed = value.trim().toLowerCase() !== email.toLowerCase();
  const needsVerify = changed || !verified;

  const send = async () => {
    setBusy(true);
    try {
      await authAPI.sendContactOtp("email", value.trim().toLowerCase());
      setSent(true);
      toast({ title: "Code sent", description: "Check your email inbox." });
    } catch (err: any) {
      toast({
        title: "Could not send code",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      const res = await authAPI.verifyContactOtp(otp);
      onVerified(res.data?.email || value.trim().toLowerCase());
      setSent(false);
      setOtp("");
      toast({ title: "Email verified" });
    } catch (err: any) {
      toast({
        title: "Verification failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      icon={<Mail className="w-5 h-5 text-[#024BAB]" />}
      tint="#024BAB"
      title="Email Verification"
      subtitle="Confirm your email with a code we send to it"
      badge={!needsVerify ? <VerifiedBadge /> : undefined}
    >
      <div className="space-y-3">
        <input
          type="email"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSent(false);
          }}
          className="w-full border-2 border-black px-3 py-2 text-sm"
          autoComplete="email"
        />
        {needsVerify &&
          (!sent ? (
            <button
              onClick={send}
              disabled={busy || !value.trim()}
              className={`${btn} bg-[#024BAB]/10 text-black`}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {changed ? "Verify new email" : "Verify email"}
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                className="border-2 border-black px-3 py-2 text-sm font-medium tracking-widest"
              />
              <button
                onClick={verify}
                disabled={busy || otp.length !== 6}
                className={`${btn} bg-[#00C48C] text-black`}
              >
                Verify
              </button>
            </div>
          ))}
      </div>
    </Card>
  );
}

// ── Passkeys ──────────────────────────────────────────────────────────────
export function PasskeyCard() {
  const { toast } = useToast();
  const [list, setList] = useState<
    { _id: string; name: string; createdAt: string; lastUsedAt: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setList((await authAPI.passkeyList()).data || []);
    } catch {
      /* keep list */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!passkeysSupported()) {
      toast({
        title: "Not supported",
        description: "Your browser doesn't support passkeys.",
        variant: "destructive",
      });
      return;
    }
    setAdding(true);
    try {
      const { data: o } = await authAPI.passkeyRegisterOptions();
      const cred = (await navigator.credentials.create({
        publicKey: toCreationOptions(o),
      })) as PublicKeyCredential | null;
      if (!cred) throw new Error("Passkey setup was cancelled.");
      await authAPI.passkeyRegister({
        challengeToken: o.challengeToken,
        name: `${navigator.platform || "Browser"} passkey`,
        ...serializeAttestation(cred),
      });
      toast({ title: "Passkey added" });
      await load();
    } catch (err: any) {
      if (err?.name !== "NotAllowedError")
        toast({
          title: "Could not add passkey",
          description: err.message,
          variant: "destructive",
        });
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this passkey? You won't be able to use it.")) return;
    try {
      await authAPI.passkeyDelete(id);
      await load();
    } catch (err: any) {
      toast({
        title: "Failed to remove",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card
      icon={<KeyRound className="w-5 h-5 text-[#FA731C]" />}
      tint="#FA731C"
      title="Passkey"
      subtitle="Sign in with Face ID, fingerprint or your screen lock"
      badge={list.length ? <VerifiedBadge text={`${list.length} added`} /> : undefined}
    >
      <div className="space-y-2">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          list.map((p) => (
            <div
              key={p._id}
              className="flex items-center gap-2 border-2 border-black px-3 py-2"
            >
              <KeyRound className="w-4 h-4 text-[#FA731C] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-black truncate">{p.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  Added {new Date(p.createdAt).toLocaleDateString()}
                  {p.lastUsedAt
                    ? ` · Used ${new Date(p.lastUsedAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <button onClick={() => remove(p._id)} aria-label="Remove passkey">
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          ))
        )}
        <button
          onClick={add}
          disabled={adding}
          className={`${btn} bg-[#FA731C] text-white`}
        >
          {adding && <Loader2 className="w-4 h-4 animate-spin" />}
          Add a passkey
        </button>
      </div>
    </Card>
  );
}

// ── Signed-in devices ─────────────────────────────────────────────────────
export function DevicesCard() {
  const { toast } = useToast();
  const [list, setList] = useState<
    {
      _id: string;
      deviceName: string;
      platform: string;
      ip: string;
      lastActiveAt: string;
      current: boolean;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setList((await authAPI.sessions()).data || []);
    } catch {
      /* keep list */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const remove = async (d: { _id: string; deviceName: string }) => {
    if (!window.confirm(`Sign out ${d.deviceName}?`)) return;
    try {
      await authAPI.removeSession(d._id);
      await load();
    } catch (err: any) {
      toast({
        title: "Failed to remove device",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const removeOthers = async () => {
    if (!window.confirm("Sign out of every device except this one?")) return;
    try {
      await authAPI.removeOtherSessions();
      await load();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card
      icon={<Smartphone className="w-5 h-5 text-[#0EA5E9]" />}
      tint="#0EA5E9"
      title="Signed-in Devices"
      subtitle="Where your account is logged in"
    >
      <div className="space-y-2">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : list.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Devices appear here the next time you sign in.
          </p>
        ) : (
          list.map((d) => (
            <div
              key={d._id}
              className="flex items-center gap-2 border-2 border-black px-3 py-2"
            >
              {d.platform === "web" ? (
                <Globe className="w-4 h-4 text-[#0EA5E9] shrink-0" />
              ) : (
                <Smartphone className="w-4 h-4 text-[#0EA5E9] shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-black truncate">
                  {d.deviceName}
                  {d.current && (
                    <span className="ml-2 text-[10px] text-[#00A676]">
                      This device
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {timeAgo(d.lastActiveAt)}
                  {d.ip ? ` · ${d.ip}` : ""}
                </p>
              </div>
              {!d.current && (
                <button onClick={() => remove(d)} aria-label="Sign out device">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              )}
            </div>
          ))
        )}
        {list.some((d) => !d.current) && (
          <button onClick={removeOthers} className={`${btn} bg-white text-red-600`}>
            Sign out all other devices
          </button>
        )}
      </div>
    </Card>
  );
}

// ── Backup codes ──────────────────────────────────────────────────────────
export function BackupCodesCard() {
  const { toast } = useToast();
  const [status, setStatus] = useState<{
    remaining: number;
    generatedAt: string | null;
  } | null>(null);
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus((await authAPI.backupCodesStatus()).data);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authAPI.generateBackupCodes(password);
      setCodes(res.data.codes);
      setPassword("");
      await load();
    } catch (err: any) {
      toast({
        title: "Could not generate codes",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes?.join("\n") || "");
      toast({ title: "Codes copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <Card
      icon={<FileText className="w-5 h-5 text-[#E11D48]" />}
      tint="#E11D48"
      title="Backup Codes"
      subtitle="One-time codes if you lose access"
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Each code works once. Generating new codes replaces any old ones.
        </p>
        {status && !codes && (
          <p className="text-[11px] font-medium text-muted-foreground">
            {status.generatedAt
              ? `${status.remaining} of 10 codes left · created ${new Date(
                  status.generatedAt,
                ).toLocaleDateString()}`
              : "No backup codes yet"}
          </p>
        )}
        {codes ? (
          <>
            <div className="grid grid-cols-2 gap-2 border-2 border-black bg-[#FFF8E7] p-3 font-mono text-sm font-medium tracking-wider">
              {codes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Save these now — they won't be shown again.
            </p>
            <div className="flex gap-2">
              <button onClick={copy} className={`${btn} bg-[#024BAB] text-white`}>
                <Copy className="w-4 h-4" /> Copy
              </button>
              <button
                onClick={() => setCodes(null)}
                className={`${btn} bg-white text-black`}
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={generate} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Confirm your password"
              className="w-full border-2 border-black px-3 py-2 text-sm"
              autoComplete="current-password"
              required
            />
            <button
              type="submit"
              disabled={busy || !password}
              className={`${btn} bg-[#E11D48] text-white`}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {status?.generatedAt ? "Generate new codes" : "Generate codes"}
            </button>
          </form>
        )}
      </div>
    </Card>
  );
}
