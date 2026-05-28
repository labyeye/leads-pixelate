const asyncHandler = require("express-async-handler");
const Client = require("../models/Client");
const logActivity = require("../utils/activityLogger");

const getClients = asyncHandler(async (req, res) => {
  const {
    projectStatus,
    paymentStatus,
    search,
    page = 1,
    limit = 50,
  } = req.query;

  const query = {};

  if (projectStatus) query.projectStatus = projectStatus;
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { company: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [clients, total] = await Promise.all([
    Client.find(query).sort("-createdAt").skip(skip).limit(parseInt(limit)),
    Client.countDocuments(query),
  ]);

  res.json({
    success: true,
    count: clients.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: clients,
  });
});

const getClient = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id).populate("convertedFrom");

  if (!client) {
    res.status(404);
    throw new Error("Client not found");
  }

  res.json({
    success: true,
    data: client,
  });
});

const createClient = asyncHandler(async (req, res) => {
  const client = await Client.create(req.body);

  logActivity({
    user: req.user,
    action: "CREATE",
    module: "Client",
    description: `Created client: ${client.name} (${client.company || ""})`,
    targetId: client._id,
    ip: req.ip,
  });

  res.status(201).json({
    success: true,
    data: client,
  });
});

const updateClient = asyncHandler(async (req, res) => {
  let client = await Client.findById(req.params.id);

  if (!client) {
    res.status(404);
    throw new Error("Client not found");
  }

  client = await Client.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  logActivity({
    user: req.user,
    action: "UPDATE",
    module: "Client",
    description: `Updated client: ${client.name}`,
    targetId: client._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    data: client,
  });
});

const deleteClient = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id);

  if (!client) {
    res.status(404);
    throw new Error("Client not found");
  }

  await Client.findByIdAndDelete(req.params.id);

  logActivity({
    user: req.user,
    action: "DELETE",
    module: "Client",
    description: `Deleted client: ${client.name}`,
    targetId: client._id,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: "Client deleted successfully",
  });
});

module.exports = {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
};
