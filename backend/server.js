const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const connectDB = require("./config/db");
const { errorHandler, notFound } = require("./middleware/errorHandler");

dotenv.config();

connectDB().then(async () => {
  const cron = require("node-cron");
  const { runScheduledSync } = require("./services/indiamartService");
  const User = require("./models/User");

  cron.schedule("*/5 * * * *", async () => {
    try {
      if (!process.env.INDIAMART_API_KEY) return;
      const adminUser = await User.findOne({
        role: { $in: ["super_admin", "admin"] },
      });
      if (!adminUser) return;
      await runScheduledSync(adminUser._id);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[IndiaMART Cron]", err.message);
      }
    }
  });
});

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  }),
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:8081",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts, please try again later.",
  },
});

app.use("/api/", generalLimiter);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(mongoSanitize({ allowDots: true }));
app.use(hpp());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use("/api/auth", authLimiter, require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/leads", require("./routes/leadRoutes"));
app.use("/api/clients", require("./routes/clientRoutes"));
app.use("/api/quotations", require("./routes/quotationRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/settings", require("./routes/settingRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/billing", require("./routes/billingRoutes"));
app.use("/api/facebook", require("./routes/facebookRoutes"));

app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "ok" });
});

app.get("/", (req, res) => {
  res.json({ success: true, message: "NestLeads API" });
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  if (process.env.NODE_ENV === "development") {
    console.log(`NestLeads API running on port ${PORT}`);
  }
});

module.exports = app;
