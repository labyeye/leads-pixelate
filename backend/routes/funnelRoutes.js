const express = require("express");
const router = express.Router();
const { list, create, update, remove, jobs } = require("../controllers/funnelController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect, authorize("super_admin", "admin"));
router.route("/").get(list).post(create);
router.route("/:id").put(update).delete(remove);
router.get("/:id/jobs", jobs);

module.exports = router;
