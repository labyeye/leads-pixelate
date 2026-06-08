const express = require("express");
const router = express.Router();
const {
  getQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
} = require("../controllers/quotationController");
const { protect } = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");

router.use(protect);

router
  .route("/")
  .get(checkPermission("Quotations", "read"), getQuotations)
  .post(checkPermission("Quotations", "create"), createQuotation);

router
  .route("/:id")
  .get(checkPermission("Quotations", "read"), getQuotation)
  .put(checkPermission("Quotations", "update"), updateQuotation)
  .delete(checkPermission("Quotations", "delete"), deleteQuotation);

module.exports = router;
