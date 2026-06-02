const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Lead = require("../models/Lead");

async function fixIndices() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Drop all indices on Lead collection
    console.log("🔄 Dropping existing indices...");
    await Lead.collection.dropIndexes();
    console.log("✅ All indices dropped");

    // Recreate the schema indices
    console.log("🔄 Recreating indices...");
    await Lead.collection.createIndex(
      { name: "text", company: "text", email: "text" },
      {}
    );
    await Lead.collection.createIndex({ status: 1 });
    await Lead.collection.createIndex({ assignedTo: 1 });
    await Lead.collection.createIndex({ source: 1 });
    await Lead.collection.createIndex({ createdAt: -1 });

    // Fix: Use sparse index that only indexes non-null values
    await Lead.collection.createIndex(
      { indiamartQueryId: 1 },
      { sparse: true, unique: true }
    );

    // Fix: Use sparse index that only indexes non-null values
    await Lead.collection.createIndex(
      { facebookLeadgenId: 1 },
      { sparse: true, unique: true }
    );

    await Lead.collection.createIndex({ tenantId: 1 });

    console.log("✅ Indices recreated successfully!");

    // Verify
    const indices = await Lead.collection.getIndexes();
    console.log("\n📋 Current indices:");
    console.log(JSON.stringify(indices, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing indices:", error.message);
    process.exit(1);
  }
}

fixIndices();
