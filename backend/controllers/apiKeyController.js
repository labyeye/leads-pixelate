const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const Tenant = require("../models/Tenant");

const hashKey = (rawKey) =>
  crypto.createHash("sha256").update(rawKey).digest("hex");

// POST /api/api-keys
const generateApiKey = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error("Key name is required");
  }

  const tenant = await Tenant.findById(req.user.tenantId);
  if (!tenant) {
    res.status(404);
    throw new Error("Tenant not found");
  }

  if (tenant.apiKeys && tenant.apiKeys.length >= 10) {
    res.status(400);
    throw new Error("Maximum of 10 API keys allowed");
  }

  const rawKey = "nlk_live_" + crypto.randomBytes(32).toString("hex");
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.substring(0, 16); // "nlk_live_" + 7 chars

  tenant.apiKeys.push({ name: name.trim(), keyHash, keyPrefix });
  await tenant.save();

  const newKey = tenant.apiKeys[tenant.apiKeys.length - 1];

  res.status(201).json({
    success: true,
    data: {
      id: newKey._id,
      name: newKey.name,
      key: rawKey, // shown only once
      keyPrefix,
      createdAt: newKey.createdAt,
    },
  });
});

// GET /api/api-keys
const listApiKeys = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.user.tenantId).select("apiKeys");
  if (!tenant) {
    res.status(404);
    throw new Error("Tenant not found");
  }

  const keys = (tenant.apiKeys || []).map((k) => ({
    id: k._id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    active: k.active,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
  }));

  res.json({ success: true, data: keys });
});

// DELETE /api/api-keys/:id
const revokeApiKey = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.user.tenantId);
  if (!tenant) {
    res.status(404);
    throw new Error("Tenant not found");
  }

  const key = tenant.apiKeys.id(req.params.id);
  if (!key) {
    res.status(404);
    throw new Error("API key not found");
  }

  key.active = false;
  await tenant.save();

  res.json({ success: true, message: "API key revoked" });
});

module.exports = { generateApiKey, listApiKeys, revokeApiKey };
