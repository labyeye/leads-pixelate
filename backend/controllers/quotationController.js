const asyncHandler = require("express-async-handler");
const Quotation = require("../models/Quotation");
const Setting = require("../models/Setting");
const logActivity = require("../utils/activityLogger");
const { sendTextNotification } = require("./whatsappController");

async function notifyQuotationSent(user, quotation) {
  if (!quotation.mobile) return;
  const setting = await Setting.findOne({ tenantId: user.tenantId || null });
  const source = setting?.quotationWhatsappSource || "tenant";
  const message = `Hi ${quotation.clientName}, your quotation ${quotation.number} for "${quotation.projectTitle}" (₹${quotation.total.toLocaleString("en-IN")}) has been sent. Please check your email/download link for details. Thank you!`;
  sendTextNotification(user, quotation.mobile, message, source);
}

const getQuotations = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.query;

  const query = {};

  if (req.user.tenantId) query.tenantId = req.user.tenantId;

  if (status) query.status = status;
  if (search) {
    query.$or = [
      { number: { $regex: search, $options: "i" } },
      { clientName: { $regex: search, $options: "i" } },
      { projectTitle: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [quotations, total] = await Promise.all([
    Quotation.find(query)
      .populate("createdBy", "name email")
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
  const quotation = await Quotation.findById(req.params.id).populate(
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
  let quotation = await Quotation.findById(req.params.id);

  if (!quotation) {
    res.status(404);
    throw new Error("Quotation not found");
  }

  if (["Approved", "Rejected"].includes(quotation.status) && !req.body.status) {
    res.status(400);
    throw new Error("Cannot edit an approved or rejected quotation");
  }

  const wasSent = quotation.status === "Sent";

  quotation = await Quotation.findByIdAndUpdate(req.params.id, req.body, {
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

const deleteQuotation = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id);

  if (!quotation) {
    res.status(404);
    throw new Error("Quotation not found");
  }

  if (quotation.status === "Approved") {
    res.status(400);
    throw new Error("Cannot delete an approved quotation");
  }

  await Quotation.findByIdAndDelete(req.params.id);

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
  deleteQuotation,
};
