const express = require("express");
const router = express.Router();
const {
  checkApiKey,
  getLeads,
  getLeadStats,
  getClients,
  getTickets,
  getTicket,
  createTicket,
  replyToTicket,
  updateTicket,
} = require("../controllers/hrmsController");

router.use(checkApiKey);

// Leads
router.get("/leads", getLeads);
router.get("/leads/stats", getLeadStats);

// Clients
router.get("/clients", getClients);

// Support tickets
router.get("/support", getTickets);
router.get("/support/:id", getTicket);
router.post("/support", createTicket);
router.post("/support/:id/reply", replyToTicket);
router.patch("/support/:id", updateTicket);

module.exports = router;
