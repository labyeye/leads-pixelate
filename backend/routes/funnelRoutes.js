const express = require("express");
const router = express.Router();
const { list, create, update, remove, jobs, overview, runNow } = require("../controllers/funnelController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect, authorize("super_admin", "admin"));
router.get("/overview", overview);
router.route("/").get(list).post(create);
router.route("/:id").put(update).delete(remove);
router.get("/:id/jobs", jobs);
router.post("/:id/run", runNow);

module.exports = router;
