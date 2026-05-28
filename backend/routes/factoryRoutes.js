const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getInventory,
  addReel,
  getFactoryProducts,
  addFactoryProduct,
  getPrintingLogs,
  addPrintingLog,
  getReports,
} = require("../controllers/factoryController");

router
  .route("/inventory")
  .get(protect, getInventory)
  .post(protect, authorize("super_admin", "admin"), addReel);

router
  .route("/products")
  .get(protect, getFactoryProducts)
  .post(protect, authorize("super_admin", "admin"), addFactoryProduct);

router
  .route("/printing")
  .get(protect, getPrintingLogs)
  .post(protect, addPrintingLog);

router.get("/reports", protect, getReports);

module.exports = router;
