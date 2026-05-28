require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const ActivityLog = require("../models/ActivityLog");
const User = require("../models/User");

const OLD_TO_NEW_STATUS = {
  ALL: "PENDING CONTACT",
  "FOLLOW UP 1": "1",
  "FOLLOW UP 2": "2",
  "FOLLOW UP 3": "3",
  CONTACTED: "1",
  QUALIFIED: "2",
  "NEED QUOTATION": "DISCUSSION",
  VISITING: "VISIT SCHEDULED",
  REMINDER: "DISCUSSION",
  VISITED: "VISITED",
  "QUOTATION SENT": "QUOTATION",
  WON: "WON",
  DROP: "DROP",
  CONVERTED: "WON",
  "PENDING CONTACT": "PENDING CONTACT",
  1: "1",
  2: "2",
  3: "3",
  COMPLETED: "COMPLETED",
  DISCUSSION: "DISCUSSION",
  QUOTATION: "QUOTATION",
  "VISIT SCHEDULED": "VISIT SCHEDULED",
};

function convertStatus(oldStatus) {
  if (!oldStatus) return "PENDING CONTACT";
  const normalized = String(oldStatus).toUpperCase().trim();
  return OLD_TO_NEW_STATUS[normalized] || "PENDING CONTACT";
}

const updateStatusHistory = async () => {
  try {
    console.log("\n🚀 Starting Status History Update...\n");

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("❌ MONGO_URI not found in environment.");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    const leads = await Lead.find({});
    console.log(`📊 Found ${leads.length} leads to process\n`);

    let updated = 0;
    let completed = 0;
    let errors = 0;
    const updates = [];

    for (const lead of leads) {
      try {
        console.log(`\n📝 Processing: ${lead.name}`);

        let currentStatus = lead.status;
        const createdDate = lead.createdAt || new Date();
        let statusChanged = false;

        if (
          currentStatus &&
          String(currentStatus).toUpperCase().includes("FOLLOW UP 4")
        ) {
          currentStatus = "COMPLETED";
          statusChanged = true;
          completed++;
          console.log(`   ⚠️  FOLLOW UP 4 → COMPLETED`);
        }

        const newStatus = convertStatus(currentStatus);

        const statusHistory = [];

        statusHistory.push({
          status: "PENDING CONTACT",
          timestamp: createdDate,
          changedBy: lead.assignedTo || null,
          remarks: "Lead created",
        });

        if (newStatus !== "PENDING CONTACT") {
          statusHistory.push({
            status: newStatus,
            timestamp: new Date(),
            changedBy: lead.assignedTo || null,
            remarks: "Current status",
          });
        }

        const updateData = {
          statusHistory: statusHistory,
        };

        if (statusChanged) {
          updateData.status = "COMPLETED";
        }

        await Lead.findByIdAndUpdate(lead._id, updateData, { new: true });

        console.log(
          `   ✅ Updated with ${statusHistory.length} history entries`,
        );
        console.log(
          `   Path: ${statusHistory.map((h) => h.status).join(" → ")}`,
        );

        updates.push({
          leadId: lead._id,
          name: lead.name,
          historyEntries: statusHistory.length,
          path: statusHistory.map((h) => h.status).join(" → "),
          statusConverted: statusChanged,
        });

        updated++;
      } catch (err) {
        errors++;
        console.error(`   ❌ Error processing lead ${lead.name}:`, err.message);
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("📋 STATUS HISTORY UPDATE SUMMARY");
    console.log("=".repeat(70));
    console.log(`✅ Successfully updated: ${updated} leads`);
    console.log(`⚠️  Converted FOLLOW UP 4 → COMPLETED: ${completed} leads`);
    console.log(`❌ Errors encountered: ${errors}`);
    console.log(`📊 Total processed: ${leads.length}`);
    console.log("=".repeat(70));

    if (updates.length > 0) {
      console.log("\n📝 SAMPLE UPDATES (First 5 leads):\n");
      updates.slice(0, 5).forEach((u) => {
        console.log(`  Lead: ${u.name}`);
        console.log(`    History Entries: ${u.historyEntries}`);
        console.log(`    Path: ${u.path}`);
        if (u.statusConverted) {
          console.log(`    ⚠️  Status converted from FOLLOW UP 4`);
        }
        console.log("");
      });
    }

    const statusCounts = {};
    const allLeads = await Lead.find({});
    allLeads.forEach((lead) => {
      const currentStatus = lead.status || "UNKNOWN";
      statusCounts[currentStatus] = (statusCounts[currentStatus] || 0) + 1;
    });

    console.log("📊 FINAL STATUS DISTRIBUTION:\n");
    Object.entries(statusCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([status, count]) => {
        const pct = ((count / allLeads.length) * 100).toFixed(1);
        console.log(`  ${status}: ${count} leads (${pct}%)`);
      });

    console.log("\n✅ Status history update complete!\n");
    process.exit(0);
  } catch (err) {
    console.error("❌ Update failed:", err);
    process.exit(1);
  }
};

updateStatusHistory();
