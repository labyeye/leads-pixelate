const asyncHandler = require("express-async-handler");
const Product = require("../models/Product");
const logActivity = require("../utils/activityLogger");

const getProducts = asyncHandler(async (req, res) => {
  const { category, status, search } = req.query;

  const query = {};

  if (category) query.category = category;
  if (status) query.status = status;
  if (search) {
    query.name = { $regex: search, $options: "i" };
  }

  const products = await Product.find(query).sort("-createdAt");

  res.json({
    success: true,
    count: products.length,
    data: products,
  });
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

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
  const product = await Product.create(req.body);

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
  let product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  product = await Product.findByIdAndUpdate(req.params.id, req.body, {
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
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  await Product.findByIdAndDelete(req.params.id);

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
