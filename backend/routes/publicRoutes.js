const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const rateLimit = require("express-rate-limit");
const Tenant = require("../models/Tenant");
const Lead = require("../models/Lead");
const User = require("../models/User");

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});

const hashKey = (rawKey) =>
  crypto.createHash("sha256").update(rawKey).digest("hex");

// POST /api/public/leads
// Authenticated via X-API-Key header (no JWT needed)
router.post(
  "/leads",
  publicLimiter,
  asyncHandler(async (req, res) => {
    const rawKey = req.headers["x-api-key"];
    if (!rawKey || !rawKey.startsWith("nlk_live_")) {
      res.status(401);
      throw new Error("Missing or invalid API key");
    }

    const keyHash = hashKey(rawKey);

    const tenant = await Tenant.findOne({
      "apiKeys.keyHash": keyHash,
      "apiKeys.active": true,
    });

    if (!tenant) {
      res.status(401);
      throw new Error("Invalid or revoked API key");
    }

    // Update lastUsedAt for the matched key
    await Tenant.updateOne(
      { _id: tenant._id, "apiKeys.keyHash": keyHash },
      { $set: { "apiKeys.$.lastUsedAt": new Date() } },
    );

    const { name, phone, email, company, requirement, message } = req.body;

    if (!name || !phone || !company || !(requirement || message)) {
      res.status(400);
      throw new Error("name, phone, company, and requirement are required");
    }

    // Auto-assign to first available sales_executive or admin
    const assignee = await User.findOne({
      tenantId: tenant._id,
      role: { $in: ["sales_executive", "admin", "super_admin"] },
      status: "active",
    });

    const lead = await Lead.create({
      name,
      phone,
      email: email || "",
      company,
      requirement: requirement || message,
      source: "Website",
      status: "PENDING CONTACT",
      tenantId: tenant._id,
      assignedTo: assignee?._id || null,
      statusHistory: [
        {
          status: "PENDING CONTACT",
          timestamp: new Date(),
          remarks: "Lead submitted via API",
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Lead submitted successfully",
      data: { id: lead._id },
    });
  }),
);

module.exports = router;
