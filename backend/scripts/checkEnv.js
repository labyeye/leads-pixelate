require("dotenv").config();
console.log("MONGO_URI:", process.env.MONGO_URI ? "Found" : "Missing");
const mongoose = require("mongoose");
console.log("Mongoose version:", mongoose.version);
const Lead = require("./models/Lead");
console.log("Lead model loaded");
process.exit(0);
