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
