const asyncHandler = require("express-async-handler");
const escapeRegex = require("../utils/escapeRegex");
const { tenantScope, safeBody } = require("../utils/tenantScope");
const Quotation = require("../models/Quotation");
const Setting = require("../models/Setting");
const logActivity = require("../utils/activityLogger");
const { notify } = require("./whatsappController");
const qa = require("../utils/quotationApproval");

function notifyQuotationSent(user, quotation) {
  notify(user.tenantId, "quotation_sent", quotation.mobile, [
    quotation.clientName,
    quotation.number,
    quotation.projectTitle,
    quotation.total.toLocaleString("en-IN"),
  ]);
}

const getQuotations = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.query;

  const query = {};

  if (req.user.tenantId) query.tenantId = req.user.tenantId;

  if (status) query.status = status;
  if (search) {
    query.$or = [
      { number: { $regex: escapeRegex(search), $options: "i" } },
      { clientName: { $regex: escapeRegex(search), $options: "i" } },
      { projectTitle: { $regex: escapeRegex(search), $options: "i" } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [quotations, total] = await Promise.all([
    Quotation.find(query)
      .populate("createdBy", "name email")
      .populate("approval.decidedBy", "name")
      .sort("-createdAt")
      .skip(skip)
      .limit(parseInt(limit)),
    Quotation.countDocuments(query),
  ]);

  res.json({
    success: true,
    count: quotations.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: quotations,
  });
});

const getQuotation = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findOne({ _id: req.params.id, ...tenantScope(req) }).populate(
    "createdBy",
    "name email",
  );

  if (!quotation) {
    res.status(404);
    throw new Error("Quotation not found");
  }

  res.json({
    success: true,
    data: quotation,
  });
});

const createQuotation = asyncHandler(async (req, res) => {
  req.body.createdBy = req.user._id;
  req.body.tenantId = req.user.tenantId || null;
  delete req.body.approval; // server-controlled

  const cfg = await qa.getConfig(req.user.tenantId);
  if (qa.required(cfg, req.body.total, req.user._id)) {
    req.body.approval = qa.pending(cfg, req.user._id);
    if (req.body.status === "Sent") req.body.status = "Draft";
  }

  const quotation = await Quotation.create(req.body);

  const populated = await Quotation.findById(quotation._id).populate(
    "createdBy",
    "name email",
  );

  logActivity({
    user: req.user,
    action: "CREATE",
    module: "Quotation",
    description: `Created quotation ${populated?.number || ""} for ${populated?.companyName || populated?.clientName || "buyer"}`,
    targetId: quotation._id,
    ip: req.ip,
  });

  if (populated.status === "Sent") notifyQuotationSent(req.user, populated);

  res.status(201).json({
    success: true,
    data: populated,
  });
});

const updateQuotation = asyncHandler(async (req, res) => {
  let quotation = await Quotation.findOne({ _id: req.params.id, ...tenantScope(req) });

  if (!quotation) {
    res.status(404);
    throw new Error("Quotation not found");
  }

  if (["Approved", "Rejected"].includes(quotation.status) && !req.body.status) {
    res.status(400);
    throw new Error("Cannot edit an approved or rejected quotation");
  }

  const wasSent = quotation.status === "Sent";

  delete req.body.approval; // server-controlled
  const cfg = await qa.getConfig(req.user.tenantId);
  const cur = quotation.approval?.status || "none";
  const norm = (list) => JSON.stringify((list || []).map((x) => [x.name, Number(x.price), Number(x.quantity)]));
  const changed =
    (req.body.services && norm(req.body.services) !== norm(quotation.services)) ||
    (req.body.discount != null && Number(req.body.discount) !== Number(quotation.discount));
  const needs = qa.required(cfg, req.body.total ?? quotation.total, req.user._id);
  // Changing the amounts after a decision (or on an older quotation) asks the approvers again.
  const reask = needs && changed && cur !== "pending";
  const goingSent = req.body.status === "Sent" && !wasSent;
  const effective = reask ? "pending" : cur;

  if (needs && goingSent && effective !== "approved") {
    if (reask || cur === "none") {
      await Quotation.updateOne(
        { _id: quotation._id },
        { $set: { approval: qa.pending(cfg, req.user._id) } },
      );
    }
    res.status(403);
    throw new Error(
      effective === "rejected"
        ? "This quotation was rejected by an approver. Edit it to ask again."
        : "Approval is needed before sending. The request has gone to the approvers.",
    );
  }
  if (reask) req.body.approval = qa.pending(cfg, req.user._id);

  quotation = await Quotation.findOneAndUpdate({ _id: req.params.id, ...tenantScope(req) }, safeBody(req.body), {
    new: true,
    runValidators: true,
  }).populate("createdBy", "name email");

  if (quotation.status === "Sent" && !wasSent)
    notifyQuotationSent(req.user, quotation);

  logActivity({
    user: req.user,
    action: "UPDATE",
    module: "Quotation",
    description: `Updated quotation ${quotation.number} — status: ${quotation.status}`,
    targetId: quotation._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    data: quotation,
  });
});

// An approver says yes or no. Body: { decision: "approve" | "reject", remarks }.
const decideApproval = asyncHandler(async (req, res) => {
  const { decision, remarks = "" } = req.body || {};
  if (!["approve", "reject"].includes(decision)) {
    res.status(400);
    throw new Error("Choose approve or reject");
  }
  const quotation = await Quotation.findOne({ _id: req.params.id, ...tenantScope(req) });
  if (!quotation) {
    res.status(404);
    throw new Error("Quotation not found");
  }
  if (quotation.approval?.status !== "pending") {
    res.status(400);
    throw new Error("This quotation isn't waiting for approval");
  }
  const cfg = await qa.getConfig(req.user.tenantId);
  const allowed = new Set([...(quotation.approval.approvers || []).map(String), ...cfg.approvers]);
  if (!allowed.has(String(req.user._id))) {
    res.status(403);
    throw new Error("You are not an approver for quotations");
  }
  if (decision === "reject" && !String(remarks).trim()) {
    res.status(400);
    throw new Error("Please give a reason for rejecting");
  }

  await Quotation.updateOne(
    { _id: quotation._id },
    {
      $set: {
        "approval.status": decision === "approve" ? "approved" : "rejected",
        "approval.decidedBy": req.user._id,
        "approval.decidedAt": new Date(),
        "approval.remarks": String(remarks).trim().slice(0, 500),
      },
    },
  );

  logActivity({
    user: req.user,
    action: "UPDATE",
    module: "Quotation",
    description: `${decision === "approve" ? "Approved" : "Rejected"} quotation ${quotation.number}${
      remarks ? ` — ${String(remarks).trim().slice(0, 200)}` : ""
    }`,
    targetId: quotation._id,
    ip: req.ip,
  });

  const fresh = await Quotation.findById(quotation._id)
    .populate("createdBy", "name email")
    .populate("approval.decidedBy", "name");
  res.json({ success: true, data: fresh });
});

const deleteQuotation = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findOne({ _id: req.params.id, ...tenantScope(req) });

  if (!quotation) {
    res.status(404);
    throw new Error("Quotation not found");
  }

  if (quotation.status === "Approved") {
    res.status(400);
    throw new Error("Cannot delete an approved quotation");
  }

  await Quotation.updateOne(
    { _id: quotation._id },
    { $set: { deletedAt: new Date(), deletedBy: req.user._id } },
  );

  logActivity({
    user: req.user,
    action: "DELETE",
    module: "Quotation",
    description: `Deleted quotation ${quotation.number}`,
    targetId: quotation._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: "Quotation deleted successfully",
  });
});

module.exports = {
  getQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  decideApproval,
  deleteQuotation,
};
