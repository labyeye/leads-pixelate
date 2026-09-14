const mongoose = require("mongoose");
const log = require("../utils/logger").scope("DB");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    log.info("MongoDB connected", { host: conn.connection.host });
  } catch (error) {
    log.error("MongoDB connection failed", { message: error.message });
    process.exit(1);
  }
};

module.exports = connectDB;
