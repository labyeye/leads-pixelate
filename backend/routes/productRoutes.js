const express = require("express");
const router = express.Router();
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");

const { protect } = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");

router
  .route("/")
  .get(protect, checkPermission("Products", "read"), getProducts)
  .post(protect, checkPermission("Products", "create"), createProduct);
router
  .route("/:id")
  .get(protect, checkPermission("Products", "read"), getProduct)
  .put(protect, checkPermission("Products", "update"), updateProduct)
  .delete(protect, checkPermission("Products", "delete"), deleteProduct);

module.exports = router;
