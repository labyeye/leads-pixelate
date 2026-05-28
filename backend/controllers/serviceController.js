const asyncHandler = require("express-async-handler");
const Service = require("../models/Service");
const logActivity = require("../utils/activityLogger");

const getServices = asyncHandler(async (req, res) => {
  const { status, client, product } = req.query;

  const query = {};

  if (status) query.status = status;
  if (client) query.allocatedClient = client;
  if (product) query.product = product;

  const services = await Service.find(query)
    .populate("assignedTo", "name email")
    .populate("allocatedClient", "name company")
    .populate("product", "name category price description")
    .sort("-createdAt");

  res.json({
    success: true,
    count: services.length,
    data: services,
  });
});

const getService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id)
    .populate("assignedTo", "name email")
    .populate("allocatedClient", "name company")
    .populate("product", "name category price description");

  if (!service) {
    res.status(404);
    throw new Error("Service allocation not found");
  }

  res.json({
    success: true,
    data: service,
  });
});

const createService = asyncHandler(async (req, res) => {
  const service = await Service.create(req.body);

  const populated = await Service.findById(service._id)
    .populate("assignedTo", "name email")
    .populate("allocatedClient", "name company")
    .populate("product", "name category price description");

  logActivity({
    user: req.user,
    action: "CREATE",
    module: "Service",
    description: `Created service allocation`,
    targetId: service._id,
    ip: req.ip,
  });

  res.status(201).json({
    success: true,
    data: populated,
  });
});

const updateService = asyncHandler(async (req, res) => {
  let service = await Service.findById(req.params.id);

  if (!service) {
    res.status(404);
    throw new Error("Service allocation not found");
  }

  service = await Service.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  })
    .populate("assignedTo", "name email")
    .populate("allocatedClient", "name company")
    .populate("product", "name category price description");

  logActivity({
    user: req.user,
    action: "UPDATE",
    module: "Service",
    description: `Updated service allocation`,
    targetId: service._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    data: service,
  });
});

const deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);

  if (!service) {
    res.status(404);
    throw new Error("Service allocation not found");
  }

  await Service.findByIdAndDelete(req.params.id);

  logActivity({
    user: req.user,
    action: "DELETE",
    module: "Service",
    description: `Deleted service allocation`,
    targetId: service._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: "Service Allocation deleted successfully",
  });
});

module.exports = {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
};
