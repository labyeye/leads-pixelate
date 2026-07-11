const SupportTicket = require("../models/SupportTicket");

// GET /api/support
// Logged-in CRM users see tickets raised from within the CRM (raisedBy: "crm"),
// scoped to their own tenant.
const getTickets = async (req, res) => {
  try {
    const filter = { raisedBy: "crm" };
    if (req.user.tenantId) filter.tenantId = req.user.tenantId;
    if (req.query.status) filter.status = req.query.status;

    const tickets = await SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: tickets.length, data: tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/support/:id
const getTicket = async (req, res) => {
  try {
    const filter = { raisedBy: "crm" };
    if (req.user.tenantId) filter.tenantId = req.user.tenantId;
    if (req.params.id.match(/^[a-f\d]{24}$/i)) {
      filter._id = req.params.id;
    } else {
      filter.ticketId = req.params.id;
    }

    const ticket = await SupportTicket.findOne(filter);
    if (!ticket)
      return res.status(404).json({ success: false, message: "Ticket not found" });

    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/support
// Body: { subject, description, priority }
const createTicket = async (req, res) => {
  try {
    const { subject, description, priority } = req.body;

    if (!subject || !description) {
      return res.status(400).json({
        success: false,
        message: "subject and description are required",
      });
    }

    const ticket = await SupportTicket.create({
      subject,
      description,
      priority,
      raisedBy: "crm",
      tenantId: req.user.tenantId || null,
      companyName: req.user.name || "",
      contactEmail: req.user.email || "",
      contactPhone: req.user.phone || "",
    });

    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getTickets, getTicket, createTicket };
