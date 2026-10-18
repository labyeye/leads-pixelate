const asyncHandler = require("express-async-handler");
const escapeRegex = require("../utils/escapeRegex");
const { tenantScope, safeBody } = require("../utils/tenantScope");
const Product = require("../models/Product");
const logActivity = require("../utils/activityLogger");

const getProducts = asyncHandler(async (req, res) => {
  const { category, status, search } = req.query;

  const query = {};

  if (req.user.tenantId) query.tenantId = req.user.tenantId;

  if (category) query.category = category;
  if (status) query.status = status;
  if (search) {
    query.name = { $regex: escapeRegex(search), $options: "i" };
  }

  const products = await Product.find(query).sort("-createdAt");

  res.json({
    success: true,
    count: products.length,
    data: products,
  });
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, ...tenantScope(req) });

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  res.json({
    success: true,
    data: product,
  });
});

const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create({
    ...req.body,
    tenantId: req.user.tenantId || null,
  });

  logActivity({
    user: req.user,
    action: "CREATE",
    module: "Product",
    description: `Created product: ${product.name}`,
    targetId: product._id,
    ip: req.ip,
  });

  res.status(201).json({
    success: true,
    data: product,
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  let product = await Product.findOne({ _id: req.params.id, ...tenantScope(req) });

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  product = await Product.findOneAndUpdate({ _id: req.params.id, ...tenantScope(req) }, safeBody(req.body), {
    new: true,
    runValidators: true,
  });

  logActivity({
    user: req.user,
    action: "UPDATE",
    module: "Product",
    description: `Updated product: ${product.name}`,
    targetId: product._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    data: product,
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, ...tenantScope(req) });

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  await Product.updateOne(
    { _id: product._id },
    { $set: { deletedAt: new Date(), deletedBy: req.user._id } },
  );

  logActivity({
    user: req.user,
    action: "DELETE",
    module: "Product",
    description: `Deleted product: ${product.name}`,
    targetId: product._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: "Product deleted successfully",
  });
});

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};
