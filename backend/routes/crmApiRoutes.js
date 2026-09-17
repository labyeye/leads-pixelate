const express = require("express");
const router = express.Router();
const {
  checkApiKey,
  getCrmInvoices,
  getCrmOffers,
  getCrmOfferById,
  createCrmOffer,
  updateCrmOffer,
  deleteCrmOffer,
} = require("../controllers/crmController");

router.use(checkApiKey);

router.get("/invoices", getCrmInvoices);

router.get("/offers", getCrmOffers);
router.get("/offers/:id", getCrmOfferById);
router.post("/offers", createCrmOffer);
router.patch("/offers/:id", updateCrmOffer);
router.delete("/offers/:id", deleteCrmOffer);

module.exports = router;
