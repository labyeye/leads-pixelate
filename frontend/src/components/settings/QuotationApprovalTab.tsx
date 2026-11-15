import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { usersAPI, whatsappAPI } from "@/services/api";
import {
  autoMapping,
  type Mapping,
} from "@/components/quotations/SendQuotationDialog";
import { cn } from "@/lib/utils";

export interface QuotationApprovalConfig {
  enabled: boolean;
  minTotal: number;
  approvers: string[];
  autoSend: {
    enabled: boolean;
    templateId: string;
    phoneNumberId: string;
    variableMapping: Mapping[];
  };
}

const input =
  "border-2 border-black px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]";

// Admin picks who must approve quotations (any staff, not just admins). Saved with the page's
// Save Changes button; the server keeps only active people of this account.
export default function QuotationApprovalTab({
  value,
  onChange,
}: {
  value?: Partial<QuotationApprovalConfig>;
  onChange: (v: QuotationApprovalConfig) => void;
}) {
  const cfg: QuotationApprovalConfig = {
    enabled: !!value?.enabled,
    minTotal: Number(value?.minTotal) || 0,
    approvers: (value?.approvers || []).map(String),
    autoSend: {
      enabled: !!value?.autoSend?.enabled,
      templateId: value?.autoSend?.templateId
        ? String(value.autoSend.templateId)
        : "",
      phoneNumberId: value?.autoSend?.phoneNumberId || "",
      variableMapping: value?.autoSend?.variableMapping || [],
    },
  };
  const [users, setUsers] = useState<any[] | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [senders, setSenders] = useState<any[]>([]);
  useEffect(() => {
    Promise.all([whatsappAPI.getTemplates(), whatsappAPI.getStatus()])
      .then(([t, s]) => {
        setTemplates(
          (t.data || []).filter(
            (x: any) => x.status === "APPROVED" && x.headerType === "DOCUMENT",
          ),
        );
        setSenders(s.data?.phoneNumbers || []);
      })
      .catch(() => {});
  }, []);
  const setAuto = (patch: Partial<QuotationApprovalConfig["autoSend"]>) =>
    onChange({ ...cfg, autoSend: { ...cfg.autoSend, ...patch } });
  const pickAutoTemplate = (id: string) =>
    setAuto({
      templateId: id,
      variableMapping: autoMapping(templates.find((t) => t._id === id)),
    });

  useEffect(() => {
    usersAPI
      .getAll()
      .then((r) =>
        setUsers((r.data || []).filter((u: any) => u.status !== "inactive")),
      )
      .catch(() => setUsers([]));
  }, []);

  const toggle = (id: string) =>
    onChange({
      ...cfg,
      approvers: cfg.approvers.includes(id)
        ? cfg.approvers.filter((a) => a !== id)
        : [...cfg.approvers, id],
    });

  return (
    <div className="space-y-6">
      <label className="flex items-start gap-3 p-4 border-2 border-black bg-white cursor-pointer">
        <input
          type="checkbox"
          checked={cfg.enabled}
          onChange={(e) => onChange({ ...cfg, enabled: e.target.checked })}
          className="mt-1 w-4 h-4 accent-[#024BAB]"
        />
        <span>
          <span className="block text-sm font-medium text-black">
            Ask for approval before a quotation is sent
          </span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            A quotation made by anyone who is not an approver waits for one of
            the approvers below. It can't be marked Sent or sent on WhatsApp
            until it is approved. Approvers' own quotations don't need approval.
          </span>
        </span>
      </label>

      <div className={cn("space-y-6", !cfg.enabled && "opacity-50")}>
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Only when the total is at least (₹)
          </label>
          <input
            type="number"
            min={0}
            value={cfg.minTotal}
            onChange={(e) =>
              onChange({
                ...cfg,
                minTotal: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className={cn(input, "w-48")}
          />
          <p className="text-xs text-muted-foreground mt-1">
            0 means every quotation needs approval.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Approvers ({cfg.approvers.length} selected) — anyone one of them can
            approve
          </p>
          {users === null ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : (
            <div className="border-2 border-black divide-y-2 divide-black bg-white">
              {users.map((u) => {
                const id = String(u._id);
                const on = cfg.approvers.includes(id);
                return (
                  <label
                    key={id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 cursor-pointer",
                      on && "bg-[#024BAB]/5",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(id)}
                      className="w-4 h-4 accent-[#024BAB]"
                    />
                    <span className="text-sm font-medium text-black">
                      {u.name}
                    </span>
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {String(u.role || "").replace("_", " ")}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {cfg.enabled && cfg.approvers.length === 0 && (
            <p className="text-xs text-red-600 mt-2">
              Pick at least one approver, otherwise approval is not enforced.
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Approvers need access to Quotations to see and decide on them.
          </p>
        </div>
      </div>

      <div className="border-2 border-black bg-white p-4 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={cfg.autoSend.enabled}
            onChange={(e) => setAuto({ enabled: e.target.checked })}
            className="mt-1 w-4 h-4 accent-[#024BAB]"
          />
          <span>
            <span className="block text-sm font-medium text-black">
              Send automatically on WhatsApp once approved
            </span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              When an approver approves a quotation, its PDF goes to the
              client's mobile number using the template below. The person who
              made it is told whether it went out.
            </span>
          </span>
        </label>

        <div className={cn("space-y-3", !cfg.autoSend.enabled && "opacity-50")}>
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Template (approved, with a Document header)
            </label>
            <select
              value={cfg.autoSend.templateId}
              onChange={(e) => pickAutoTemplate(e.target.value)}
              className={cn(input, "w-full max-w-md")}
            >
              <option value="">Choose a template…</option>
              {templates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.displayName || t.name}
                </option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                No approved template with a Document header yet. Create one in
                WhatsApp → Campaigns and sync it.
              </p>
            )}
          </div>

          {senders.length > 1 && (
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                Send from
              </label>
              <select
                value={cfg.autoSend.phoneNumberId}
                onChange={(e) => setAuto({ phoneNumberId: e.target.value })}
                className={cn(input, "w-full max-w-md")}
              >
                <option value="">First connected number</option>
                {senders.map((n) => (
                  <option key={n.phoneNumberId} value={n.phoneNumberId}>
                    {n.displayPhoneNumber || n.verifiedName || n.phoneNumberId}
                  </option>
                ))}
              </select>
            </div>
          )}

          {cfg.autoSend.variableMapping.some(
            (m) => m.fieldKey === "custom",
          ) && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Fixed text for the rest of the template
              </p>
              {cfg.autoSend.variableMapping
                .filter((m) => m.fieldKey === "custom")
                .map((m) => (
                  <div key={m.position} className="flex items-center gap-2">
                    <span className="text-xs font-medium w-10">{`{{${m.position}}}`}</span>
                    <input
                      value={m.customValue}
                      onChange={(e) =>
                        setAuto({
                          variableMapping: cfg.autoSend.variableMapping.map(
                            (x) =>
                              x.position === m.position
                                ? { ...x, customValue: e.target.value }
                                : x,
                          ),
                        })
                      }
                      placeholder="Type value"
                      className={cn(input, "flex-1 max-w-md")}
                    />
                  </div>
                ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Client name, company, project, quotation number and total are filled
            in from each quotation automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
