const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Subscription = require("../models/Subscription");

const MONGO_URI = process.env.MONGO_URI || process.argv[2];

if (!MONGO_URI) {
  console.error("❌ No MONGO_URI found. Pass it as: node scripts/createSkylyfUser.js <MONGO_URI>");
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected");

  const EMAIL = "skylyfexim@gmail.com";
  const PASSWORD = "Bag=11@11";
  const NAME = "Skylyf Exim";
  const SLUG = "skylyfexim";

  // Remove any existing user/tenant with same email/slug to avoid dupes
  const existingUser = await User.findOne({ email: EMAIL });
  if (existingUser) {
    const existingTenant = await Tenant.findOne({ ownerUser: existingUser._id });
    if (existingTenant) {
      await Subscription.deleteOne({ tenant: existingTenant._id });
      await Tenant.deleteOne({ _id: existingTenant._id });
    }
    await User.deleteOne({ _id: existingUser._id });
    console.log("🗑️  Removed existing user/tenant for clean re-create");
  }

  // 1. Create user
  const user = await User.create({
    name: NAME,
    email: EMAIL,
    password: PASSWORD,
    role: "admin",
    status: "active",
  });
  console.log("👤 User created:", user.email);

  // 2. Create tenant
  const now = new Date();
  const tenantExpiry = new Date(now);
  tenantExpiry.setFullYear(tenantExpiry.getFullYear() + 10);

  const tenant = await Tenant.create({
    name: NAME,
    slug: SLUG,
    ownerUser: user._id,
    plan: "enterprise",
    planExpiresAt: tenantExpiry,
    status: "active",
    limits: {
      leadsPerMonth: 99999,
      teamMembers: 999,
    },
  });
  console.log("🏢 Tenant created:", tenant.slug, "| expires:", tenantExpiry.toDateString());

  // Update user with tenantId
  await User.findByIdAndUpdate(user._id, { tenantId: tenant._id });

  // 3. Create subscription (10 years from now)
  const subEnd = new Date(now);
  subEnd.setFullYear(subEnd.getFullYear() + 10);

  await Subscription.create({
    tenant: tenant._id,
    plan: "enterprise",
    billingCycle: "yearly",
    status: "active",
    currentPeriodStart: now,
    currentPeriodEnd: subEnd,
  });
  console.log("💳 Subscription created: enterprise | 10 years | ends:", subEnd.toDateString());

  console.log("\n═══════════════════════════════════════════");
  console.log("  ✅ Skylyf Exim user ready!");
  console.log("  Email   :", EMAIL);
  console.log("  Password: Bag=11@11");
  console.log("  Role    : admin");
  console.log("  Plan    : enterprise (10 years)");
  console.log("═══════════════════════════════════════════");
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
