const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const rateLimit = require("express-rate-limit");
const Tenant = require("../models/Tenant");
const Lead = require("../models/Lead");
const User = require("../models/User");

// Strict rate limit — 60 submissions per IP per 15 min
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

const hashKey = (rawKey) =>
  crypto.createHash("sha256").update(rawKey).digest("hex");

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/public/leads
//
// Security model:
//   - Requires X-API-Key header with a valid nlk_live_* secret.
//   - The secret is NEVER stored — only its SHA-256 hash is in the DB.
//   - Without a valid key, no lead can be created and NO data is ever returned.
//   - GET /api/leads (and all other lead endpoints) require a JWT Bearer token
//     from the CRM — the public endpoint cannot be used to read any data.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/leads",
  publicLimiter,
  asyncHandler(async (req, res) => {
    // 1. Validate the API key header
    const rawKey = req.headers["x-api-key"];
    if (!rawKey || !rawKey.startsWith("nlk_live_")) {
      res.status(401);
      throw new Error("Missing or invalid API key");
    }

    const keyHash = hashKey(rawKey);

    // 2. Find the tenant whose key matches (hash comparison — constant time via DB index)
    const tenant = await Tenant.findOne({
      "apiKeys.keyHash": keyHash,
      "apiKeys.active": true,
    });

    if (!tenant) {
      res.status(401);
      throw new Error("Invalid or revoked API key");
    }

    // 3. Get the matched key config (fields + required rules)
    const matchedKey = tenant.apiKeys.find(
      (k) => k.keyHash === keyHash && k.active,
    );

    // 4. Always-required fields — every form must have these
    const body = req.body || {};
    const { name, phone } = body;

    if (!name || !String(name).trim()) {
      res.status(400);
      throw new Error("'name' is required");
    }
    if (!phone || !String(phone).trim()) {
      res.status(400);
      throw new Error("'phone' is required");
    }

    // 5. Validate owner-configured fields
    const configuredFields = matchedKey?.fields || [];
    for (const fieldDef of configuredFields) {
      if (fieldDef.required) {
        const value = body[fieldDef.key];
        if (!value || !String(value).trim()) {
          res.status(400);
          throw new Error(`'${fieldDef.label}' is required`);
        }
      }
    }

    // 6. Build the lead document from allowed fields only (whitelist — no arbitrary injection)
    const FIELD_MAP = {
      company: "company",
      email: "email",
      requirement: "requirement",
      budget: "budget",
      location: "location",
      product: "interestedProducts", // stored as array
    };

    const leadData = {
      name: String(name).trim(),
      phone: String(phone).trim(),
      source: "Website",
      status: "PENDING CONTACT",
      tenantId: tenant._id,
    };

    for (const fieldDef of configuredFields) {
      const modelKey = FIELD_MAP[fieldDef.key];
      const value = body[fieldDef.key];
      if (
        modelKey &&
        value !== undefined &&
        value !== null &&
        String(value).trim()
      ) {
        if (fieldDef.key === "product") {
          leadData[modelKey] = String(value)
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
        } else {
          leadData[modelKey] = String(value).trim();
        }
      }
    }

    // company & requirement are required in the Lead schema — provide defaults if not configured
    if (!leadData.company) leadData.company = "Not provided";
    if (!leadData.requirement) leadData.requirement = "Not provided";

    // 7. Auto-assign to first available team member
    const assignee = await User.findOne({
      tenantId: tenant._id,
      role: { $in: ["sales_executive", "admin", "super_admin"] },
      status: "active",
    });
    leadData.assignedTo = assignee?._id || null;

    // 8. Create the lead
    const lead = await Lead.create({
      ...leadData,
      statusHistory: [
        {
          status: "PENDING CONTACT",
          timestamp: new Date(),
          remarks: "Lead submitted via Website API",
        },
      ],
    });

    // 9. Update lastUsedAt (fire-and-forget, don't block the response)
    Tenant.updateOne(
      { _id: tenant._id, "apiKeys.keyHash": keyHash },
      { $set: { "apiKeys.$.lastUsedAt": new Date() } },
    ).catch(() => {});

    res.status(201).json({
      success: true,
      message: "Your enquiry has been submitted successfully.",
      data: { id: lead._id },
    });
  }),
);

// Block all other HTTP methods on public routes — no data can ever be read
router.all("*", (req, res) => {
  res.status(405).json({ success: false, message: "Method not allowed" });
});

module.exports = router;
