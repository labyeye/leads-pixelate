import { RefreshCw, UserCheck } from "lucide-react";
import { EmptyState } from "@/lib/metaAdsShared";

export interface AssignableCampaignRow {
  key: string; // `${platform}:${id}` — unique across platforms
  platform: "facebook" | "linkedin";
  name: string;
  subLabel: string;
  status: { label: string; cls: string };
  spend?: number;
  results?: number;
}

interface TeamUser {
  _id: string;
  name: string;
}

interface Props {
  rows: AssignableCampaignRow[];
  loading: boolean;
  users: TeamUser[];
  assignments: Record<string, any>;
  savingKey: string | null;
  onAssign: (row: AssignableCampaignRow, userId: string) => void;
  emptyIcon: React.ElementType;
  emptyTitle: string;
  emptyDesc: string;
  showPlatformColumn?: boolean;
}

export function CampaignAssignmentTable({
  rows,
  loading,
  users,
  assignments,
  savingKey,
  onAssign,
  emptyIcon,
  emptyTitle,
  emptyDesc,
  showPlatformColumn,
}: Props) {
  const sorted = [...rows].sort((a, b) => {
    const aAssigned = assignments[a.key] ? 0 : 1;
    const bAssigned = assignments[b.key] ? 0 : 1;
    return aAssigned - bAssigned;
  });

  return (
    <div className="border-2 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-black bg-[#024BAB]">
              <th className="text-left px-4 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                Campaign
              </th>
              {showPlatformColumn && (
                <th className="text-left px-4 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                  Platform
                </th>
              )}
              <th className="text-left px-4 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                Status
              </th>
              <th className="text-left px-4 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                Assigned To
              </th>
              <th className="text-left px-4 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                Spend
              </th>
              <th className="text-left px-4 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                Results
              </th>
              <th className="text-left px-4 py-3 text-[11px] font-black text-white uppercase tracking-widest">
                Owner
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={showPlatformColumn ? 7 : 6} className="py-16">
                  <div className="flex justify-center">
                    <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={showPlatformColumn ? 7 : 6}>
                  <EmptyState icon={emptyIcon} title={emptyTitle} desc={emptyDesc} />
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                const assignedTo = assignments[row.key]?.assignedTo;
                return (
                  <tr
                    key={row.key}
                    className="border-b border-black/10 hover:bg-[#024BAB]/5"
                  >
                    <td className="px-4 py-3">
                      <p className="font-bold text-black text-sm">{row.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {row.subLabel}
                      </p>
                    </td>
                    {showPlatformColumn && (
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 border-2 border-black bg-gray-100 capitalize">
                          {row.platform}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 border-2 font-bold ${row.status.cls}`}
                      >
                        {row.status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={assignedTo?._id || ""}
                        disabled={savingKey === row.key}
                        onChange={(e) => onAssign(row, e.target.value)}
                        className="border-2 border-black px-2 py-1.5 text-xs font-bold bg-white min-w-[140px]"
                      >
                        <option value="">— Unassigned —</option>
                        {users.map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 font-bold text-[#024BAB]">
                      {row.spend === undefined
                        ? "—"
                        : `₹${row.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    </td>
                    <td className="px-4 py-3 font-bold text-[#00C48C]">
                      {row.results === undefined
                        ? "—"
                        : row.results.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {assignedTo ? (
                        <span className="flex items-center gap-1 text-[#00C48C] font-bold">
                          <UserCheck className="w-3.5 h-3.5" /> Owned
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
