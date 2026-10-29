import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { usersAPI } from "@/services/api";
import { cn } from "@/lib/utils";

export interface QuotationApprovalConfig {
  enabled: boolean;
  minTotal: number;
  approvers: string[];
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
  };
  const [users, setUsers] = useState<any[] | null>(null);

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
              onChange({ ...cfg, minTotal: Math.max(0, Number(e.target.value) || 0) })
            }
            className={cn(input, "w-48")}
          />
          <p className="text-xs text-muted-foreground mt-1">
            0 means every quotation needs approval.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Approvers ({cfg.approvers.length} selected) — anyone one of them can approve
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
                    <span className="text-sm font-medium text-black">{u.name}</span>
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
    </div>
  );
}
