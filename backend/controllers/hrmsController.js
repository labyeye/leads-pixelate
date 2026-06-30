const Lead = require("../models/Lead");
const Client = require("../models/Client");
const SupportTicket = require("../models/SupportTicket");

// API key guard — every request must carry x-api-key matching HRMS_API_SECRET
const checkApiKey = (req, res, next) => {
  const key = req.headers["x-api-key"];
  if (!process.env.HRMS_API_SECRET || key !== process.env.HRMS_API_SECRET) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
};

// ─── LEADS ────────────────────────────────────────────────────────────────────

// GET /api/hrms/leads
// Optional filters: ?status=WON|DROP|PENDING+CONTACT  ?source=IndiaMART  ?from=YYYY-MM-DD  ?to=YYYY-MM-DD
const getLeads = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.source) filter.source = req.query.source;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const leads = await Lead.find(filter)
      .select(
        "name company phone email location state source status contactTag requirement budget followUpDate createdAt updatedAt"
      )
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: leads.length, data: leads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/hrms/leads/stats
const getLeadStats = async (req, res) => {
  try {
    const [statusBreakdown, sourceBreakdown, tagBreakdown, total] =
      await Promise.all([
        Lead.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Lead.aggregate([
          { $group: { _id: "$source", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Lead.aggregate([
          { $match: { contactTag: { $ne: null } } },
          { $group: { _id: "$contactTag", count: { $sum: 1 } } },
        ]),
        Lead.countDocuments(),
      ]);

    res.json({
      success: true,
      data: { total, statusBreakdown, sourceBreakdown, tagBreakdown },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── CLIENTS ──────────────────────────────────────────────────────────────────

// GET /api/hrms/clients
// Optional filter: ?projectStatus=Active|Completed|On+Hold  ?paymentStatus=Paid|Pending|Overdue
const getClients = async (req, res) => {
  try {
    const filter = {};
    if (req.query.projectStatus) filter.projectStatus = req.query.projectStatus;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;

    const clients = await Client.find(filter)
      .select(
        "name company phone email address businessType gst services projectStatus paymentStatus createdAt updatedAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: clients.length, data: clients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── SUPPORT TICKETS ──────────────────────────────────────────────────────────

// GET /api/hrms/support
// Optional filter: ?status=open|in_progress|resolved|closed  ?raisedBy=hrms|crm
const getTickets = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.raisedBy) filter.raisedBy = req.query.raisedBy;

    const tickets = await SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: tickets.length, data: tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/hrms/support/:id
const getTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({
      $or: [{ _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null }, { ticketId: req.params.id }],
    });
    if (!ticket)
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/hrms/support
// Body: { subject, description, priority, raisedBy, companyName, contactEmail, contactPhone }
const createTicket = async (req, res) => {
  try {
    const {
      subject,
      description,
      priority,
      raisedBy,
      companyName,
      contactEmail,
      contactPhone,
    } = req.body;

    if (!subject || !description || !raisedBy) {
      return res.status(400).json({
        success: false,
        message: "subject, description, and raisedBy are required",
      });
    }

    const ticket = await SupportTicket.create({
      subject,
      description,
      priority,
      raisedBy,
      companyName,
      contactEmail,
      contactPhone,
    });

    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/hrms/support/:id/reply
// Body: { message, from, senderName }
const replyToTicket = async (req, res) => {
  try {
    const { message, from, senderName } = req.body;
    if (!message || !from) {
      return res
        .status(400)
        .json({ success: false, message: "message and from are required" });
    }

    const ticket = await SupportTicket.findOne({
      $or: [
        {
          _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null,
        },
        { ticketId: req.params.id },
      ],
    });

    if (!ticket)
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });

    ticket.replies.push({ message, from, senderName });
    if (ticket.status === "open") ticket.status = "in_progress";
    await ticket.save();

    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/hrms/support/:id
// Body: { status, priority }
const updateTicket = async (req, res) => {
  try {
    const { status, priority } = req.body;
    const update = {};
    if (status) {
      update.status = status;
      if (status === "resolved") update.resolvedAt = new Date();
    }
    if (priority) update.priority = priority;

    const ticket = await SupportTicket.findOneAndUpdate(
      {
        $or: [
          {
            _id: req.params.id.match(/^[a-f\d]{24}$/i)
              ? req.params.id
              : null,
          },
          { ticketId: req.params.id },
        ],
      },
      update,
      { new: true }
    );

    if (!ticket)
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });

    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  checkApiKey,
  getLeads,
  getLeadStats,
  getClients,
  getTickets,
  getTicket,
  createTicket,
  replyToTicket,
  updateTicket,
};
