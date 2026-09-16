const express = require("express");
const router = express.Router();
const { checkApiKey, getCrmInvoices } = require("../controllers/crmController");

router.use(checkApiKey);

router.get("/invoices", getCrmInvoices);

module.exports = router;
