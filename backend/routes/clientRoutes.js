const express = require("express");
const router = express.Router();
const {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
} = require("../controllers/clientController");
const { protect } = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");

router.use(protect);

router
  .route("/")
  .get(checkPermission("Clients", "read"), getClients)
  .post(checkPermission("Clients", "create"), createClient);

router
  .route("/:id")
  .get(checkPermission("Clients", "read"), getClient)
  .put(checkPermission("Clients", "update"), updateClient)
  .delete(checkPermission("Clients", "delete"), deleteClient);

module.exports = router;
