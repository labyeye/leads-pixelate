const crypto = require("crypto");

// Justdial has no self-serve pull API — leads arrive via a webhook their
// business support team configures to POST to a URL we provide, once a
// seller requests API access. The exact payload shape isn't publicly
// documented and can vary by account, so mapJDLeadToModel() reads
// leniently across the field names most commonly seen in JD webhook
// samples shared by third-party CRMs, rather than assuming one fixed
// schema.

function pickField(body, candidates) {
  for (const key of candidates) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== "") {
      return body[key];
    }
  }
  return "";
}

function generateWebhookToken() {
  return crypto.randomBytes(20).toString("hex");
}

function mapJDLeadToModel(body, defaultAssignedTo) {
  const name = pickField(body, ["name", "cust_name", "customer_name", "caller_name", "lead_name"]) || "Justdial Caller";
  const phone = pickField(body, ["mobile", "phone", "cust_mobile", "contact_no", "caller_number"]) || "0000000000";
  const leadId = pickField(body, ["lead_id", "leadid", "id", "call_id", "enquiry_id"]);
  const email = pickField(body, ["email", "cust_email"]) || `${leadId || Date.now()}@justdial.noreply`;
  const company = pickField(body, ["company", "company_name", "business_name"]) || "Not Provided";
  const requirement = pickField(body, ["message", "requirement", "product", "category", "enquiry"]) || "Justdial enquiry";
  const city = pickField(body, ["city", "cust_city"]);
  const state = pickField(body, ["state", "cust_state"]);
  const dateStr = pickField(body, ["date", "call_date", "created_at", "timestamp"]);
  const leadTime = dateStr ? new Date(dateStr) : new Date();
  const validTime = isNaN(leadTime.getTime()) ? new Date() : leadTime;

  return {
    name,
    company,
    phone,
    email,
    location: city,
    state,
    remarks: "",
    source: "Justdial",
    requirement,
    status: "PENDING CONTACT",
    assignedTo: defaultAssignedTo,
    justdialLeadId: leadId ? String(leadId) : undefined,
    statusHistory: [
      {
        status: "PENDING CONTACT",
        timestamp: validTime,
        remarks: "Received via Justdial webhook",
      },
    ],
    createdAt: validTime,
  };
}

module.exports = { generateWebhookToken, mapJDLeadToModel, pickField };
