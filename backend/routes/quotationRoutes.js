const express = require("express");
const router = express.Router();
const {
  getQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  decideApproval,
  deleteQuotation,
} = require("../controllers/quotationController");
const { protect } = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");

router.use(protect);

router
  .route("/")
  .get(checkPermission("Quotations", "read"), getQuotations)
  .post(checkPermission("Quotations", "create"), createQuotation);

router.post("/:id/approval", checkPermission("Quotations", "read"), decideApproval);

router
  .route("/:id")
  .get(checkPermission("Quotations", "read"), getQuotation)
  .put(checkPermission("Quotations", "update"), updateQuotation)
  .delete(checkPermission("Quotations", "delete"), deleteQuotation);

module.exports = router;
