const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { getTickets, getTicket, createTicket } = require("../controllers/supportController");

router.use(protect);

router.get("/", getTickets);
router.get("/:id", getTicket);
router.post("/", createTicket);

module.exports = router;
