// Offline check of block round-robin lead assignment (no real database; stubs AssignmentCursor's
// storage with an in-memory map keyed the same way Mongo would).
const assert = require("assert");
const path = require("path");
const Module = require("module");

const store = new Map();
const k = (tenantId, key) => `${tenantId || "null"}:${key}`;

// Minimal stand-in for the Mongoose model, just enough for utils/leadAssignment.js.
const fakeCursorModel = {
  findOne: async ({ tenantId, key }) => {
    const row = store.get(k(tenantId, key));
    return row ? { ...row } : null;
  },
  findOneAndUpdate: async ({ tenantId, key }, { $set }) => {
    const row = { tenantId, key, ...$set };
    store.set(k(tenantId, key), row);
    return { ...row };
  },
  updateOne: async ({ tenantId, key }, { $set }) => {
    const row = store.get(k(tenantId, key)) || { tenantId, key };
    Object.assign(row, $set);
    store.set(k(tenantId, key), row);
  },
};

// Redirect require("../models/AssignmentCursor") to the fake above.
const modelPath = path.join(__dirname, "../models/AssignmentCursor.js");
require.cache[require.resolve(modelPath)] = { id: modelPath, filename: modelPath, loaded: true, exports: fakeCursorModel };

const { nextBatchAssignee } = require("../utils/leadAssignment");

(async () => {
  // 2 leads to A, then 2 to B, repeating.
  const ids = ["A", "B"];
  const got = [];
  for (let i = 0; i < 8; i++) got.push(await nextBatchAssignee({ tenantId: "t1", key: "indiamart", assigneeIds: ids, batchSize: 2 }));
  assert.deepStrictEqual(got, ["A", "A", "B", "B", "A", "A", "B", "B"]);

  // batch size 1 = plain alternation.
  store.clear();
  const got1 = [];
  for (let i = 0; i < 5; i++) got1.push(await nextBatchAssignee({ tenantId: "t1", key: "indiamart", assigneeIds: ["A", "B", "C"], batchSize: 1 }));
  assert.deepStrictEqual(got1, ["A", "B", "C", "A", "B"]);

  // a single assignee never touches the cursor store.
  store.clear();
  assert.strictEqual(await nextBatchAssignee({ tenantId: "t1", key: "justdial", assigneeIds: ["A"], batchSize: 5 }), "A");
  assert.strictEqual(store.size, 0);

  // no assignees configured -> null (caller falls back to its own default).
  assert.strictEqual(await nextBatchAssignee({ tenantId: "t1", key: "justdial", assigneeIds: [], batchSize: 2 }), null);

  // changing the list (or the batch size) restarts from the first person.
  store.clear();
  await nextBatchAssignee({ tenantId: "t1", key: "facebook:p1", assigneeIds: ["A", "B"], batchSize: 2 }); // A, count=1
  await nextBatchAssignee({ tenantId: "t1", key: "facebook:p1", assigneeIds: ["A", "B"], batchSize: 2 }); // A, count->0, pos->1
  const afterEdit = await nextBatchAssignee({ tenantId: "t1", key: "facebook:p1", assigneeIds: ["B", "C"], batchSize: 3 });
  assert.strictEqual(afterEdit, "B");

  // separate tenants and separate integration keys never share a cursor.
  store.clear();
  await nextBatchAssignee({ tenantId: "t1", key: "indiamart", assigneeIds: ["A", "B"], batchSize: 1 });
  const other = await nextBatchAssignee({ tenantId: "t2", key: "indiamart", assigneeIds: ["A", "B"], batchSize: 1 });
  assert.strictEqual(other, "A"); // t2 starts fresh, unaffected by t1's position

  console.log("check-lead-assignment: all checks passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
