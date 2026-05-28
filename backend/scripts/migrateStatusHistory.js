require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const mongoose = require("mongoose");
const path = require("path");
const Lead = require("../models/Lead");
const ActivityLog = require("../models/ActivityLog");

const STAGES = {
  STAGE1: ["ALL", "FOLLOW UP 1", "FOLLOW UP 2", "FOLLOW UP 3"],
  STAGE2: ["CONTACTED"],
  STAGE3: ["QUALIFIED", "NEED QUOTATION", "VISITING", "REMINDER"],
  STAGE4: ["VISITED", "QUOTATION SENT"],
  STAGE5: ["WON", "DROP"],
};

const CANONICAL_STATUS = {
  "FOLLOWUP 1": "FOLLOW UP 1",
  "FOLLOWUP 2": "FOLLOW UP 2",
  "FOLLOWUP 3": "FOLLOW UP 3",
  "VISITING SOON": "VISITING",
  CONVERTED: "WON",
};

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

const getCanonical = (s) => {
  if (!s) return "";
  const cleaned = s.trim().toUpperCase();
  return CANONICAL_STATUS[cleaned] || cleaned;
};

const convertToNewStatus = (status) => {
  if (!status) return "PENDING CONTACT";
  const normalized = String(status).toUpperCase().trim();
  return OLD_TO_NEW_STATUS[normalized] || normalized;
};

const migrate = async () => {
  try {
    console.log("🚀 Starting Lead Status History Reconstruction...");

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI not found in environment.");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const leads = await Lead.find({});
    console.log(`📊 Processing ${leads.length} leads...`);

    let totalUpdated = 0;

    for (const lead of leads) {
      const logs = await ActivityLog.find({
        targetId: lead._id.toString(),
        module: "Lead",
        action: {
          $in: ["CREATE", "STATUS_UPDATED", "UPDATE", "LEAD_CONVERTED"],
        },
      }).sort({ timestamp: 1 });

      const milestones = new Map();

      const inquiryTimestamp =
        lead.inquiryDate || lead.indiamartQueryTime || lead.createdAt;
      milestones.set("ALL", {
        status: "ALL",
        timestamp: inquiryTimestamp,
        remarks: "Initial Inquiry (Auto-Backfilled)",
        source: "milestone",
      });

      logs.forEach((log) => {
        let status = "";
        let remark = "Status change (Migrated)";

        if (log.action === "CREATE") {
          status = "ALL";
          remark = "Lead created";
        } else if (log.action === "STATUS_UPDATED") {
          const desc = log.description || "";
          const match = desc.match(
            /Updated status .* to ([A-Z0-9 ]+?)(?: with remark: (.*))?$/i,
          );
          if (match) {
            status = getCanonical(match[1].trim());
            remark = match[2] ? match[2].trim() : "Updated status";
          } else {
            const simpleMatch = desc.match(/Status changed to ([A-Z0-9 ]+)/i);
            if (simpleMatch) status = getCanonical(simpleMatch[1].trim());
          }
        } else if (log.action === "LEAD_CONVERTED") {
          status = "WON";
          remark = "Converted to Client";
        }

        if (status) {
          const allValidStatuses = Object.values(STAGES).flat();
          if (allValidStatuses.includes(status)) {
            if (
              !milestones.has(status) ||
              milestones.get(status).timestamp > log.timestamp
            ) {
              milestones.set(status, {
                status: status,
                timestamp: log.timestamp,
                remarks: remark,
                changedBy: log.user,
                source: "log",
              });
            }
          }
        }
      });

      const currentStatus = getCanonical(lead.status);
      if (currentStatus && !milestones.has(currentStatus)) {
        milestones.set(currentStatus, {
          status: currentStatus,
          timestamp: lead.updatedAt || new Date(),
          remarks: "Current status (Auto-reconstructed)",
          changedBy: lead.assignedTo,
          source: "current",
        });
      }

      const ensurePrerequisite = (target, prereq, timeRefStatus = null) => {
        if (milestones.has(target) && !milestones.has(prereq)) {
          const refTime = milestones.get(timeRefStatus || target).timestamp;
          milestones.set(prereq, {
            status: prereq,
            timestamp: new Date(refTime.getTime() - 10 * 60 * 1000),
            remarks: `Backfilled prerequisite for ${target}`,
            source: "backfill",
          });
          return true;
        }
        return false;
      };

      ensurePrerequisite("FOLLOW UP 3", "FOLLOW UP 2");
      ensurePrerequisite("FOLLOW UP 2", "FOLLOW UP 1");
      ensurePrerequisite("FOLLOW UP 1", "ALL");

      if (milestones.has("WON")) {
        ensurePrerequisite("WON", "QUOTATION SENT");
        ensurePrerequisite("QUOTATION SENT", "VISITED");
      }

      if (milestones.has("VISITED") || milestones.has("QUOTATION SENT")) {
        const hasStage3 = STAGES.STAGE3.some((s) => milestones.has(s));
        if (!hasStage3) {
          const nextTime = milestones.get(
            milestones.has("VISITED") ? "VISITED" : "QUOTATION SENT",
          ).timestamp;
          milestones.set("QUALIFIED", {
            status: "QUALIFIED",
            timestamp: new Date(nextTime.getTime() - 10 * 60 * 1000),
            remarks: "Backfilled Stage 3 progression",
            source: "backfill",
          });
        }
      }

      const hasStage3Now = STAGES.STAGE3.some((s) => milestones.has(s));
      if (hasStage3Now) {
        const earliestStage3 = STAGES.STAGE3.filter((s) =>
          milestones.has(s),
        ).sort(
          (a, b) => milestones.get(a).timestamp - milestones.get(b).timestamp,
        )[0];

        ensurePrerequisite(earliestStage3, "CONTACTED");
      }

      if (milestones.has("CONTACTED")) {
        ensurePrerequisite("CONTACTED", "ALL");
      }

      if (milestones.has("DROP")) {
        const hadFollowUps = logs.some((l) =>
          (l.description || "").toUpperCase().includes("FOLLOW UP"),
        );
        if (hadFollowUps || getCanonical(lead.status).includes("FOLLOW UP")) {
          ensurePrerequisite("DROP", "FOLLOW UP 3");
          ensurePrerequisite("FOLLOW UP 3", "FOLLOW UP 2");
          ensurePrerequisite("FOLLOW UP 2", "FOLLOW UP 1");
        }
      }

      let history = Array.from(milestones.values()).sort(
        (a, b) => a.timestamp - b.timestamp,
      );

      const uniqueHistory = [];
      const seenStatuses = new Set();

      for (let i = 0; i < history.length; i++) {
        const entry = history[i];
        const migratedStatus = convertToNewStatus(entry.status);

        if (!seenStatuses.has(migratedStatus)) {
          if (uniqueHistory.length > 0) {
            const prev = uniqueHistory[uniqueHistory.length - 1];
            if (entry.timestamp <= prev.timestamp) {
              entry.timestamp = new Date(prev.timestamp.getTime() + 1000);
            }
          }
          uniqueHistory.push({
            status: migratedStatus,
            timestamp: entry.timestamp,
            changedBy: entry.changedBy || lead.assignedTo,
            remarks: entry.remarks,
          });
          seenStatuses.add(migratedStatus);
        }
      }

      lead.status = convertToNewStatus(lead.status);
      lead.statusHistory = uniqueHistory;
      await lead.save();
      totalUpdated++;

      if (totalUpdated % 20 === 0) {
        process.stdout.write(
          `⏳ Progress: ${totalUpdated}/${leads.length} leads updated...\r`,
        );
      }
    }

    console.log(`\n🎉 Migration Complete! Updated ${totalUpdated} leads.`);
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Migration failed:");
    console.error(err);
    process.exit(1);
  }
};

migrate();
