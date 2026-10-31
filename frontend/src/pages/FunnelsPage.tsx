import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Activity,
  ArrowDown,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { funnelsAPI, usersAPI, whatsappAPI } from "@/services/api";
import { ALL_STATUSES } from "@/components/leads/statusConstants";
import { cn } from "@/lib/utils";

interface Step {
  delayValue: string;
  delayUnit: "minutes" | "hours" | "days";
  templateId: string;
  variableMapping: { position: number; fieldKey: string; customValue: string }[];
  onlyIfStatus: string;
}

interface Draft {
  id?: string;
  name: string;
  audience: "leads" | "staff";
  event: "lead_created" | "status_changed" | "schedule" | "manual";
  status: string;
  staffTarget: "all" | "roles" | "selected";
  staffRoles: string[];
  staffUserIds: string[];
  frequency: "daily" | "weekly" | "monthly";
  hour: number;
  minute: number;
  weekday: number;
  dayOfMonth: number;
  sources: string[];
  steps: Step[];
  stopStatuses: string[];
  enabled: boolean;
}

const SOURCES = [
  "IndiaMART",
  "TradeIndia",
  "Justdial",
  "Website",
  "Manual",
  "Facebook",
  "Instagram",
  "Meta",
  "Google Ads",
  "LinkedIn",
];

const FIELDS = [
  { key: "name", label: "Lead name" },
  { key: "company", label: "Company" },
  { key: "phone", label: "Phone" },
  { key: "location", label: "Location" },
  { key: "requirement", label: "Requirement" },
  { key: "budget", label: "Budget" },
  { key: "custom", label: "Custom text" },
];

const PERF_FIELDS = [
  { key: "name", label: "Team member's name" },
  { key: "perf_period", label: "Period (today / last 7 days / this month)" },
  { key: "perf_new", label: "New leads" },
  { key: "perf_won", label: "Leads won" },
  { key: "perf_dropped", label: "Leads dropped" },
  { key: "perf_pending", label: "Pending contact now" },
  { key: "perf_active", label: "Open leads now" },
  { key: "perf_followups", label: "Follow-ups due" },
  { key: "perf_winrate", label: "Win rate" },
  { key: "custom", label: "Custom text" },
];

const ROLES = [
  ["admin", "Admins"],
  ["sales_executive", "Sales executives"],
  ["service_manager", "Service managers"],
  ["accountant", "Accountants"],
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const when = (f: any) => {
  const t = f.trigger.event;
  if (t === "manual") return "you press Send now";
  if (t === "schedule") {
    const sc = f.schedule || {};
    const at = `${String(sc.hour ?? 9).padStart(2, "0")}:${String(sc.minute ?? 0).padStart(2, "0")}`;
    return sc.frequency === "weekly"
      ? `every ${WEEKDAYS[sc.weekday ?? 1]} at ${at}`
      : sc.frequency === "monthly"
        ? `on day ${sc.dayOfMonth ?? 1} of every month at ${at}`
        : `every day at ${at}`;
  }
  return t === "lead_created"
    ? "a new lead arrives"
    : f.trigger.status
      ? `a lead moves to ${pretty(f.trigger.status)}`
      : "a lead's status changes";
};

const UNIT_MIN = { minutes: 1, hours: 60, days: 1440 };
const BLUE = "#024BAB";

const toDelay = (m: number): Pick<Step, "delayValue" | "delayUnit"> =>
  m && m % 1440 === 0
    ? { delayValue: String(m / 1440), delayUnit: "days" }
    : m && m % 60 === 0
      ? { delayValue: String(m / 60), delayUnit: "hours" }
      : { delayValue: String(m), delayUnit: "minutes" };

const delayText = (m: number) =>
  m === 0
    ? "immediately"
    : m % 1440 === 0
      ? `${m / 1440} day${m === 1440 ? "" : "s"}`
      : m % 60 === 0
        ? `${m / 60} hr`
        : `${m} min`;

const pretty = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const blankStep = (): Step => ({
  delayValue: "0",
  delayUnit: "minutes",
  templateId: "",
  variableMapping: [],
  onlyIfStatus: "",
});

const blankDraft = (): Draft => ({
  name: "",
  audience: "leads",
  event: "lead_created",
  status: "",
  staffTarget: "all",
  staffRoles: [],
  staffUserIds: [],
  frequency: "daily",
  hour: 9,
  minute: 0,
  weekday: 1,
  dayOfMonth: 1,
  sources: [],
  steps: [blankStep()],
  stopStatuses: ["WON", "DROP"],
  enabled: false,
});

const selectCls =
  "h-9 border-2 border-black bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#024BAB]";

export default function FunnelsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [funnels, setFunnels] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [overview, setOverview] = useState<{ cards: any; recent: any[] } | null>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [activity, setActivity] = useState<{ funnel: any; rows: any[] | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, o] = await Promise.all([funnelsAPI.list(), funnelsAPI.overview().catch(() => null)]);
      setFunnels(r.data || []);
      if (o) setOverview(o.data);
    } catch (e: any) {
      toast({ title: "Couldn't load funnels", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    load();
    whatsappAPI
      .getTemplates()
      .then((r) => setTemplates((r.data || []).filter((t: any) => t.status === "APPROVED")))
      .catch(() => {});
    usersAPI
      .getAll()
      .then((r) => setTeam((r.data || []).filter((u: any) => u.status !== "inactive")))
      .catch(() => {});
  }, [load, isAdmin]);

  const tpl = (id: string) => templates.find((t) => t._id === id);

  const edit = (f: any) =>
    setDraft({
      id: f._id,
      name: f.name,
      audience: f.audience || "leads",
      event: f.trigger.event,
      status: f.trigger.status || "",
      staffTarget: f.staff?.target || "all",
      staffRoles: f.staff?.roles || [],
      staffUserIds: (f.staff?.userIds || []).map(String),
      frequency: f.schedule?.frequency || "daily",
      hour: f.schedule?.hour ?? 9,
      minute: f.schedule?.minute ?? 0,
      weekday: f.schedule?.weekday ?? 1,
      dayOfMonth: f.schedule?.dayOfMonth ?? 1,
      sources: f.trigger.sources || [],
      stopStatuses: f.stopStatuses || [],
      enabled: f.enabled,
      steps: f.steps.map((s: any) => ({
        ...toDelay(s.delayMinutes),
        templateId: String(s.templateId),
        variableMapping: (s.variableMapping || []).map((v: any) => ({
          position: v.position,
          fieldKey: v.fieldKey,
          customValue: v.customValue || "",
        })),
        onlyIfStatus: s.onlyIfStatus || "",
      })),
    });

  const patchStep = (i: number, patch: Partial<Step>) =>
    setDraft((d) => d && { ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  const pickTemplate = (i: number, templateId: string) => {
    const t = tpl(templateId);
    patchStep(i, {
      templateId,
      // One row per {{n}} of the template, pre-filled with the lead's name for the first.
      variableMapping: Array.from({ length: t?.variableCount || 0 }, (_, k) => ({
        position: k + 1,
        fieldKey: k === 0 ? "name" : draft?.audience === "staff" ? "perf_new" : "custom",
        customValue: "",
      })),
    });
  };

  const save = async () => {
    if (!draft) return;
    const body = {
      name: draft.name,
      enabled: draft.enabled,
      audience: draft.audience,
      staff: { target: draft.staffTarget, roles: draft.staffRoles, userIds: draft.staffUserIds },
      schedule: {
        frequency: draft.frequency,
        hour: draft.hour,
        minute: draft.minute,
        weekday: draft.weekday,
        dayOfMonth: draft.dayOfMonth,
      },
      trigger: { event: draft.event, status: draft.status, sources: draft.sources },
      stopStatuses: draft.stopStatuses,
      steps: draft.steps.map((s) => ({
        delayMinutes: Math.round((Number(s.delayValue) || 0) * UNIT_MIN[s.delayUnit]),
        templateId: s.templateId,
        variableMapping: s.variableMapping,
        onlyIfStatus: s.onlyIfStatus,
      })),
    };
    setSaving(true);
    try {
      if (draft.id) await funnelsAPI.update(draft.id, body);
      else await funnelsAPI.create(body);
      toast({ title: draft.id ? "Funnel saved" : "Funnel created" });
      setDraft(null);
      load();
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (f: any, enabled: boolean) => {
    setFunnels((list) => list.map((x) => (x._id === f._id ? { ...x, enabled } : x)));
    try {
      await funnelsAPI.update(f._id, {
        name: f.name,
        enabled,
        audience: f.audience,
        staff: f.staff,
        schedule: f.schedule,
        trigger: f.trigger,
        stopStatuses: f.stopStatuses,
        steps: f.steps,
      });
    } catch (e: any) {
      toast({ title: "Couldn't change it", description: e?.message, variant: "destructive" });
      load();
    }
  };

  const remove = async (f: any) => {
    if (!window.confirm(`Delete "${f.name}"? Messages still waiting to go will be cancelled.`)) return;
    try {
      await funnelsAPI.remove(f._id);
      load();
    } catch (e: any) {
      toast({ title: "Couldn't delete", description: e?.message, variant: "destructive" });
    }
  };

  const sendNow = async (f: any) => {
    if (!window.confirm(`Send "${f.name}" to the team now?`)) return;
    try {
      const r = await funnelsAPI.run(f._id);
      toast({ title: "Queued", description: `Going out to ${r.data.people} team member(s) within a minute.` });
      load();
    } catch (e: any) {
      toast({ title: "Couldn't send", description: e?.message, variant: "destructive" });
    }
  };

  const openActivity = async (f: any) => {
    setActivity({ funnel: f, rows: null });
    try {
      const r = await funnelsAPI.jobs(f._id);
      setActivity({ funnel: f, rows: r.data || [] });
    } catch {
      setActivity({ funnel: f, rows: [] });
    }
  };

  if (!isAdmin) return <Navigate to="/" replace />;

  const valid =
    draft &&
    draft.name.trim() &&
    draft.steps.length > 0 &&
    draft.steps.every((s) => s.templateId) &&
    (draft.staffTarget !== "roles" || draft.audience !== "staff" || draft.staffRoles.length > 0) &&
    (draft.staffTarget !== "selected" || draft.audience !== "staff" || draft.staffUserIds.length > 0);

  return (
    <AppLayout title="Auto Funnels">
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h1 className="text-xl font-semibold text-black">Automatic message funnels</h1>
            <p className="text-xs text-muted-foreground">
              Send WhatsApp templates to leads when something happens, or to your team on a schedule (like a performance report).
            </p>
          </div>
          <Button
            onClick={() => setDraft(blankDraft())}
            className="gap-1.5 border-2 border-black"
            style={{ backgroundColor: BLUE }}
          >
            <Plus className="w-4 h-4" /> New funnel
          </Button>
        </div>

        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["Funnels", `${overview.cards.active}/${overview.cards.funnels}`, "active / total", ""],
              ["Sent today", overview.cards.sentToday, `${overview.cards.sent} in total`, ""],
              ["Delivery rate", `${overview.cards.deliveryRate}%`, `${overview.cards.failed} failed`, overview.cards.failed > 0 ? "text-red-600" : ""],
              ["Waiting", overview.cards.waiting, "queued to go out", ""],
              ["To team", overview.cards.toStaff, "staff messages sent", ""],
              ["To leads", overview.cards.toLeads, "lead messages sent", ""],
            ].map(([label, value, hint, tone]) => (
              <div key={label as string} className="border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <p className="uppercase tracking-wider text-[10px] text-muted-foreground">{label}</p>
                <p className={cn("text-2xl font-semibold tabular-nums text-black", tone as string)}>{value}</p>
                <p className="text-[11px] text-muted-foreground">{hint}</p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : funnels.length === 0 ? (
          <div className="border-2 border-dashed border-black/40 p-10 text-center">
            <Workflow className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-black font-medium">No funnels yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Example: when a new lead arrives, send a welcome template now, and a reminder after 1 day if they are still
              Pending Contact.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {funnels.map((f) => (
              <div key={f._id} className="border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <div className="p-4 flex flex-wrap items-center gap-3">
                  <div className="mr-auto min-w-0">
                    <p className="text-sm font-semibold text-black truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <b className="text-black">{f.audience === "staff" ? "Team" : "Leads"}</b> · Starts when {when(f)}
                      {f.audience === "staff"
                        ? ` · ${f.staff?.target === "roles" ? (f.staff.roles || []).map(pretty).join(", ") : f.staff?.target === "selected" ? `${f.staff.userIds?.length || 0} selected` : "everyone"}`
                        : f.trigger.sources?.length
                          ? ` · only ${f.trigger.sources.join(", ")}`
                          : ""}
                    </p>
                  </div>
                  <span className={cn("text-[11px] font-medium uppercase", f.enabled ? "text-green-700" : "text-muted-foreground")}>
                    {f.enabled ? "On" : "Off"}
                  </span>
                  <Switch checked={f.enabled} onCheckedChange={(v) => toggle(f, v)} />
                  {f.audience === "staff" && (
                    <Button size="sm" variant="outline" className="border-2 border-black h-8 gap-1" onClick={() => sendNow(f)}>
                      <Send className="w-3.5 h-3.5" /> Send now
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="border-2 border-black h-8 gap-1" onClick={() => openActivity(f)}>
                    <Activity className="w-3.5 h-3.5" /> Activity
                  </Button>
                  <Button size="sm" variant="outline" className="border-2 border-black h-8 gap-1" onClick={() => edit(f)}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <button
                    onClick={() => remove(f)}
                    className="w-8 h-8 border-2 border-black bg-white hover:bg-red-500 hover:text-white flex items-center justify-center"
                    aria-label="Delete funnel"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5 text-xs">
                  {f.steps.map((s: any, i: number) => (
                    <span key={s._id || i} className="border-2 border-black px-2 py-1 bg-slate-50">
                      {i === 0 ? "" : "then "}
                      <b>{tpl(String(s.templateId))?.displayName || "Template"}</b>{" "}
                      <span className="text-muted-foreground">
                        {s.delayMinutes === 0 && i === 0 ? "right away" : `after ${delayText(s.delayMinutes)}`}
                        {s.onlyIfStatus ? ` · if still ${pretty(s.onlyIfStatus)}` : ""}
                      </span>
                    </span>
                  ))}
                </div>
                <div className="border-t-2 border-black grid grid-cols-4 text-center text-xs">
                  {[
                    ["Started", f.stats?.enrolled || 0],
                    ["Sent", f.stats?.sent || 0],
                    ["Failed", f.stats?.failed || 0],
                    ["Waiting", f.queued || 0],
                  ].map(([label, n]) => (
                    <div key={label as string} className="py-2 border-r border-slate-200 last:border-r-0">
                      <p className={cn("text-base font-semibold tabular-nums", label === "Failed" && Number(n) > 0 && "text-red-600")}>{n}</p>
                      <p className="uppercase tracking-wider text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {overview && (
          <div className="border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <p className="px-4 py-3 text-sm font-semibold text-black border-b-2 border-black">Recent messages</p>
            {overview.recent.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Nothing has been sent yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-slate-200">
                      <th className="px-4 py-2">When</th>
                      <th className="px-3 py-2">Funnel</th>
                      <th className="px-3 py-2">To</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overview.recent.map((j) => (
                      <tr key={j._id}>
                        <td className="px-4 py-2 whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(j.sentAt || j.runAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2">
                          {j.funnelName || "Deleted funnel"} <span className="text-xs text-muted-foreground">· msg {j.stepIndex + 1}</span>
                        </td>
                        <td className="px-3 py-2">
                          {j.recipient}{" "}
                          <span className="text-[10px] uppercase border border-black px-1">{j.audience === "staff" ? "Team" : "Lead"}</span>
                        </td>
                        <td className="px-3 py-2 text-xs tabular-nums">{j.phone || "-"}</td>
                        <td className="px-3 py-2">
                          <span
                            title={j.note}
                            className={cn(
                              "text-[10px] uppercase font-semibold px-1.5 py-0.5 border-2 border-black",
                              j.status === "sent" && "bg-green-200",
                              j.status === "failed" && "bg-red-200",
                              ["cancelled", "skipped"].includes(j.status) && "bg-slate-100",
                            )}
                          >
                            {j.status}
                          </span>
                          {j.status === "failed" && j.note && <p className="text-[11px] text-red-600 max-w-[220px] truncate">{j.note}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* editor */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="border-2 border-black rounded-none max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit funnel" : "New funnel"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-5">
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Name</span>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. New lead welcome"
                  className="mt-1 border-2 border-black"
                  maxLength={80}
                />
              </label>

              <div className="border-2 border-black p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-black">Who gets the messages?</p>
                <div className="flex gap-2">
                  {([["leads", "Leads"], ["staff", "My team"]] as const).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          audience: v,
                          event: v === "staff" ? "schedule" : "lead_created",
                          steps: draft.steps.map((s) => ({ ...s, templateId: "", variableMapping: [], onlyIfStatus: "" })),
                        })
                      }
                      className={cn("text-sm border-2 border-black px-3 py-1.5", draft.audience === v ? "text-white" : "bg-white")}
                      style={draft.audience === v ? { backgroundColor: BLUE } : undefined}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {draft.audience === "staff" && (
                  <p className="text-xs text-muted-foreground">
                    Each team member gets their own numbers (new leads, won, follow-ups…) filled into the template. Members need a
                    phone number on their profile.
                  </p>
                )}
              </div>

              <div className="border-2 border-black p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-black">1 · When does it start?</p>
                <div className="flex flex-wrap gap-2">
                  <select
                    className={selectCls}
                    value={draft.event}
                    onChange={(e) => setDraft({ ...draft, event: e.target.value as Draft["event"] })}
                  >
                    {draft.audience === "staff" ? (
                      <>
                        <option value="schedule">On a schedule</option>
                        <option value="manual">Only when I press Send now</option>
                      </>
                    ) : (
                      <>
                        <option value="lead_created">A new lead arrives</option>
                        <option value="status_changed">A lead's status changes</option>
                      </>
                    )}
                  </select>
                  {draft.event === "schedule" && (
                    <>
                      <select
                        className={selectCls}
                        value={draft.frequency}
                        onChange={(e) => setDraft({ ...draft, frequency: e.target.value as Draft["frequency"] })}
                      >
                        <option value="daily">Every day (today's numbers)</option>
                        <option value="weekly">Every week (last 7 days)</option>
                        <option value="monthly">Every month (month so far)</option>
                      </select>
                      {draft.frequency === "weekly" && (
                        <select className={selectCls} value={draft.weekday} onChange={(e) => setDraft({ ...draft, weekday: Number(e.target.value) })}>
                          {WEEKDAYS.map((d, i) => (
                            <option key={d} value={i}>
                              {d}
                            </option>
                          ))}
                        </select>
                      )}
                      {draft.frequency === "monthly" && (
                        <select className={selectCls} value={draft.dayOfMonth} onChange={(e) => setDraft({ ...draft, dayOfMonth: Number(e.target.value) })}>
                          {Array.from({ length: 28 }, (_, i) => (
                            <option key={i} value={i + 1}>
                              day {i + 1}
                            </option>
                          ))}
                        </select>
                      )}
                      <Input
                        type="time"
                        value={`${String(draft.hour).padStart(2, "0")}:${String(draft.minute).padStart(2, "0")}`}
                        onChange={(e) => {
                          const [h, m] = e.target.value.split(":").map(Number);
                          if (Number.isFinite(h)) setDraft({ ...draft, hour: h, minute: m || 0 });
                        }}
                        className="h-9 w-32 border-2 border-black"
                      />
                    </>
                  )}
                  {draft.audience === "leads" && draft.event === "status_changed" && (
                    <select
                      className={selectCls}
                      value={draft.status}
                      onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                    >
                      <option value="">to any status</option>
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          to {pretty(s)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {draft.audience === "staff" && (
                  <div className="space-y-2">
                    <select
                      className={selectCls}
                      value={draft.staffTarget}
                      onChange={(e) => setDraft({ ...draft, staffTarget: e.target.value as Draft["staffTarget"] })}
                    >
                      <option value="all">Everyone on the team</option>
                      <option value="roles">By role</option>
                      <option value="selected">Pick people</option>
                    </select>
                    {draft.staffTarget === "roles" && (
                      <div className="flex flex-wrap gap-1.5">
                        {ROLES.map(([r, label]) => {
                          const on = draft.staffRoles.includes(r);
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setDraft({ ...draft, staffRoles: on ? draft.staffRoles.filter((x) => x !== r) : [...draft.staffRoles, r] })}
                              className={cn("text-xs border-2 border-black px-2 py-1", on ? "text-white" : "bg-white")}
                              style={on ? { backgroundColor: BLUE } : undefined}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {draft.staffTarget === "selected" && (
                      <div className="max-h-40 overflow-y-auto border border-black/30 divide-y divide-slate-100">
                        {team.map((u) => (
                          <label key={u._id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-[#024BAB]"
                              checked={draft.staffUserIds.includes(u._id)}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  staffUserIds: e.target.checked ? [...draft.staffUserIds, u._id] : draft.staffUserIds.filter((x) => x !== u._id),
                                })
                              }
                            />
                            {u.name}
                            {!u.phone && <span className="text-[11px] text-red-600">no phone</span>}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {draft.audience === "leads" && (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">Only for these sources (leave empty for all)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SOURCES.map((s) => {
                      const on = draft.sources.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              sources: on ? draft.sources.filter((x) => x !== s) : [...draft.sources, s],
                            })
                          }
                          className={cn("text-xs border-2 border-black px-2 py-1", on ? "text-white" : "bg-white")}
                          style={on ? { backgroundColor: BLUE } : undefined}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-black">2 · What gets sent?</p>
                {templates.length === 0 && (
                  <p className="text-xs text-red-600">
                    No approved WhatsApp templates yet. Create and submit one in WhatsApp → Setup first.
                  </p>
                )}
                {draft.steps.map((s, i) => {
                  const t = tpl(s.templateId);
                  return (
                    <div key={i}>
                      {i > 0 && <ArrowDown className="w-4 h-4 mx-auto my-1 text-muted-foreground" />}
                      <div className="border-2 border-black p-3 space-y-2 bg-slate-50">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-black">Message {i + 1}</span>
                          {draft.steps.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}
                              className="ml-auto text-muted-foreground hover:text-red-600"
                              aria-label="Remove message"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">Send</span>
                          <Input
                            type="number"
                            min={0}
                            value={s.delayValue}
                            onChange={(e) => patchStep(i, { delayValue: e.target.value })}
                            className="h-9 w-20 border-2 border-black"
                          />
                          <select
                            className={selectCls}
                            value={s.delayUnit}
                            onChange={(e) => patchStep(i, { delayUnit: e.target.value as Step["delayUnit"] })}
                          >
                            <option value="minutes">minutes</option>
                            <option value="hours">hours</option>
                            <option value="days">days</option>
                          </select>
                          <span className="text-xs text-muted-foreground">
                            {i === 0 ? "after it starts" : "after the previous message"}
                          </span>
                        </div>
                        <select className={cn(selectCls, "w-full")} value={s.templateId} onChange={(e) => pickTemplate(i, e.target.value)}>
                          <option value="">Choose a WhatsApp template…</option>
                          {templates.map((x) => (
                            <option key={x._id} value={x._id}>
                              {x.displayName}
                            </option>
                          ))}
                        </select>
                        {t && <p className="text-xs text-muted-foreground border-l-4 border-black/20 pl-2 whitespace-pre-wrap">{t.bodyText}</p>}
                        {s.variableMapping.map((v, k) => (
                          <div key={v.position} className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono bg-white border border-black px-1.5 py-1">{`{{${v.position}}}`}</span>
                            <select
                              className={selectCls}
                              value={v.fieldKey}
                              onChange={(e) =>
                                patchStep(i, {
                                  variableMapping: s.variableMapping.map((m, j) => (j === k ? { ...m, fieldKey: e.target.value } : m)),
                                })
                              }
                            >
                              {(draft.audience === "staff" ? PERF_FIELDS : FIELDS).map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                            {v.fieldKey === "custom" && (
                              <Input
                                value={v.customValue}
                                placeholder="Text to send"
                                onChange={(e) =>
                                  patchStep(i, {
                                    variableMapping: s.variableMapping.map((m, j) => (j === k ? { ...m, customValue: e.target.value } : m)),
                                  })
                                }
                                className="h-9 flex-1 min-w-[140px] border-2 border-black"
                              />
                            )}
                          </div>
                        ))}
                        {i > 0 && draft.audience === "leads" && (
                          <label className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Only if the lead is still</span>
                            <select className={selectCls} value={s.onlyIfStatus} onChange={(e) => patchStep(i, { onlyIfStatus: e.target.value })}>
                              <option value="">in any status</option>
                              {ALL_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {pretty(st)}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
                {draft.steps.length < 8 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-2 border-black gap-1"
                    onClick={() => setDraft({ ...draft, steps: [...draft.steps, { ...blankStep(), delayValue: "1", delayUnit: "days" }] })}
                  >
                    <Plus className="w-4 h-4" /> Add another message
                  </Button>
                )}
              </div>

              {draft.audience === "leads" && (
              <div className="border-2 border-black p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-black">3 · When should it stop?</p>
                {[
                  ["WON", "The lead becomes a client (Won)"],
                  ["DROP", "The lead is dropped"],
                ].map(([st, label]) => (
                  <label key={st} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-[#024BAB]"
                      checked={draft.stopStatuses.includes(st)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          stopStatuses: e.target.checked ? [...draft.stopStatuses, st] : draft.stopStatuses.filter((x) => x !== st),
                        })
                      }
                    />
                    {label} — stop sending the rest
                  </label>
                ))}
              </div>
              )}

              <label className="flex items-center gap-3">
                <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
                <span className="text-sm text-black">Turn this funnel on</span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="border-2 border-black" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button disabled={!valid || saving} onClick={save} className="border-2 border-black gap-1.5" style={{ backgroundColor: BLUE }}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save funnel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* activity */}
      <Dialog open={!!activity} onOpenChange={(o) => !o && setActivity(null)}>
        <DialogContent className="border-2 border-black rounded-none max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activity?.funnel.name} · recent messages</DialogTitle>
          </DialogHeader>
          {!activity?.rows ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto my-6" />
          ) : activity.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nothing has run yet.</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {activity.rows.map((j) => (
                <li key={j._id} className="py-2 flex items-center gap-3">
                  <span
                    className={cn(
                      "text-[10px] uppercase font-semibold px-1.5 py-0.5 border-2 border-black w-20 text-center shrink-0",
                      j.status === "sent" && "bg-green-200",
                      j.status === "failed" && "bg-red-200",
                      j.status === "pending" && "bg-amber-100",
                      ["cancelled", "skipped", "processing"].includes(j.status) && "bg-slate-100",
                    )}
                  >
                    {j.status}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-black truncate">
                      {j.recipient} · message {j.stepIndex + 1}
                    </p>
                    {j.note && <p className="text-xs text-muted-foreground truncate">{j.note}</p>}
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {new Date(j.sentAt || j.runAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
