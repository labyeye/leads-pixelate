const express = require("express");
const router = express.Router();
const {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  addNote,
  convertToClient,
  connectIndiamart,
  disconnectIndiamart,
  syncFromIndiamart,
  getIndiamartSyncStatus,
  indiamartWebhook,
  getStatusHistoryReport,
  updateIndiamartSettings,
} = require("../controllers/leadController");
const { protect, authorize } = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");

router.post("/indiamart/webhook", indiamartWebhook);

router.use(protect);
router.get(
  "/indiamart/status",
  authorize("super_admin", "admin"),
  getIndiamartSyncStatus,
);
router.post(
  "/indiamart/connect",
  authorize("super_admin", "admin"),
  connectIndiamart,
);
router.post(
  "/indiamart/disconnect",
  authorize("super_admin", "admin"),
  disconnectIndiamart,
);
router.post(
  "/indiamart/sync",
  authorize("super_admin", "admin"),
  syncFromIndiamart,
);
router.post(
  "/indiamart/settings",
  authorize("super_admin", "admin"),
  updateIndiamartSettings,
);

router.get(
  "/tradeindia/status",
  authorize("super_admin", "admin"),
  (req, res) => {
    res.json({
      success: true,
      data: {
        configured: false,
        message:
          "TradeIndia integration not configured. Contact support to enable.",
      },
    });
  },
);
router.post(
  "/tradeindia/sync",
  authorize("super_admin", "admin"),
  (req, res) => {
    res.status(400).json({
      success: false,
      message:
        "TradeIndia integration is not configured yet. Please contact support to set up the API key.",
    });
  },
);

router.get(
  "/justdial/status",
  authorize("super_admin", "admin"),
  (req, res) => {
    res.json({
      success: true,
      data: {
        configured: false,
        message:
          "Justdial integration not configured. Contact support to enable.",
      },
    });
  },
);
router.post("/justdial/sync", authorize("super_admin", "admin"), (req, res) => {
  res.status(400).json({
    success: false,
    message:
      "Justdial integration is not configured yet. Please contact support to set up the API key.",
  });
});

router.get("/reports/status-history", getStatusHistoryReport);
router.route("/").get(getLeads).post(createLead);

router
  .route("/:id")
  .get(getLead)
  .put(updateLead)
  .delete(checkPermission("Leads", "delete"), deleteLead);

router.post("/:id/notes", addNote);
router.post(
  "/:id/convert",
  checkPermission("Leads", "update"),
  convertToClient,
);

module.exports = router;
