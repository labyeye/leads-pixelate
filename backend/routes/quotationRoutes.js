const express = require("express");
const router = express.Router();
const {
  getQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
} = require("../controllers/quotationController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.route("/").get(getQuotations).post(createQuotation);

router
  .route("/:id")
  .get(getQuotation)
  .put(updateQuotation)
  .delete(authorize("super_admin", "admin"), deleteQuotation);

module.exports = router;
