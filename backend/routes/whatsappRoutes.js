const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  setup,
  addPhoneNumber,
  removePhoneNumber,
  disconnect,
  getStatus,
  getConfig,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  syncTemplates,
  submitTemplate,
  getCampaigns,
  getCampaign,
  createCampaign,
  resendCampaign,
  syncPhoneNumbers,
  sendMessage,
  verifyWebhook,
  handleWebhook,
  getReplies,
  uploadMedia,
  getAutomations,
  saveAutomations,
} = require("../controllers/whatsappController");
const { protect, ownerOnly } = require("../middleware/auth");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF, JPEG, PNG, and WEBP files are allowed"));
  },
});

router.get("/webhook", verifyWebhook);
router.post("/webhook", handleWebhook);

router.use(protect);

router.post("/setup", ownerOnly, setup);
router.post(
  "/phone-numbers",
  ownerOnly,
  addPhoneNumber,
);
router.post(
  "/phone-numbers/sync",
  ownerOnly,
  syncPhoneNumbers,
);
router.delete(
  "/phone-numbers/:phoneNumberId",
  ownerOnly,
  removePhoneNumber,
);
router.post("/disconnect", ownerOnly, disconnect);
router.get("/status", getStatus);
router.get("/config", getConfig);
router.route("/automations").get(getAutomations).put(ownerOnly, saveAutomations);

router.post(
  "/upload-media",
  ownerOnly,
  upload.single("file"),
  uploadMedia,
);

router
  .route("/templates")
  .get(getTemplates)
  .post(ownerOnly, createTemplate);
router
  .route("/templates/:id")
  .put(ownerOnly, updateTemplate)
  .delete(ownerOnly, deleteTemplate);
router.post(
  "/templates/sync",
  ownerOnly,
  syncTemplates,
);

router.post(
  "/templates/:id/submit",
  ownerOnly,
  submitTemplate,
);

router.route("/campaigns").get(getCampaigns).post(createCampaign);
router.route("/campaigns/:id").get(getCampaign);
router.post("/campaigns/:id/resend", resendCampaign);

router.post("/send", sendMessage);

router.get("/replies", getReplies);

module.exports = router;
