const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { protect } = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads")),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const ALLOWED_EXT = new Set([".jpeg", ".jpg", ".png", ".gif", ".webp", ".mp4", ".mov", ".m4v", ".pdf", ".doc", ".docx"]);

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB for reels/videos; photos are held to 50MB below
  fileFilter: (req, file, cb) => {
    // Extension decides the stored name, so the extension itself must be on the allow-list
    // (a spoofed mimetype with ".html"/".svg" would otherwise be served as active content).
    const ext = path.extname(file.originalname).toLowerCase();
    const ok = ALLOWED_EXT.has(ext);
    ok
      ? cb(null, true)
      : cb(new Error("Only images, videos, PDFs and Word docs are allowed"));
  },
});

// Instagram refuses photos over 8MB, so a big JPEG/PNG is re-saved as a smaller JPEG.
const INSTAGRAM_MAX_PHOTO = 8 * 1024 * 1024;
async function shrinkPhoto(file) {
  const ext = path.extname(file.filename).toLowerCase();
  if (![".jpg", ".jpeg", ".png"].includes(ext) || file.size <= INSTAGRAM_MAX_PHOTO) return;
  const sharp = require("sharp");
  const dir = path.dirname(file.path);
  const out = `${path.basename(file.filename, ext)}.jpg`;
  for (const [side, quality] of [[4096, 95], [4096, 90], [3072, 90], [2048, 85]]) {
    const buf = await sharp(file.path)
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, chromaSubsampling: "4:4:4" })
      .toBuffer();
    if (buf.length <= INSTAGRAM_MAX_PHOTO || side === 2048) {
      await require("fs").promises.writeFile(path.join(dir, out), buf);
      if (out !== file.filename) await require("fs").promises.unlink(file.path).catch(() => {});
      file.filename = out;
      return;
    }
  }
}

router.post("/", protect, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }
  const isVideo = [".mp4", ".mov", ".m4v"].includes(path.extname(req.file.filename).toLowerCase());
  if (!isVideo && req.file.size > 50 * 1024 * 1024) {
    await require("fs").promises.unlink(req.file.path).catch(() => {});
    return res
      .status(400)
      .json({ success: false, message: "Photos and documents must be under 50MB" });
  }
  await shrinkPhoto(req.file).catch(() => {});
  const baseUrl =
    process.env.API_BASE_URL || process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  const url = `${baseUrl}/uploads/${req.file.filename}`;
  res.json({ success: true, url });
});

module.exports = router;
