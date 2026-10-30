import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Activity,
  ArrowDown,
  Loader2,
  Pencil,
  Plus,
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
import { funnelsAPI, whatsappAPI } from "@/services/api";
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
  event: "lead_created" | "status_changed";
  status: string;
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
  event: "lead_created",
  status: "",
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
  const [activity, setActivity] = useState<{ funnel: any; rows: any[] | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await funnelsAPI.list();
      setFunnels(r.data || []);
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
  }, [load, isAdmin]);

  const tpl = (id: string) => templates.find((t) => t._id === id);

  const edit = (f: any) =>
    setDraft({
      id: f._id,
      name: f.name,
      event: f.trigger.event,
      status: f.trigger.status || "",
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
        fieldKey: k === 0 ? "name" : "custom",
        customValue: "",
      })),
    });
  };

  const save = async () => {
    if (!draft) return;
    const body = {
      name: draft.name,
      enabled: draft.enabled,
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
    draft.steps.every((s) => s.templateId);

  return (
    <AppLayout title="Auto Funnels">
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h1 className="text-xl font-semibold text-black">Automatic message funnels</h1>
            <p className="text-xs text-muted-foreground">
              Pick when it starts, then the WhatsApp templates to send and how long to wait between them.
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
                      Starts when{" "}
                      {f.trigger.event === "lead_created"
                        ? "a new lead arrives"
                        : f.trigger.status
                          ? `a lead moves to ${pretty(f.trigger.status)}`
                          : "a lead's status changes"}
                      {f.trigger.sources?.length ? ` · only ${f.trigger.sources.join(", ")}` : ""}
                    </p>
                  </div>
                  <span className={cn("text-[11px] font-medium uppercase", f.enabled ? "text-green-700" : "text-muted-foreground")}>
                    {f.enabled ? "On" : "Off"}
                  </span>
                  <Switch checked={f.enabled} onCheckedChange={(v) => toggle(f, v)} />
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

              <div className="border-2 border-black p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-black">1 · When does it start?</p>
                <div className="flex flex-wrap gap-2">
                  <select
                    className={selectCls}
                    value={draft.event}
                    onChange={(e) => setDraft({ ...draft, event: e.target.value as Draft["event"] })}
                  >
                    <option value="lead_created">A new lead arrives</option>
                    <option value="status_changed">A lead's status changes</option>
                  </select>
                  {draft.event === "status_changed" && (
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
                              {FIELDS.map((f) => (
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
                        {i > 0 && (
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
                      {j.lead?.name || "Deleted lead"} · message {j.stepIndex + 1}
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
