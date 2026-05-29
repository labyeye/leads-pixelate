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
  syncFromIndiamart,
  getIndiamartSyncStatus,
  indiamartWebhook,
} = require("../controllers/leadController");
const { protect, authorize } = require("../middleware/auth");

router.post("/indiamart/webhook", indiamartWebhook);

router.use(protect);
router.get(
  "/indiamart/status",
  authorize("super_admin", "admin"),
  getIndiamartSyncStatus,
);
router.post(
  "/indiamart/sync",
  authorize("super_admin", "admin"),
  syncFromIndiamart,
);

// TradeIndia stub — replace handler when integration is ready
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
    res
      .status(400)
      .json({
        success: false,
        message:
          "TradeIndia integration is not configured yet. Please contact support to set up the API key.",
      });
  },
);

// Justdial stub — replace handler when integration is ready
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
  res
    .status(400)
    .json({
      success: false,
      message:
        "Justdial integration is not configured yet. Please contact support to set up the API key.",
    });
});

router.route("/").get(getLeads).post(createLead);

router
  .route("/:id")
  .get(getLead)
  .put(updateLead)
  .delete(authorize("super_admin", "admin"), deleteLead);

router.post("/:id/notes", addNote);
router.post(
  "/:id/convert",
  authorize("super_admin", "admin", "sales_executive"),
  convertToClient,
);

module.exports = router;
