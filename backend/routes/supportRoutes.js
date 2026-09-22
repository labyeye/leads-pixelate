const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { getTickets, getTicket, createTicket, webhookUpdate } = require("../controllers/supportController");

// Called by final-pixelate (no JWT, uses x-api-key) — must be mounted before router.use(protect).
router.post("/webhook/:id", webhookUpdate);

router.use(protect);

router.get("/", getTickets);
router.get("/:id", getTicket);
router.post("/", createTicket);

module.exports = router;
