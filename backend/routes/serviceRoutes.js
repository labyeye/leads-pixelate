const express = require("express");
const router = express.Router();
const {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
} = require("../controllers/serviceController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router
  .route("/")
  .get(getServices)
  .post(authorize("super_admin", "admin", "service_manager"), createService);

router
  .route("/:id")
  .get(getService)
  .put(authorize("super_admin", "admin", "service_manager"), updateService)
  .delete(authorize("super_admin", "admin"), deleteService);

module.exports = router;
