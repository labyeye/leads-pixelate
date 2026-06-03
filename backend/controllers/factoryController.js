const asyncHandler = require("express-async-handler");
const Reel = require("../models/Reel");
const FactoryProduct = require("../models/FactoryProduct");
const PrintingLog = require("../models/PrintingLog");
const logActivity = require("../utils/activityLogger");

const getInventory = asyncHandler(async (req, res) => {
  const tf = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const reels = await Reel.find(tf)
    .populate("enteredBy", "name email")
    .sort("-createdAt");

  res.json({ success: true, count: reels.length, data: reels });
});

const addReel = asyncHandler(async (req, res) => {
  const { company, reelWeight, reelSize, entryDate } = req.body;

  if (!company || !reelWeight || !reelSize) {
    res.status(400);
    throw new Error("company, reelWeight, and reelSize are required");
  }

  const reel = await Reel.create({
    company,
    reelWeight: parseFloat(reelWeight),
    reelSize,
    entryDate: entryDate || Date.now(),
    enteredBy: req.user._id,
    tenantId: req.user.tenantId || null,
  });

  const populated = await reel.populate("enteredBy", "name email");

  logActivity({
    user: req.user,
    action: "CREATE",
    module: "Inventory",
    description: `Added reel ${reel.reelNo} — ${reel.company} (${reel.reelWeight}kg)`,
    targetId: reel._id,
    ip: req.ip,
  });

  res.status(201).json({ success: true, data: populated });
});

const getFactoryProducts = asyncHandler(async (req, res) => {
  const tf = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const products = await FactoryProduct.find({ ...tf, isActive: true }).sort(
    "name",
  );
  res.json({ success: true, count: products.length, data: products });
});

const addFactoryProduct = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    res.status(400);
    throw new Error("Product name is required");
  }

  const product = await FactoryProduct.create({
    name,
    description,
    tenantId: req.user.tenantId || null,
  });
  res.status(201).json({ success: true, data: product });
});

const getPrintingLogs = asyncHandler(async (req, res) => {
  const tf = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  const logs = await PrintingLog.find(tf)
    .populate("reelNo", "reelNo company reelWeight reelSize")
    .populate("product", "name")
    .populate("printedBy", "name email")
    .sort("-createdAt");

  res.json({ success: true, count: logs.length, data: logs });
});

const addPrintingLog = asyncHandler(async (req, res) => {
  const { reelId, productId, printDate } = req.body;

  if (!reelId || !productId) {
    res.status(400);
    throw new Error("reelId and productId are required");
  }

  const reel = await Reel.findById(reelId);
  if (!reel) {
    res.status(404);
    throw new Error("Reel not found");
  }

  const product = await FactoryProduct.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const log = await PrintingLog.create({
    reelNo: reel._id,
    company: reel.company,
    reelWeight: reel.reelWeight,
    reelSize: reel.reelSize,
    reelNoStr: reel.reelNo,
    product: product._id,
    printDate: printDate || Date.now(),
    printedBy: req.user._id,
    tenantId: req.user.tenantId || null,
  });

  const populated = await PrintingLog.findById(log._id)
    .populate("reelNo", "reelNo company reelWeight reelSize")
    .populate("product", "name")
    .populate("printedBy", "name email");

  logActivity({
    user: req.user,
    action: "PRINT_LOGGED",
    module: "Printing",
    description: `Print batch logged: ${reel.reelNo} → ${product.name} by ${req.user.name}`,
    targetId: log._id,
    ip: req.ip,
  });

  res.status(201).json({ success: true, data: populated });
});

const getReports = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const matchStage = req.user.tenantId ? { tenantId: req.user.tenantId } : {};
  if (startDate || endDate) {
    matchStage.printDate = {};
    if (startDate) matchStage.printDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchStage.printDate.$lte = end;
    }
  }

  const [totalJobs, byCompany, byReel, byStaff] = await Promise.all([
    PrintingLog.countDocuments(matchStage),

    PrintingLog.aggregate([
      { $match: matchStage },
      { $group: { _id: "$company", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    PrintingLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$reelNoStr",
          company: { $first: "$company" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),

    PrintingLog.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "printedBy",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $group: {
          _id: "$user._id",
          name: { $first: "$user.name" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      totalJobs,
      byCompany,
      byReel,
      byStaff,
    },
  });
});

module.exports = {
  getInventory,
  addReel,
  getFactoryProducts,
  addFactoryProduct,
  getPrintingLogs,
  addPrintingLog,
  getReports,
};
