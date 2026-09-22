// Pushes a NestLeads support ticket to final-pixelate's shared support inbox, so the Pixelate
// Nest team can see and reply to it from one place (mirrors what HRMS already does). Best effort:
// silently no-ops when the two env vars aren't set, and never throws into the caller.
const log = require("./logger").scope("FinalPixelate");

const isConfigured = () => !!(process.env.FINAL_PIXELATE_URL && process.env.FINAL_PIXELATE_SECRET);

async function pushTicket(ticket) {
  if (!isConfigured()) return;
  try {
    const res = await fetch(`${process.env.FINAL_PIXELATE_URL}/api/nestleads/support-tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.FINAL_PIXELATE_SECRET },
      body: JSON.stringify({
        nestleadsTicketId: ticket._id.toString(),
        ticketNumber: ticket.ticketId,
        companyName: ticket.companyName,
        submittedBy: ticket.contactEmail,
        subject: ticket.subject,
        priority: ticket.priority,
        description: ticket.description,
        status: ticket.status === "open" ? "new" : ticket.status,
        createdAt: ticket.createdAt,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) log.warn("Push to final-pixelate failed", { status: res.status });
  } catch (err) {
    log.warn("Push to final-pixelate errored", { message: err.message });
  }
}

module.exports = { pushTicket, isConfigured };
