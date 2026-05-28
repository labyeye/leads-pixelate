const express = require("express");
const router = express.Router();
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");

const { protect, authorize } = require("../middleware/auth");

router
  .route("/")
  .get(protect, getProducts)
  .post(protect, authorize("super_admin", "admin"), createProduct);
router
  .route("/:id")
  .get(protect, getProduct)
  .put(protect, authorize("super_admin", "admin"), updateProduct)
  .delete(protect, authorize("super_admin", "admin"), deleteProduct);

module.exports = router;
