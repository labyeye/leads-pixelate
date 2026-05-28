require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Lead = require("../models/Lead");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) =>
  new Promise((resolve) => rl.question(prompt, resolve));

const objectIdFields = new Set(["_id", "assignedTo", "addedBy", "changedBy"]);
const dateFields = new Set([
  "createdAt",
  "updatedAt",
  "followUpDate",
  "visitScheduledDate",
  "visitActualDate",
  "indiamartQueryTime",
  "timestamp",
  "addedAt",
]);

const hydrateRestoreValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => hydrateRestoreValue(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const hydrated = {};

  for (const [field, fieldValue] of Object.entries(value)) {
    if (dateFields.has(field)) {
      hydrated[field] = fieldValue ? new Date(fieldValue) : fieldValue;
      continue;
    }

    if (objectIdFields.has(field)) {
      hydrated[field] =
        typeof fieldValue === "string" &&
        mongoose.Types.ObjectId.isValid(fieldValue)
          ? new mongoose.Types.ObjectId(fieldValue)
          : fieldValue;
      continue;
    }

    hydrated[field] = hydrateRestoreValue(fieldValue);
  }

  return hydrated;
};

const restoreLeads = async () => {
  try {
    console.log("\n🔄 Starting Lead Data Restore from Backup...\n");

    let backupFile = process.argv[2];

    if (!backupFile) {
      const backupsDir = path.join(__dirname, "../backups");
      if (fs.existsSync(backupsDir)) {
        const files = fs
          .readdirSync(backupsDir)
          .filter((f) => f.startsWith("backup_leads_") && f.endsWith(".json"))
          .sort()
          .reverse();

        if (files.length > 0) {
          console.log("📁 Available backups:");
          files.forEach((f, i) => {
            const filepath = path.join(backupsDir, f);
            const size = (fs.statSync(filepath).size / 1024).toFixed(2);
            console.log(`  ${i + 1}. ${f} (${size} KB)`);
          });
          const choice = await question(
            "\nSelect backup number (1-" + files.length + "): ",
          );
          backupFile = files[parseInt(choice) - 1];
        }
      }

      if (!backupFile) {
        throw new Error("No backup file specified and none found");
      }
    }

    const backupsDir = path.join(__dirname, "../backups");
    const filepath = path.join(backupsDir, backupFile);

    if (!fs.existsSync(filepath)) {
      throw new Error(`❌ Backup file not found: ${filepath}`);
    }

    console.log(`📂 Reading backup: ${backupFile}\n`);

    const backupData = JSON.parse(fs.readFileSync(filepath, "utf-8"));
    const { metadata, statistics, leads } = backupData;

    console.log("📋 BACKUP INFORMATION:");
    console.log(`  Date: ${metadata.backupDate}`);
    console.log(`  Total Leads: ${metadata.totalLeads}`);
    console.log(`  Version: ${metadata.scriptVersion}\n`);

    const confirm = await question(
      `⚠️  This will restore ${leads.length} leads. Continue? (yes/no): `,
    );

    if (confirm.toLowerCase() !== "yes") {
      console.log("❌ Restore cancelled");
      process.exit(0);
    }

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("❌ MONGO_URI not found in environment.");
    }

    await mongoose.connect(mongoUri);
    console.log("\n✅ Connected to MongoDB");

    const currentLeads = await Lead.find({});
    const currentBackupFile = path.join(
      backupsDir,
      `backup_before_restore_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)}.json`,
    );
    fs.writeFileSync(
      currentBackupFile,
      JSON.stringify(
        {
          metadata: {
            type: "pre-restore-backup",
            date: new Date().toISOString(),
          },
          leads: currentLeads,
        },
        null,
        2,
      ),
    );
    console.log(`💾 Created safety backup: backup_before_restore_*.json`);

    await Lead.deleteMany({});
    console.log(`\n🗑️  Cleared existing leads`);

    console.log("📥 Restoring leads...");
    let restored = 0;
    let errors = 0;

    const restoreDocs = leads.map((leadData) => hydrateRestoreValue(leadData));

    try {
      const result = await Lead.collection.insertMany(restoreDocs, {
        ordered: false,
      });

      restored = result.insertedCount || restoreDocs.length;
    } catch (err) {
      if (err && Array.isArray(err.writeErrors)) {
        errors = err.writeErrors.length;
        restored = restoreDocs.length - errors;

        err.writeErrors.slice(0, 25).forEach((writeError) => {
          const failedLead = restoreDocs[writeError.index] || {};
          console.error(
            `  ❌ Error restoring lead: ${failedLead.name || "Unknown"}`,
            writeError.errmsg || writeError.message,
          );
        });

        if (err.writeErrors.length > 25) {
          console.error(
            `  ...and ${err.writeErrors.length - 25} more restore errors`,
          );
        }
      } else {
        throw err;
      }
    }

    console.log(`\n✅ Restored: ${restored} leads`);
    if (errors > 0) {
      console.log(`❌ Errors: ${errors} leads`);
    }

    const restoredCount = await Lead.countDocuments({});
    console.log(`\n📊 Verification: ${restoredCount} leads now in database`);

    console.log("\n" + "=".repeat(70));
    console.log("✅ Restore complete!");
    console.log(
      "💡 Tip: If something went wrong, the previous data is in 'backup_before_restore_*.json'",
    );
    console.log("=".repeat(70) + "\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Restore failed:", err);
    process.exit(1);
  } finally {
    rl.close();
  }
};

restoreLeads();
