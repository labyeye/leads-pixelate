// Nest Leads side of utils/crmAccounts.js.
module.exports = require("./crmTenantAdapter")({
  label: "Organisation",
  Tenant: require("../models/Tenant"),
  User: require("../models/User"),
  ownerRole: "super_admin",
  defaultRole: "sales_executive",
  limitFields: [
    { key: "leadsPerMonth", label: "Leads per month", path: "limits.leadsPerMonth" },
    { key: "teamMembers", label: "Team members", path: "limits.teamMembers" },
  ],
  defaultLimits: { leadsPerMonth: 1000, teamMembers: 5 },
  usage: (t, users) => `${t.usage?.leadsThisMonth || 0} / ${t.limits?.leadsPerMonth ?? "—"} leads · ${users} / ${t.limits?.teamMembers ?? "—"} users`,
});
