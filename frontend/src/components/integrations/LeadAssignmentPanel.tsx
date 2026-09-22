import { useState } from "react";

// Shown on a connected lead-source card (IndiaMART, TradeIndia, Justdial): pick who its leads go
// to, and — with more than one person — how many leads each gets before it moves to the next
// ("2 to A, then 2 to B, then back to A..."). Block round robin; see backend/utils/leadAssignment.js.
export function LeadAssignmentPanel({
  users,
  assigneeIds,
  onAssigneeIdsChange,
  batchSize,
  onBatchSizeChange,
  saving,
  onSave,
}: {
  users: { _id: string; name: string }[];
  assigneeIds: string[];
  onAssigneeIdsChange: (ids: string[]) => void;
  batchSize: number;
  onBatchSizeChange: (n: number) => void;
  saving: boolean;
  onSave: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 pt-4 border-t-2 border-black">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2"
      >
        Lead Assignment
        <span className="text-[10px] font-black text-[#024BAB]">{open ? "Hide" : "Edit"}</span>
      </button>
      {!open && (
        <p className="text-[11px] text-muted-foreground">
          {assigneeIds.length === 0
            ? "Auto round-robin among all sales team."
            : assigneeIds.length === 1
              ? "All leads go to one person."
              : `Round-robin, ${batchSize} lead${batchSize === 1 ? "" : "s"} at a time, across ${assigneeIds.length} people.`}
        </p>
      )}
      {open && (
        <>
          <p className="text-[11px] text-muted-foreground mb-3">
            Select who receives these leads. None = auto round-robin among all sales team. One = all leads go there. Several = block
            round-robin: the batch size below is how many leads each person gets before it moves to the next.
          </p>
          <div className="flex flex-col gap-1 mb-3 max-h-40 overflow-y-auto border-2 border-black p-2 bg-[#F9FAFB]">
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
                </label>
              );
            })}
          </div>
          {assigneeIds.length > 1 && (
            <label className="flex items-center gap-2 mb-3 text-xs font-bold text-black">
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
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="nb-btn w-full py-2 text-sm font-bold bg-[#024BAB] text-white"
          >
            {saving ? "Saving…" : "Save Assignment"}
          </button>
        </>
      )}
    </div>
  );
}
