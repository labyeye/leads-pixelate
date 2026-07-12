const express = require("express");
const router = express.Router();
const { checkApiKey, updateTenantSubscription } = require("../controllers/crmController");

router.use(checkApiKey);

router.patch("/tenants/:tenantId/subscription", updateTenantSubscription);

module.exports = router;
