const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Lead = require("../models/Lead");

async function cleanupDuplicates() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // First, let's see how many leads have null indiamartQueryId
    const nullQueryIdCount = await Lead.countDocuments({
      indiamartQueryId: null,
    });
    console.log(`📊 Leads with null indiamartQueryId: ${nullQueryIdCount}`);

    // Find duplicate leads and keep only the most recent
    console.log("🔄 Finding and removing duplicates...");

    const pipeline = [
      {
        $group: {
          _id: { name: "$name", company: "$company", phone: "$phone" },
          leads: { $push: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ];

    const duplicates = await Lead.aggregate(pipeline);
    console.log(`📊 Found ${duplicates.length} duplicate groups`);

    let deletedCount = 0;

    for (const dup of duplicates) {
      if (dup.leads.length > 1) {
        // Keep the latest one, delete others
        const leadIds = dup.leads.sort().slice(0, -1);
        const result = await Lead.deleteMany({ _id: { $in: leadIds } });
        deletedCount += result.deletedCount;
        console.log(
          `  Deleted ${result.deletedCount} duplicate(s) for: ${dup._id.name}`
        );
      }
    }

    console.log(`✅ Cleanup completed! Deleted ${deletedCount} duplicate leads`);

    // Final count
    const finalCount = await Lead.countDocuments();
    console.log(`📊 Total leads in database: ${finalCount}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error cleaning up duplicates:", error.message);
    process.exit(1);
  }
}

cleanupDuplicates();
