const mongoose = require("mongoose");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

const User = require("../models/User");
const Lead = require("../models/Lead");

async function importLeads() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Find the Skylyf user
    const skylyfUser = await User.findOne({
      email: "skylyfexim@gmail.com",
    });

    if (!skylyfUser) {
      console.error(
        "❌ Skylyf user not found. Please check if skylyfexim@gmail.com exists in the database.",
      );
      process.exit(1);
    }

    console.log(`✅ Found Skylyf user: ${skylyfUser.name} (${skylyfUser._id})`);
    console.log(
      `   Tenant ID: ${skylyfUser.tenantId || "NULL (will use null)"}`,
    );

    // Read the exported leads file
    const leadsFilePath = path.join(__dirname, "../../test.leads.json");
    const leadsData = JSON.parse(fs.readFileSync(leadsFilePath, "utf8"));

    console.log(`📊 Total leads to import: ${leadsData.length}`);

    // Transform and prepare leads
    const leadsToInsert = leadsData.map((lead, index) => {
      // Handle status conversion if needed
      let status = lead.status || "PENDING CONTACT";

      // Map old statuses to new ones if there are discrepancies
      const statusMap = {
        ALL: "PENDING CONTACT",
        UNSET: "PENDING CONTACT",
      };

      if (statusMap[status]) {
        status = statusMap[status];
      }

      // Handle contactTag - convert "UNSET" to null
      let contactTag = lead.contactTag || null;
      if (contactTag === "UNSET" || contactTag === "NONE") {
        contactTag = null;
      }

      return {
        name: lead.name,
        company: lead.company,
        source: lead.source || "Manual",
        phone: lead.phone,
        email: lead.email || "",
        requirement: lead.requirement || "",
        budget: lead.budget || "",
        remarks: lead.remarks || "",
        status: status,
        contactTag: contactTag,
        assignedTo: skylyfUser._id,
        tenantId: skylyfUser.tenantId || null,
        // Set indiamartQueryId to avoid E11000 duplicate key error on null values
        // Each lead gets a unique ID based on source + phone + index
        indiamartQueryId:
          lead.source === "IndiaMART"
            ? `${lead.phone}-${index}-${Date.now()}`
            : null,
        // Set facebookLeadgenId to unique value if not Facebook lead
        facebookLeadgenId:
          lead.source === "Facebook" ? lead.facebookLeadgenId || null : null,
        followUpDate: lead.followUpDate
          ? new Date(lead.followUpDate.$date)
          : null,
        visitScheduledDate: lead.visitScheduledDate
          ? new Date(lead.visitScheduledDate.$date)
          : null,
        visitActualDate: lead.visitActualDate
          ? new Date(lead.visitActualDate.$date)
          : null,
        interestedProducts: lead.interestedProducts || [],
        stagePath: lead.stagePath || ["PENDING CONTACT"],
        statusHistory: (lead.statusHistory || []).map((sh) => ({
          status: sh.status,
          timestamp: new Date(sh.timestamp.$date),
          changedBy: skylyfUser._id, // Use Skylyf user for all history
          remarks: sh.remarks || "",
        })),
        createdAt: lead.createdAt ? new Date(lead.createdAt.$date) : new Date(),
        updatedAt: lead.updatedAt ? new Date(lead.updatedAt.$date) : new Date(),
      };
    });

    // Check for actual duplicates within the import data itself
    // Duplicates only if BOTH phone AND source are the same
    const compositeKeySet = new Set();
    const duplicatesInData = [];

    for (const lead of leadsToInsert) {
      const compositeKey = `${lead.phone}::${lead.source}`;
      if (compositeKeySet.has(compositeKey)) {
        duplicatesInData.push({ phone: lead.phone, source: lead.source });
      }
      compositeKeySet.add(compositeKey);
    }

    if (duplicatesInData.length > 0) {
      console.warn(
        `⚠️ Found ${duplicatesInData.length} duplicate phone+source combinations in import data`,
      );
      console.warn(
        `   Examples: ${duplicatesInData
          .slice(0, 3)
          .map((d) => `${d.phone} (${d.source})`)
          .join(", ")}${duplicatesInData.length > 3 ? "..." : ""}`,
      );
    }

    // Filter out duplicates - keep only first occurrence of each phone+source combo
    const uniqueLeads = [];
    const seenCompositeKeys = new Set();

    for (const lead of leadsToInsert) {
      const compositeKey = `${lead.phone}::${lead.source}`;
      if (!seenCompositeKeys.has(compositeKey)) {
        uniqueLeads.push(lead);
        seenCompositeKeys.add(compositeKey);
      }
    }

    console.log(
      `📊 After deduplication: ${uniqueLeads.length} unique leads to insert (removed ${leadsToInsert.length - uniqueLeads.length})`,
    );

    console.log(`📋 Ready to import: ${uniqueLeads.length} leads`);

    // Insert leads in batches with error handling
    const batchSize = 100;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < uniqueLeads.length; i += batchSize) {
      const batch = uniqueLeads.slice(i, i + batchSize);
      try {
        const result = await Lead.insertMany(batch, { ordered: false });
        successCount += result.length;
        console.log(
          `✅ Batch ${Math.floor(i / batchSize) + 1}: Inserted ${result.length} leads (${successCount}/${uniqueLeads.length})`,
        );
      } catch (error) {
        // insertMany with ordered: false throws, but includes writeErrors
        if (error.writeErrors && error.writeErrors.length > 0) {
          const successInBatch = batch.length - error.writeErrors.length;
          successCount += successInBatch;
          failureCount += error.writeErrors.length;

          // Log what failed
          console.log(
            `✅ Batch ${Math.floor(i / batchSize) + 1}: Inserted ${successInBatch}, Failed ${error.writeErrors.length}`,
          );

          // Show first few errors in detail
          error.writeErrors.slice(0, 2).forEach((we) => {
            const leadData = batch[we.index];
            const err = we.error || {};
            console.warn(
              `   ⚠️ ${leadData?.name} (${leadData?.phone}): ${err.errmsg || err.message || "Validation error"}`,
            );
          });
          if (error.writeErrors.length > 2) {
            console.warn(
              `   + ${error.writeErrors.length - 2} more errors in this batch`,
            );
          }
        } else {
          console.error("Batch error:", error.message);
          throw error;
        }
      }
    }

    console.log(`
✅ Import completed!
📊 Successfully inserted: ${successCount} leads
❌ Failed to insert: ${failureCount} leads (likely duplicates already in DB)
👤 All assigned to: ${skylyfUser.name} (${skylyfUser.email})
    `);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error importing leads:", error.message);
    process.exit(1);
  }
}

importLeads();
