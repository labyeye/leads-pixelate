import { useCallback, useEffect, useMemo, useState } from "react";
import { addMonths, format, startOfMonth, endOfMonth } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MediaUpload } from "@/components/social/MediaUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { socialAPI, socialPlanAPI, usersAPI } from "@/services/api";
import { cn } from "@/lib/utils";

type PlanStatus =
  | "PLANNED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "SCHEDULED";

interface Plan {
  _id: string;
  title: string;
  brief: string;
  pillar?: string;
  projectStage?: string;
  visualBrief?: string;
  shotList?: string;
  storyIdea?: string;
  platforms: string[];
  postType: "image" | "carousel" | "reel";
  plannedDate: string;
  plannedTime: string;
  references: { label: string; url: string }[];
  referenceNotes: string;
  caption: string;
  hashtags: string[];
  assignedTo?: { _id: string; name: string } | null;
  status: PlanStatus;
  approvedBy?: { name: string } | null;
  approvalNote?: string;
  rejectedBy?: { name: string } | null;
  rejectionReason?: string;
  postId?: {
    status: string;
    scheduledAt: string;
    failureReason?: string;
  } | null;
}

interface Account {
  _id: string;
  platform: string;
  accountName: string;
  isActive: boolean;
}

const STATUS: Record<PlanStatus, { label: string; cls: string }> = {
  PLANNED: { label: "Planned", cls: "bg-muted text-muted-foreground" },
  PENDING_APPROVAL: {
    label: "Needs approval",
    cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  APPROVED: {
    label: "Approved",
    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  REJECTED: {
    label: "Rejected",
    cls: "bg-red-500/15 text-red-700 dark:text-red-400",
  },
  SCHEDULED: {
    label: "Scheduled",
    cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  },
};

const PLATFORMS = ["instagram", "facebook", "linkedin"] as const;
const TYPES = ["image", "carousel", "reel"] as const;
const dayKey = (iso: string) => iso.slice(0, 10);
const ymd = (d: Date) => format(d, "yyyy-MM-dd");

const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Badge({ status }: { status: PlanStatus }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium",
        STATUS[status].cls,
      )}
    >
      {STATUS[status].label}
    </span>
  );
}

export default function SocialPlanSheetPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<{ _id: string; name: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [scheduling, setScheduling] = useState<Plan | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await socialPlanAPI.list({
        from: startOfMonth(month).toISOString(),
        to: endOfMonth(month).toISOString(),
      });
      setPlans(res.data);
    } catch (e: any) {
      toast({
        title: "Couldn't load plans",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [month, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    usersAPI
      .getAll()
      .then((r) => setUsers(r.data))
      .catch(() => {});
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter(
      (p) =>
        (!statusFilter || p.status === statusFilter) &&
        (!platformFilter || p.platforms.includes(platformFilter)) &&
        (!q ||
          p.title.toLowerCase().includes(q) ||
          p.brief.toLowerCase().includes(q) ||
          (p.assignedTo?.name || "").toLowerCase().includes(q)),
    );
  }, [plans, statusFilter, platformFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    plans.forEach((p) => (c[p.status] = (c[p.status] || 0) + 1));
    return c;
  }, [plans]);

  const act = async (fn: () => Promise<any>, ok: string) => {
    try {
      await fn();
      toast({ title: ok });
      await load();
      return true;
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
      return false;
    }
  };

  const exportCsv = () => {
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = [
      "Date",
      "Time",
      "Platforms",
      "Type",
      "Topic",
      "Brief",
      "References",
      "Owner",
      "Status",
    ];
    const body = rows.map((p) =>
      [
        dayKey(p.plannedDate),
        p.plannedTime,
        p.platforms.join("/"),
        p.postType,
        p.title,
        p.brief,
        p.references.map((r) => r.url || r.label).join(" | "),
        p.assignedTo?.name || "",
        STATUS[p.status].label,
      ]
        .map(esc)
        .join(","),
    );
    const blob = new Blob([[head.map(esc).join(","), ...body].join("\n")], {
      type: "text/csv",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `content-plan-${format(month, "yyyy-MM")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const openRow = (p: Plan) => {
    if (p.status === "APPROVED" && isAdmin) setScheduling(p);
    else setEditing(p);
  };

  return (
    <AppLayout title="Content Planner">
      <div className="space-y-4 p-4 md:p-6">
        {/* Month + actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[9rem] text-center font-display text-lg font-semibold">
            {format(month, "MMMM yyyy")}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            This month
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
              <Download className="mr-1.5 h-4 w-4" /> Export
            </Button>
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="mr-1.5 h-4 w-4" /> New plan
            </Button>
          </div>
        </div>

        {/* Status strip doubles as filter */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS) as PlanStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                statusFilter === s ? "border-primary bg-primary/10" : "hover:bg-muted",
              )}
            >
              {STATUS[s].label}{" "}
              <span className="ml-1 font-semibold">{counts[s] || 0}</span>
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-9 pl-8"
              placeholder="Search topic, brief, owner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className={cn(selectCls, "w-36")}
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
          >
            <option value="">All platforms</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p} className="capitalize">
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* The sheet */}
        <div className="max-h-[70vh] overflow-auto rounded-lg border bg-card">
          <table className="w-full min-w-[2600px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-left text-xs text-muted-foreground">
              <tr>
                {["#", "Date", "Day", "Time (IST)", "Platform", "Format", "Pillar", "Project stage", "Visual brief", "Slides / Reel shot list", "On-screen text / hook", "Caption", "Hashtags", "Story idea", "References", "Owner", "Status", ""].map(
                  (h, i) => (
                    <th key={i} className="border-b border-r px-3 py-2 font-medium last:border-r-0">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={18} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={18} className="py-16 text-center text-muted-foreground">
                    {plans.length
                      ? "No plans match these filters."
                      : "Nothing planned for this month yet. Add your first row with “New plan”."}
                  </td>
                </tr>
              ) : (
                rows.map((p, i) => (
                  <tr
                    key={p._id}
                    onClick={() => openRow(p)}
                    className="cursor-pointer odd:bg-background even:bg-muted/20 hover:bg-primary/5"
                  >
                    <td className="border-b border-r px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="whitespace-nowrap border-b border-r px-3 py-2">
                      {format(new Date(dayKey(p.plannedDate) + "T00:00"), "EEE, d MMM")}
                    </td>
                    <td className="whitespace-nowrap border-b border-r px-3 py-2">{format(new Date(dayKey(p.plannedDate) + "T00:00"), "EEE")}</td>
                    <td className="whitespace-nowrap border-b border-r px-3 py-2">{p.plannedTime}</td>
                    <td className="border-b border-r px-3 py-2 capitalize">
                      {p.platforms.join(", ") || "—"}
                    </td>
                    <td className="border-b border-r px-3 py-2 capitalize">{p.postType}</td>
                    <td className="min-w-[160px] whitespace-pre-line border-b border-r px-3 py-2 align-top text-xs">{p.pillar || "—"}</td>
                    <td className="min-w-[130px] whitespace-pre-line border-b border-r px-3 py-2 align-top text-xs">{p.projectStage || "—"}</td>
                    <td className="min-w-[260px] max-w-[320px] whitespace-pre-line border-b border-r px-3 py-2 align-top text-xs">{p.visualBrief || "—"}</td>
                    <td className="min-w-[320px] max-w-[380px] whitespace-pre-line border-b border-r px-3 py-2 align-top text-xs">{p.shotList || "—"}</td>
                    <td className="min-w-[220px] font-medium whitespace-pre-line border-b border-r px-3 py-2 align-top text-xs">{p.title || "—"}</td>
                    <td className="min-w-[360px] max-w-[420px] whitespace-pre-line border-b border-r px-3 py-2 align-top text-xs">{p.caption || "—"}</td>
                    <td className="min-w-[260px] whitespace-pre-line border-b border-r px-3 py-2 align-top text-xs">{p.hashtags.join(' ') || "—"}</td>
                    <td className="min-w-[200px] whitespace-pre-line border-b border-r px-3 py-2 align-top text-xs">{p.storyIdea || "—"}</td>
                    <td className="border-b border-r px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1.5">
                        {p.references.filter((r) => r.url).map((r, k) => (
                          <a
                            key={k}
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            {r.label || "Link"} <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                        {!p.references.some((r) => r.url) && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap border-b border-r px-3 py-2">
                      {p.assignedTo?.name || "—"}
                    </td>
                    <td className="border-b border-r px-3 py-2">
                      <Badge status={p.status} />
                      {p.status === "SCHEDULED" && p.postId && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          Post: {p.postId.status.toLowerCase().replace("_", " ")}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap border-b px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {(p.status === "PLANNED" || p.status === "REJECTED") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => act(() => socialPlanAPI.submit(p._id), "Sent for approval")}
                        >
                          Send for approval
                        </Button>
                      )}
                      {p.status === "PENDING_APPROVAL" && isAdmin && (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => act(() => socialPlanAPI.approve(p._id), "Plan approved")}
                          >
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                            Review
                          </Button>
                        </div>
                      )}
                      {p.status === "APPROVED" && isAdmin && (
                        <Button size="sm" onClick={() => setScheduling(p)}>
                          Schedule
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <PlanDialog
          plan={editing === "new" ? null : editing}
          month={month}
          users={users}
          isAdmin={isAdmin}
          onClose={() => setEditing(null)}
          onSchedule={(p) => {
            setEditing(null);
            setScheduling(p);
          }}
          act={act}
        />
      )}
      {scheduling && (
        <ScheduleDialog
          plan={scheduling}
          onClose={() => setScheduling(null)}
          onDone={() => {
            setScheduling(null);
            load();
          }}
        />
      )}
    </AppLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Create / edit / review                                              */
/* ------------------------------------------------------------------ */

function PlanDialog({
  plan,
  month,
  users,
  isAdmin,
  onClose,
  onSchedule,
  act,
}: {
  plan: Plan | null;
  month: Date;
  users: { _id: string; name: string }[];
  isAdmin: boolean;
  onClose: () => void;
  onSchedule: (p: Plan) => void;
  act: (fn: () => Promise<any>, ok: string) => Promise<boolean>;
}) {
  const locked = !!plan && (plan.status === "PENDING_APPROVAL" || plan.status === "SCHEDULED");
  const [f, setF] = useState(() => ({
    title: plan?.title || "",
    brief: plan?.brief || "",
    pillar: plan?.pillar || "",
    projectStage: plan?.projectStage || "",
    visualBrief: plan?.visualBrief || "",
    shotList: plan?.shotList || "",
    storyIdea: plan?.storyIdea || "",
    caption: plan?.caption || "",
    platforms: plan?.platforms || ([] as string[]),
    postType: plan?.postType || "image",
    plannedDate: plan ? dayKey(plan.plannedDate) : ymd(month),
    plannedTime: plan?.plannedTime || "10:00",
    references: plan?.references?.length ? plan.references : [{ label: "", url: "" }],
    referenceNotes: plan?.referenceNotes || "",
    assignedTo: plan?.assignedTo?._id || "",
  }));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  const save = async (andSubmit = false) => {
    if (!f.title.trim() || !f.plannedDate) return;
    setSaving(true);
    const payload = { ...f, title: f.title.trim() };
    const ok = await act(async () => {
      const res = plan
        ? await socialPlanAPI.update(plan._id, payload)
        : await socialPlanAPI.create(payload);
      if (andSubmit) await socialPlanAPI.submit(res.data._id);
    }, andSubmit ? "Saved and sent for approval" : plan ? "Plan updated" : "Plan added");
    setSaving(false);
    if (ok) onClose();
  };

  const toggle = (p: string) =>
    set(
      "platforms",
      f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p],
    );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {plan ? "Plan" : "New plan"} {plan && <Badge status={plan.status} />}
          </DialogTitle>
        </DialogHeader>

        {plan?.status === "REJECTED" && plan.rejectionReason && (
          <p className="rounded-md bg-red-500/10 p-3 text-sm">
            <b>Rejected{plan.rejectedBy ? ` by ${plan.rejectedBy.name}` : ""}:</b>{" "}
            {plan.rejectionReason}
          </p>
        )}
        {plan?.approvalNote && plan.status !== "PLANNED" && (
          <p className="rounded-md bg-emerald-500/10 p-3 text-sm">
            <b>Approval note:</b> {plan.approvalNote}
          </p>
        )}

        <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>On-screen text / hook (topic)</Label>
            <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Diwali offer teaser" />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={f.plannedDate} onChange={(e) => set("plannedDate", e.target.value)} />
          </div>
          <div>
            <Label>Time</Label>
            <Input type="time" value={f.plannedTime} onChange={(e) => set("plannedTime", e.target.value)} />
          </div>
          <div>
            <Label>Platforms</Label>
            <div className="flex gap-1.5 pt-1">
              {PLATFORMS.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => toggle(p)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs capitalize",
                    f.platforms.includes(p) ? "border-primary bg-primary/10" : "hover:bg-muted",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Format</Label>
            <select className={cn(selectCls, "capitalize")} value={f.postType} onChange={(e) => set("postType", e.target.value as any)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Brief / idea</Label>
            <Textarea rows={3} value={f.brief} onChange={(e) => set("brief", e.target.value)} placeholder="What should this post say or show?" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Pillar</Label>
            <Textarea rows={1} value={f.pillar} onChange={(e) => set("pillar", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Project stage</Label>
            <Textarea rows={1} value={f.projectStage} onChange={(e) => set("projectStage", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Visual brief</Label>
            <Textarea rows={3} value={f.visualBrief} onChange={(e) => set("visualBrief", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Slides / Reel shot list</Label>
            <Textarea rows={3} value={f.shotList} onChange={(e) => set("shotList", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Story idea</Label>
            <Textarea rows={1} value={f.storyIdea} onChange={(e) => set("storyIdea", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Caption</Label>
            <Textarea rows={4} value={f.caption} onChange={(e) => set("caption", e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <Label>Reference</Label>
            <div className="space-y-2 pt-1">
              {f.references.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="w-1/3"
                    placeholder="Label (Reel, Competitor…)"
                    value={r.label}
                    onChange={(e) =>
                      set("references", f.references.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))
                    }
                  />
                  <Input
                    placeholder="https://…"
                    value={r.url}
                    onChange={(e) =>
                      set("references", f.references.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => set("references", f.references.filter((_, k) => k !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => set("references", [...f.references, { label: "", url: "" }])}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add link
              </Button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>Reference notes</Label>
            <Textarea rows={2} value={f.referenceNotes} onChange={(e) => set("referenceNotes", e.target.value)} placeholder="What to copy or avoid from the references" />
          </div>
          <div>
            <Label>Owner</Label>
            <select className={selectCls} value={f.assignedTo} onChange={(e) => set("assignedTo", e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>{u.name}</option>
              ))}
            </select>
          </div>
        </fieldset>

        {plan?.status === "PENDING_APPROVAL" && isAdmin && (
          <div>
            <Label>Note / rejection reason</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional for approval, helpful for rejection" />
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {plan && plan.status !== "SCHEDULED" && (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={async () => {
                  if (await act(() => socialPlanAPI.remove(plan._id), "Plan deleted")) onClose();
                }}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete
              </Button>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            {plan?.status === "PENDING_APPROVAL" && isAdmin && (
              <>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (await act(() => socialPlanAPI.reject(plan._id, note), "Plan rejected")) onClose();
                  }}
                >
                  Reject
                </Button>
                <Button
                  onClick={async () => {
                    if (await act(() => socialPlanAPI.approve(plan._id, note), "Plan approved")) onClose();
                  }}
                >
                  Approve
                </Button>
              </>
            )}
            {plan?.status === "APPROVED" && isAdmin && (
              <Button onClick={() => onSchedule(plan)}>Schedule post</Button>
            )}
            {!locked && (
              <>
                <Button variant="outline" disabled={saving || !f.title.trim()} onClick={() => save(false)}>
                  {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Save
                </Button>
                <Button disabled={saving || !f.title.trim()} onClick={() => save(true)}>
                  Save &amp; send for approval
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Schedule an approved plan as a real post                            */
/* ------------------------------------------------------------------ */

function ScheduleDialog({
  plan,
  onClose,
  onDone,
}: {
  plan: Plan;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [caption, setCaption] = useState(plan.caption || plan.brief || "");
  const [hashtags, setHashtags] = useState(plan.hashtags?.join(" ") || "");
  const [date, setDate] = useState(dayKey(plan.plannedDate));
  const [time, setTime] = useState(plan.plannedTime);
  const [image, setImage] = useState<string[]>([]);
  const [media, setMedia] = useState<string[]>([]);
  const [video, setVideo] = useState<string[]>([]);
  const [cover, setCover] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    socialAPI
      .getAccounts()
      .then((r) => {
        const active: Account[] = r.data.filter((a: Account) => a.isActive);
        setAccounts(active);
        setAccountIds(
          active.filter((a) => plan.platforms.includes(a.platform)).map((a) => a._id),
        );
      })
      .catch(() => toast({ title: "Couldn't load accounts", variant: "destructive" }));
  }, [plan.platforms, toast]);

  const type = plan.postType;
  const mediaOk =
    type === "image" ? image.length > 0 : type === "carousel" ? media.length >= 2 : video.length > 0;
  const valid = mediaOk && caption.trim() && accountIds.length && date && time;

  const submit = async () => {
    setSaving(true);
    try {
      await socialPlanAPI.schedule(plan._id, {
        accountIds,
        caption: caption.trim(),
        hashtags: hashtags
          .split(/[\s,]+/)
          .filter(Boolean)
          .map((h) => (h.startsWith("#") ? h : `#${h}`)),
        postType: type,
        imageUrl: image[0] || "",
        mediaUrls: media,
        videoUrl: video[0] || "",
        coverImageUrl: cover[0] || "",
        scheduledAt: new Date(`${date}T${time}:00`).toISOString(),
      });
      toast({ title: "Post scheduled" });
      onDone();
    } catch (e: any) {
      toast({ title: "Couldn't schedule", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule: {plan.title}</DialogTitle>
        </DialogHeader>

        {(plan.brief || plan.references.some((r) => r.url)) && (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            {plan.brief && <p>{plan.brief}</p>}
            {plan.referenceNotes && <p className="mt-1 text-muted-foreground">{plan.referenceNotes}</p>}
            <div className="mt-1 flex flex-wrap gap-3">
              {plan.references.filter((r) => r.url).map((r, i) => (
                <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  {r.label || "Reference"} <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label>Post to</Label>
            {accounts.length === 0 ? (
              <p className="pt-1 text-sm text-muted-foreground">No connected accounts. Connect one under Social Media → Accounts.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {accounts.map((a) => (
                  <button
                    type="button"
                    key={a._id}
                    onClick={() =>
                      setAccountIds((s) => (s.includes(a._id) ? s.filter((x) => x !== a._id) : [...s, a._id]))
                    }
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs",
                      accountIds.includes(a._id) ? "border-primary bg-primary/10" : "hover:bg-muted",
                    )}
                  >
                    <span className="capitalize">{a.platform}</span> · {a.accountName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {type === "image" && (
            <MediaUpload kind="image" label="Image" value={image} onChange={setImage} rule="feed" />
          )}
          {type === "carousel" && (
            <MediaUpload kind="image" multiple label="Carousel images (2 or more)" value={media} onChange={setMedia} rule="feed" />
          )}
          {type === "reel" && (
            <>
              <MediaUpload kind="video" label="Reel video" value={video} onChange={setVideo} rule="reel" />
              <MediaUpload kind="image" label="Cover (optional)" value={cover} onChange={setCover} />
            </>
          )}

          <div>
            <Label>Caption</Label>
            <Textarea rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
          <div>
            <Label>Hashtags</Label>
            <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#offer #diwali" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Publish date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Publish time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || saving} onClick={submit}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Schedule post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
