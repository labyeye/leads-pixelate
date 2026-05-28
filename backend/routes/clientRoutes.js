const express = require("express");
const router = express.Router();
const {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
} = require("../controllers/clientController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.route("/").get(getClients).post(createClient);

router
  .route("/:id")
  .get(getClient)
  .put(updateClient)
  .delete(authorize("super_admin", "admin"), deleteClient);

module.exports = router;
