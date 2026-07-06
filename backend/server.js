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
  const { runScheduledPosts } = require("./controllers/socialController");
  const User = require("./models/User");

  cron.schedule("* * * * *", runScheduledPosts);

  cron.schedule("*/5 * * * *", async () => {
    try {
      const Tenant = require("./models/Tenant");

      if (process.env.INDIAMART_API_KEY) {
        const adminUser = await User.findOne({
          role: { $in: ["super_admin", "admin"] },
        });
        if (adminUser) {
          await runScheduledSync(null, process.env.INDIAMART_API_KEY);
        }
        return;
      }

      const tenants = await Tenant.find({
        "integrations.indiamart.enabled": true,
        "integrations.indiamart.apiKey": { $nin: ["", null] },
      });

      for (const tenant of tenants) {
        await runScheduledSync(
          tenant._id,
          tenant.integrations.indiamart.apiKey,
          tenant.integrations.indiamart.assigneeIds || [],
        );
        await Tenant.findByIdAndUpdate(tenant._id, {
          "integrations.indiamart.lastSync": new Date(),
        });
      }
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
    origin: (origin, callback) => {
      // Allow the CRM frontend and all origins for the public API
      const allowed = process.env.CLIENT_URL || "http://localhost:8081";
      if (!origin || origin === allowed) return callback(null, true);
      // Public endpoints are called from any website
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-CSRF-Token", "X-Requested-With"],
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
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts, please try again later.",
  },
});

app.use("/api/", generalLimiter);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use("/uploads", require("express").static(require("path").join(__dirname, "uploads")));

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
app.use("/api/services", require("./routes/serviceRoutes"));
app.use("/api/billing", require("./routes/billingRoutes"));
app.use("/api/facebook", require("./routes/facebookRoutes"));
app.use("/api/google-ads", require("./routes/googleAdsRoutes"));
app.use("/api/whatsapp", require("./routes/whatsappRoutes"));
app.use("/api/activity", require("./routes/activityRoutes"));
app.use("/api/social", require("./routes/socialRoutes"));
app.use("/api/campaigns", require("./routes/campaignRoutes"));
app.use("/api/api-keys", require("./routes/apiKeyRoutes"));
app.use("/api/public", require("./routes/publicRoutes"));
app.use("/api/hrms", require("./routes/hrmsRoutes"));
app.use("/api/upload", require("./routes/uploadRoutes"));

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
