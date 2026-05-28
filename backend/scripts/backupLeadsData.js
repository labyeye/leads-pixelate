require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Lead = require("../models/Lead");

const backupLeads = async () => {
  try {
    console.log("\n🚀 Starting Lead Data Backup...\n");

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("❌ MONGO_URI not found in environment.");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const backupsDir = path.join(__dirname, "../backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
      console.log("📁 Created backups directory");
    }

    const leads = await Lead.find({});

    console.log(`\n📊 Fetched ${leads.length} leads from database`);

    const backupData = {
      metadata: {
        backupDate: new Date().toISOString(),
        backupTime: new Date().toLocaleString(),
        totalLeads: leads.length,
        databaseUri: mongoUri.replace(/:[^:]*@/, ":****@"),
        mongooseVersion: mongoose.version,
        scriptVersion: "1.0",
        description: "Complete lead data backup before Phase 2 migration",
      },
      statistics: {
        byStatus: {},
        byContactTag: {},
        bySource: {},
        byAssignee: {},
        totalBudget: 0,
        averageBudget: 0,
        oldestLead: null,
        newestLead: null,
      },
      leads: leads.map((lead) => ({
        _id: lead._id,
        name: lead.name,
        company: lead.company,
        status: lead.status,
        contactTag: lead.contactTag || "UNSET",
        source: lead.source,
        phone: lead.phone,
        email: lead.email,
        requirement: lead.requirement,
        budget: lead.budget,
        remarks: lead.remarks,
        followUpDate: lead.followUpDate,
        visitScheduledDate: lead.visitScheduledDate,
        visitActualDate: lead.visitActualDate,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        assignedTo: lead.assignedTo,
        statusHistory: lead.statusHistory || [],
        stagePath: lead.stagePath || [],
        tags: lead.tags || [],
        interestedProducts: lead.interestedProducts || [],
        notes: lead.notes || [],
      })),
    };

    leads.forEach((lead) => {
      const status = lead.status || "UNKNOWN";
      backupData.statistics.byStatus[status] =
        (backupData.statistics.byStatus[status] || 0) + 1;

      const tag = lead.contactTag || "UNSET";
      backupData.statistics.byContactTag[tag] =
        (backupData.statistics.byContactTag[tag] || 0) + 1;

      const source = lead.source || "Unknown";
      backupData.statistics.bySource[source] =
        (backupData.statistics.bySource[source] || 0) + 1;

      if (lead.assignedTo) {
        const assigneeName = lead.assignedTo.name || "Unknown";
        backupData.statistics.byAssignee[assigneeName] =
          (backupData.statistics.byAssignee[assigneeName] || 0) + 1;
      }

      if (lead.budget) {
        backupData.statistics.totalBudget += lead.budget;
      }

      if (
        !backupData.statistics.oldestLead ||
        lead.createdAt < backupData.statistics.oldestLead.createdAt
      ) {
        backupData.statistics.oldestLead = {
          name: lead.name,
          createdAt: lead.createdAt,
        };
      }
      if (
        !backupData.statistics.newestLead ||
        lead.createdAt > backupData.statistics.newestLead.createdAt
      ) {
        backupData.statistics.newestLead = {
          name: lead.name,
          createdAt: lead.createdAt,
        };
      }
    });

    if (leads.length > 0) {
      const leadsWithBudget = leads.filter((l) => l.budget);
      if (leadsWithBudget.length > 0) {
        backupData.statistics.averageBudget =
          backupData.statistics.totalBudget / leadsWithBudget.length;
      }
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `backup_leads_${timestamp}.json`;
    const filepath = path.join(backupsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), "utf-8");
    console.log(`\n✅ Backup saved to: ${filepath}`);

    console.log("\n" + "=".repeat(70));
    console.log("📋 BACKUP SUMMARY");
    console.log("=".repeat(70));
    console.log(`📊 Total Leads: ${backupData.statistics.totalBudget}`);
    console.log(
      `💰 Total Budget: ₹${backupData.statistics.totalBudget.toLocaleString("en-IN")}`,
    );
    console.log(
      `💵 Average Budget: ₹${backupData.statistics.averageBudget.toLocaleString(
        "en-IN",
        {
          maximumFractionDigits: 0,
        },
      )}`,
    );

    console.log("\n📊 LEADS BY STATUS:");
    Object.entries(backupData.statistics.byStatus)
      .sort(([, a], [, b]) => b - a)
      .forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });

    console.log("\n🏷️  LEADS BY CONTACT TAG:");
    Object.entries(backupData.statistics.byContactTag).forEach(
      ([tag, count]) => {
        console.log(`  ${tag}: ${count}`);
      },
    );

    console.log("\n📍 LEADS BY SOURCE:");
    Object.entries(backupData.statistics.bySource)
      .sort(([, a], [, b]) => b - a)
      .forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`);
      });

    if (Object.keys(backupData.statistics.byAssignee).length > 0) {
      console.log("\n👥 LEADS BY ASSIGNEE:");
      Object.entries(backupData.statistics.byAssignee)
        .sort(([, a], [, b]) => b - a)
        .forEach(([assignee, count]) => {
          console.log(`  ${assignee}: ${count}`);
        });
    }

    if (backupData.statistics.oldestLead) {
      console.log("\n⏰ TIMELINE:");
      console.log(
        `  Oldest Lead: ${backupData.statistics.oldestLead.name} (${new Date(
          backupData.statistics.oldestLead.createdAt,
        ).toLocaleDateString()})`,
      );
      console.log(
        `  Newest Lead: ${backupData.statistics.newestLead.name} (${new Date(
          backupData.statistics.newestLead.createdAt,
        ).toLocaleDateString()})`,
      );
    }

    console.log("\n" + "=".repeat(70));
    console.log(
      "✅ Backup complete! File size: " +
        (fs.statSync(filepath).size / 1024).toFixed(2) +
        " KB",
    );
    console.log(
      "📝 Next step: Run 'npm run migrate:phase2' to start the migration",
    );
    console.log("💾 Backup stored in: backups/ folder for recovery if needed");
    console.log("=".repeat(70) + "\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Backup failed:", err);
    process.exit(1);
  }
};

backupLeads();
