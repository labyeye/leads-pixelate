// Quotation approval: the account admin picks who approves (any user, not only admins) in
// Settings > Quotation Approval. Quotations made by anyone else wait for one of those people
// before they can be sent. Approvers' own quotations skip the queue.
const Setting = require("../models/Setting");

async function getConfig(tenantId) {
  const s = await Setting.findOne({ tenantId: tenantId || null })
    .select("quotationApproval")
    .lean();
  const c = s?.quotationApproval || {};
  return {
    enabled: !!c.enabled,
    minTotal: Number(c.minTotal) || 0,
    approvers: (c.approvers || []).map(String),
  };
}

// Does a quotation of this total, made by this user, need sign-off?
function required(cfg, total, userId) {
  return (
    cfg.enabled &&
    cfg.approvers.length > 0 &&
    Number(total || 0) >= cfg.minTotal &&
    !cfg.approvers.includes(String(userId))
  );
}

const pending = (cfg, userId) => ({
  status: "pending",
  approvers: cfg.approvers,
  requestedBy: userId,
  requestedAt: new Date(),
  decidedBy: null,
  decidedAt: null,
  remarks: "",
});

// Sending is blocked while a request is open or was turned down.
function sendBlock(q) {
  const st = q?.approval?.status;
  if (st === "pending")
    return "This quotation is waiting for approval and can't be sent yet.";
  if (st === "rejected")
    return "This quotation was rejected by an approver. Edit it to ask again.";
  return null;
}

module.exports = { getConfig, required, pending, sendBlock };
