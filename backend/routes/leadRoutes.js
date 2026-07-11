const express = require("express");
const router = express.Router();
const {
  getLeads,
  getLead,
  createLead,
  importLeads,
  updateLead,
  deleteLead,
  bulkAssignLeads,
  bulkUpdateStatus,
  bulkEmailLeads,
  addNote,
  convertToClient,
  connectIndiamart,
  disconnectIndiamart,
  syncFromIndiamart,
  getIndiamartSyncStatus,
  indiamartWebhook,
  connectTradeindia,
  disconnectTradeindia,
  syncFromTradeindia,
  getTradeindiaSyncStatus,
  connectJustdial,
  disconnectJustdial,
  getJustdialStatus,
  justdialWebhook,
  getStatusHistoryReport,
  updateIndiamartSettings,
  getLeadColumnPreferences,
  updateLeadColumnPreferences,
  getSavedViews,
  createSavedView,
  updateSavedView,
  deleteSavedView,
} = require("../controllers/leadController");
const { protect, authorize } = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");

router.post("/indiamart/webhook", indiamartWebhook);
router.post("/justdial/webhook/:token", justdialWebhook);

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
  getTradeindiaSyncStatus,
);
router.post(
  "/tradeindia/connect",
  authorize("super_admin", "admin"),
  connectTradeindia,
);
router.post(
  "/tradeindia/disconnect",
  authorize("super_admin", "admin"),
  disconnectTradeindia,
);
router.post(
  "/tradeindia/sync",
  authorize("super_admin", "admin"),
  syncFromTradeindia,
);

router.get(
  "/justdial/status",
  authorize("super_admin", "admin"),
  getJustdialStatus,
);
router.post(
  "/justdial/connect",
  authorize("super_admin", "admin"),
  connectJustdial,
);
router.post(
  "/justdial/disconnect",
  authorize("super_admin", "admin"),
  disconnectJustdial,
);

router.get("/reports/status-history", getStatusHistoryReport);
router
  .route("/column-preferences")
  .get(getLeadColumnPreferences)
  .put(updateLeadColumnPreferences);
router.route("/saved-views").get(getSavedViews).post(createSavedView);
router
  .route("/saved-views/:viewId")
  .put(updateSavedView)
  .delete(deleteSavedView);
router.post("/import", checkPermission("Leads", "create"), importLeads);
router.post(
  "/bulk-assign",
  checkPermission("Leads", "update"),
  bulkAssignLeads,
);
router.post(
  "/bulk-status",
  checkPermission("Leads", "update"),
  bulkUpdateStatus,
);
router.post("/bulk-email", checkPermission("Leads", "update"), bulkEmailLeads);
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
