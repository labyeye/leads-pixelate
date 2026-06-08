const express = require("express");
const router = express.Router();
const {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
} = require("../controllers/serviceController");
const { protect } = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");

router.use(protect);

router
  .route("/")
  .get(checkPermission("Services", "read"), getServices)
  .post(checkPermission("Services", "create"), createService);

router
  .route("/:id")
  .get(checkPermission("Services", "read"), getService)
  .put(checkPermission("Services", "update"), updateService)
  .delete(checkPermission("Services", "delete"), deleteService);

module.exports = router;
