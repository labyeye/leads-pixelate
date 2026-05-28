require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const User = require("../models/User");

const OLD_TO_NEW_STATUS = {
  ALL: "PENDING CONTACT",
  "FOLLOW UP 1": "1",
  "FOLLOW UP 2": "2",
  "FOLLOW UP 3": "3",
  "FOLLOW UP 4": "COMPLETED",
  "FOLLOW UP 5": "COMPLETED",
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

function assignContactTag(lead) {
  if (lead.contactTag) return lead.contactTag;

  let score = 0;
  if (lead.budget && lead.budget > 50000) score += 3;
  if (lead.requirement) score += 2;
  if (lead.followUpDate) score += 1;
  if (lead.remarks) score += 1;

  if (score >= 5) return "HOT";
  if (score >= 2) return "WARM";
  return "COLD";
}

function convertStatus(oldStatus) {
  if (!oldStatus) return "PENDING CONTACT";
  const normalized = String(oldStatus).toUpperCase().trim();
  return OLD_TO_NEW_STATUS[normalized] || "PENDING CONTACT";
}

function normalizeStatusHistory(history, lead) {
  if (!Array.isArray(history) || history.length === 0) {
    return [
      {
        status: convertStatus(lead.status || "PENDING CONTACT"),
        timestamp: lead.createdAt || new Date(),
        changedBy: lead.assignedTo || null,
        remarks: `Migrated from old system (status: ${lead.status || "PENDING CONTACT"})`,
        budget: lead.budget || undefined,
        followUpDate: lead.followUpDate || undefined,
      },
    ];
  }

  const normalizedHistory = [];
  let lastStatus = null;

  for (const entry of history) {
    const migratedStatus = convertStatus(entry.status);

    if (migratedStatus === lastStatus) {
      continue;
    }

    normalizedHistory.push({
      ...entry,
      status: migratedStatus,
    });

    lastStatus = migratedStatus;
  }

  return normalizedHistory;
}

async function createStatusHistory(lead) {
  if (lead.statusHistory && lead.statusHistory.length > 0) {
    return normalizeStatusHistory(lead.statusHistory, lead);
  }

  return normalizeStatusHistory([], lead);
}

function createStagePath(lead) {
  if (lead.stagePath && lead.stagePath.length > 0) {
    const normalizedStagePath = lead.stagePath.map((status) =>
      convertStatus(status),
    );
    return normalizedStagePath.filter(
      (status, index, array) => array.indexOf(status) === index,
    );
  }

  const newStatus = convertStatus(lead.status);
  return ["PENDING CONTACT", newStatus].filter((v, i, a) => a.indexOf(v) === i);
}

const migrate = async () => {
  try {
    console.log("\n🚀 Starting Phase 2 Structure Migration...\n");

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("❌ MONGO_URI not found in environment.");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    const leads = await Lead.find({});
    console.log(`📊 Found ${leads.length} leads to migrate\n`);

    let updated = 0;
    let errors = 0;
    const updates = [];

    for (const lead of leads) {
      try {
        const newStatus = convertStatus(lead.status);

        const contactTag = assignContactTag(lead);

        const statusHistory = await createStatusHistory(lead);

        const stagePath = createStagePath(lead);

        const updateData = {
          status: newStatus,
          contactTag: contactTag,
          statusHistory: statusHistory,
          stagePath: stagePath,
        };

        await Lead.findByIdAndUpdate(lead._id, updateData, { new: true });
        updates.push({
          leadId: lead._id,
          name: lead.name,
          oldStatus: lead.status,
          newStatus: newStatus,
          tag: contactTag,
          stagePath: stagePath,
        });

        updated++;
      } catch (err) {
        errors++;
        console.error(`❌ Error migrating lead ${lead._id}:`, err.message);
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("📋 MIGRATION SUMMARY");
    console.log("=".repeat(70));
    console.log(`✅ Successfully migrated: ${updated} leads`);
    console.log(`❌ Errors encountered: ${errors}`);
    console.log(`📊 Total processed: ${leads.length}`);
    console.log("=".repeat(70));

    console.log("\n📝 SAMPLE CONVERSIONS (First 5 leads):\n");
    updates.slice(0, 5).forEach((u) => {
      console.log(`  Lead: ${u.name}`);
      console.log(
        `    Old Status: ${u.oldStatus} → New Status: ${u.newStatus}`,
      );
      console.log(`    Tag: ${u.tag}`);
      console.log(`    Path: ${u.stagePath.join(" → ")}`);
      console.log("");
    });

    const statusCounts = {};
    updates.forEach((u) => {
      statusCounts[u.newStatus] = (statusCounts[u.newStatus] || 0) + 1;
    });

    console.log("📊 LEADS BY NEW STATUS:\n");
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} leads`);
    });

    const tagCounts = {};
    updates.forEach((u) => {
      tagCounts[u.tag] = (tagCounts[u.tag] || 0) + 1;
    });

    console.log("\n🏷️  LEADS BY TAG:\n");
    Object.entries(tagCounts).forEach(([tag, count]) => {
      const pct = ((count / updated) * 100).toFixed(1);
      console.log(`  ${tag}: ${count} leads (${pct}%)`);
    });

    console.log("\n✅ Migration complete!\n");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
};

migrate();
