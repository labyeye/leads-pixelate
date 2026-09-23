// Inline version of LeadAssignmentPanel for connect/edit forms that have their own Save button
// (Meta pages, Google/LinkedIn accounts, API keys). None = admin, one = that person, several =
// block round robin: `batchSize` leads each before moving to the next person.
export function AssigneePicker({
  users,
  assigneeIds,
  onAssigneeIdsChange,
  batchSize,
  onBatchSizeChange,
}: {
  users: { _id: string; name: string; role?: string }[];
  assigneeIds: string[];
  onAssigneeIdsChange: (ids: string[]) => void;
  batchSize: number;
  onBatchSizeChange: (n: number) => void;
}) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-2">
        {assigneeIds.length === 0
          ? "None selected: leads go to the admin."
          : assigneeIds.length === 1
            ? "All leads go to this person."
            : `Round-robin: ${batchSize} lead${batchSize === 1 ? "" : "s"} per person, then next.`}
      </p>
      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border-2 border-black p-2 bg-[#F9FAFB]">
        {users.map((u) => {
          const checked = assigneeIds.includes(u._id);
          return (
            <label key={u._id} className="flex items-center gap-2 cursor-pointer text-sm font-medium text-black hover:bg-[#024BAB]/10 px-2 py-1">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onAssigneeIdsChange(checked ? assigneeIds.filter((id) => id !== u._id) : [...assigneeIds, u._id])}
                className="accent-[#024BAB] w-4 h-4"
              />
              {u.name}
              {u.role ? <span className="text-[10px] text-muted-foreground">({u.role.replace("_", " ")})</span> : null}
            </label>
          );
        })}
      </div>
      {assigneeIds.length > 1 && (
        <label className="flex items-center gap-2 mt-2 text-xs font-bold text-black">
          Leads per person before rotating
          <input
            type="number"
            min={1}
            max={1000}
            value={batchSize}
            onChange={(e) => onBatchSizeChange(Math.max(1, Math.min(1000, parseInt(e.target.value, 10) || 1)))}
            className="w-16 border-2 border-black px-2 py-1 text-sm font-bold"
          />
        </label>
      )}
    </div>
  );
}

type Assigned = { assigneeIds?: string[]; assignBatchSize?: number; defaultAssigneeId?: string };

// One-line summary for a connected page/account card; falls back to the legacy single assignee.
export function describeAssignment(
  a: Assigned,
  users: { _id: string; name: string }[],
  fallback: string,
) {
  const ids = a.assigneeIds?.length ? a.assigneeIds : a.defaultAssigneeId ? [a.defaultAssigneeId] : [];
  if (ids.length === 0) return fallback;
  if (ids.length === 1) return users.find((u) => u._id === ids[0])?.name || "Assigned";
  return `${ids.length} people, ${a.assignBatchSize || 1} at a time`;
}
