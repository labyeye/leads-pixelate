const SupportTicket = require("../models/SupportTicket");
const { pushTicket } = require("../utils/finalPixelatePush");

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
    pushTicket(ticket); // fire-and-forget: shows up in final-pixelate's shared support inbox
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/support/:id — owner can edit while the ticket is still untouched by support (open,
// no replies). Once support has picked it up, editing would yank context out from under them.
const updateTicket = async (req, res) => {
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

    if (ticket.status !== "open" || ticket.replies.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Ticket can no longer be edited — support has already started working on it",
      });
    }

    const { subject, description, priority } = req.body;
    if (subject !== undefined) ticket.subject = subject;
    if (description !== undefined) ticket.description = description;
    if (priority !== undefined) ticket.priority = priority;
    await ticket.save();

    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/support/:id — same "not yet picked up" guard as updateTicket.
const deleteTicket = async (req, res) => {
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

    if (ticket.status !== "open" || ticket.replies.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Ticket can no longer be deleted — support has already started working on it",
      });
    }

    await ticket.deleteOne();
    res.json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/support/webhook/:id — called by final-pixelate when its support team replies to, or
// changes the status of, a ticket pushed from here. No JWT: guarded by a shared secret instead.
const NL_STATUS = { new: "open", in_progress: "in_progress", resolved: "resolved", closed: "closed" };
const webhookUpdate = async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || apiKey !== process.env.FINAL_PIXELATE_SECRET) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const { status, message, senderName } = req.body;
    if (status && NL_STATUS[status]) {
      ticket.status = NL_STATUS[status];
      if (ticket.status === "resolved" && !ticket.resolvedAt) ticket.resolvedAt = new Date();
    }
    if (message && String(message).trim()) {
      ticket.replies.push({
        message: String(message).trim(),
        from: "platform",
        senderName: senderName || "Pixelate Nest Support",
      });
    }
    await ticket.save();

    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getTickets, getTicket, createTicket, updateTicket, deleteTicket, webhookUpdate };
