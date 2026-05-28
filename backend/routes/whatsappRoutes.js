const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getCampaigns,
  getCampaign,
  createCampaign,
  verifyWebhook,
  handleWebhook,
  getReplies,
  getConfig,
  uploadMedia,
} = require("../controllers/whatsappController");
const { protect, authorize } = require("../middleware/auth");

// Multer: keep file in memory, allow PDF + images, max 16MB
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

// Webhook routes — no auth (Meta calls these)
router.get("/webhook", verifyWebhook);
router.post("/webhook", handleWebhook);

// All other routes require authentication
router.use(protect);

// Config
router.get("/config", getConfig);

// Media upload
router.post(
  "/upload-media",
  authorize("super_admin", "admin"),
  upload.single("file"),
  uploadMedia,
);

// Templates
router
  .route("/templates")
  .get(getTemplates)
  .post(authorize("super_admin", "admin"), createTemplate);

router
  .route("/templates/:id")
  .put(authorize("super_admin", "admin"), updateTemplate)
  .delete(authorize("super_admin", "admin"), deleteTemplate);

// Campaigns
router.route("/campaigns").get(getCampaigns).post(createCampaign);

router.route("/campaigns/:id").get(getCampaign);

// Replies
router.get("/replies", getReplies);

module.exports = router;
