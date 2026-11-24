const express = require("express");
const router = express.Router();
const c = require("../controllers/socialPlanController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.route("/").get(c.getPlans).post(c.createPlan);
router.route("/:id").put(c.updatePlan).delete(c.deletePlan);
router.put("/:id/submit", c.submitPlan);
router.put("/:id/approve", authorize("super_admin", "admin"), c.approvePlan);
router.put("/:id/reject", authorize("super_admin", "admin"), c.rejectPlan);
router.post("/:id/schedule", authorize("super_admin", "admin"), c.schedulePlan);

module.exports = router;
