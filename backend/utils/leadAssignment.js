// Block round robin: the owner picks a list of people and a batch size N, and leads rotate
// N-at-a-time — 2 to person A, then 2 to person B, then back to A. Used by every lead-source
// integration (IndiaMART, TradeIndia, Justdial, Facebook/Google/LinkedIn lead ads, website API).
const AssignmentCursor = require("../models/AssignmentCursor");

const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// ponytail: read-then-write cursor, so two leads arriving in the same instant can occasionally
// land on the same person instead of alternating — fine at integration-webhook volumes; move to a
// single findOneAndUpdate with $inc + modulo math if a source ever bursts leads concurrently.
async function nextBatchAssignee({ tenantId, key, assigneeIds, batchSize = 1 }) {
  const ids = (assigneeIds || []).filter(Boolean).map(String);
  if (!ids.length) return null;
  if (ids.length === 1) return ids[0];

  const n = Math.max(1, Math.min(1000, Math.round(Number(batchSize)) || 1));
  const filter = { tenantId: tenantId || null, key };

  let cur = await AssignmentCursor.findOne(filter);
  if (!cur || !sameList(cur.assigneeIds, ids) || cur.batchSize !== n) {
    cur = await AssignmentCursor.findOneAndUpdate(
      filter,
      { $set: { assigneeIds: ids, batchSize: n, position: 0, count: 0 } },
      { upsert: true, new: true },
    );
  }

  const winner = ids[cur.position % ids.length];
  let { position, count } = cur;
  count += 1;
  if (count >= n) {
    count = 0;
    position = (position + 1) % ids.length;
  }
  await AssignmentCursor.updateOne(filter, { $set: { position, count } });
  return winner;
}

module.exports = { nextBatchAssignee };
