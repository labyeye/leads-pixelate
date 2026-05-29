const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  connectEmbeddedSignup,
  connectManual,
  disconnect,
  getStatus,
  getConfig,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  syncTemplates,
  getCampaigns,
  getCampaign,
  createCampaign,
  sendMessage,
  verifyWebhook,
  handleWebhook,
  getReplies,
  uploadMedia,
} = require("../controllers/whatsappController");
const { protect, authorize } = require("../middleware/auth");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF, JPEG, PNG, and WEBP files are allowed"));
  },
});

// Webhook — no auth (Meta calls these)
router.get("/webhook", verifyWebhook);
router.post("/webhook", handleWebhook);

// All other routes require authentication
router.use(protect);

// Connection
router.post("/connect", authorize("super_admin", "admin"), connectEmbeddedSignup);
router.post("/connect-manual", authorize("super_admin", "admin"), connectManual);
router.post("/disconnect", authorize("super_admin", "admin"), disconnect);
router.get("/status", getStatus);
router.get("/config", getConfig);

// Media upload
router.post("/upload-media", authorize("super_admin", "admin"), upload.single("file"), uploadMedia);

// Templates
router.route("/templates")
  .get(getTemplates)
  .post(authorize("super_admin", "admin"), createTemplate);

router.route("/templates/:id")
  .put(authorize("super_admin", "admin"), updateTemplate)
  .delete(authorize("super_admin", "admin"), deleteTemplate);

router.post("/templates/sync", authorize("super_admin", "admin"), syncTemplates);

// Campaigns
router.route("/campaigns").get(getCampaigns).post(createCampaign);
router.route("/campaigns/:id").get(getCampaign);

// Single message send (from lead detail)
router.post("/send", sendMessage);

// Replies
router.get("/replies", getReplies);

module.exports = router;
