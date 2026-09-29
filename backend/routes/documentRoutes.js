const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const asyncHandler = require("express-async-handler");
const Document = require("../models/Document");
const { protect, authorize } = require("../middleware/auth");

const UPLOADS = path.join(__dirname, "../uploads");
// WhatsApp Cloud API accepts documents up to 100MB, but we keep the vault lean.
const MAX_SIZE = 25 * 1024 * 1024;
const ALLOWED = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
};

const tenantFilter = (user) => (user.tenantId ? { tenantId: user.tenantId } : {});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOADS, "documents", String(req.user.tenantId || "global"));
      fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
    },
    // Random name: /uploads is public, so the URL must not be guessable.
    filename: (req, file, cb) =>
      cb(null, `${Date.now()}-${require("crypto").randomBytes(8).toString("hex")}${ALLOWED[file.mimetype]}`),
  }),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) =>
    ALLOWED[file.mimetype]
      ? cb(null, true)
      : cb(new Error("Only PDF, images, Word, Excel and PowerPoint files are allowed")),
});

const withUrl = (d) => ({ ...d.toObject(), url: `/uploads/${d.filePath}` });

router.use(protect);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const docs = await Document.find(tenantFilter(req.user)).sort({ createdAt: -1 }).populate("uploadedBy", "name");
    res.json({ success: true, data: docs.map(withUrl) });
  }),
);

router.post(
  "/",
  authorize("super_admin", "admin"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400);
      throw new Error("No file uploaded");
    }
    const doc = await Document.create({
      name: (req.body.name || "").trim() || path.parse(req.file.originalname).name,
      category: req.body.category || "other",
      fileName: req.file.originalname,
      filePath: path.relative(UPLOADS, req.file.path).split(path.sep).join("/"),
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user._id,
      tenantId: req.user.tenantId || null,
    });
    res.status(201).json({ success: true, data: withUrl(doc) });
  }),
);

router.put(
  "/:id",
  authorize("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const set = {};
    if (req.body.name?.trim()) set.name = req.body.name.trim();
    if (req.body.category) set.category = req.body.category;
    const doc = await Document.findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req.user) }, set, {
      new: true,
      runValidators: true,
    });
    if (!doc) {
      res.status(404);
      throw new Error("Document not found");
    }
    res.json({ success: true, data: withUrl(doc) });
  }),
);

router.delete(
  "/:id",
  authorize("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const doc = await Document.findOneAndDelete({ _id: req.params.id, ...tenantFilter(req.user) });
    if (!doc) {
      res.status(404);
      throw new Error("Document not found");
    }
    fs.unlink(path.join(UPLOADS, doc.filePath), () => {});
    res.json({ success: true });
  }),
);

module.exports = router;
