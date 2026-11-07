const Tenant = require("../models/Tenant");
const User = require("../models/User");
const CelebrationLog = require("../models/CelebrationLog");
const { notify } = require("../controllers/whatsappController");

// Daily 09:00 IST: birthday + marriage-anniversary wishes to each tenant's TEAM on the tenant's own WhatsApp
// (never to leads). A tenant opts in by switching "Team member birthday" / "Team member marriage anniversary"
// on in WhatsApp automations and picking its own approved template: {{1}} name, {{2}} company.
async function runCelebrations(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const month = ist.getUTCMonth() + 1;
  const day = ist.getUTCDate();
  const year = ist.getUTCFullYear();
  const tenants = await Tenant.find({ "integrations.whatsapp.isConnected": true });
  for (const t of tenants) {
    const auto = t.integrations?.whatsapp?.automations || {};
    for (const [event, field] of [
      ["team_birthday", "dateOfBirth"],
      ["team_anniversary", "marriageAnniversary"],
    ]) {
      if (!auto[event]?.enabled) continue;
      const team = await User.find({
        tenantId: t._id,
        status: "active",
        phone: { $exists: true, $ne: "" },
        [field]: { $ne: null },
        $expr: {
          $and: [
            { $eq: [{ $month: `$${field}` }, month] },
            { $eq: [{ $dayOfMonth: `$${field}` }, day] },
          ],
        },
      }).select("name phone");
      for (const u of team) {
        const key = { tenantId: t._id, ref: String(u._id), kind: event, year };
        try {
          await CelebrationLog.create(key); // throws 11000 if already sent
        } catch (e) {
          if (e.code === 11000) continue;
          throw e;
        }
        const sent = await notify(t._id, event, u.phone, [u.name.split(" ")[0], t.name || "us"]);
        if (!sent) await CelebrationLog.deleteOne(key); // not sent: allow a retry on the next run
      }
    }
  }
}

module.exports = { runCelebrations };
