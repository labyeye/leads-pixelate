const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const User = require("../models/User");
const Lead = require("../models/Lead");
const Client = require("../models/Client");
const Service = require("../models/Service");
const Product = require("../models/Product");
const Quotation = require("../models/Quotation");

const connectDB = require("../config/db");

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log("🗑️  Clearing existing data...");
    await User.deleteMany();
    await Lead.deleteMany();
    await Client.deleteMany();
    await Service.deleteMany();
    await Product.deleteMany();
    await Quotation.deleteMany();

    console.log("👥 Seeding users...");
    const users = await User.create([
      {
        name: "Sankalp Bothra",
        email: "sankalp@skylyf.in",
        password: "password123",
        role: "super_admin",
        phone: "+91 98765 43210",
        department: "Management",
        status: "active",
      },
      {
        name: "Labh Bothra",
        email: "labh@skylyf.in",
        password: "password123",
        role: "super_admin",
        phone: "+91 98765 43211",
        department: "Operations",
        status: "active",
      },
      {
        name: "Admin",
        email: "admin@skylyf.in",
        password: "password123",
        role: "admin",
        phone: "+91 98765 43211",
        department: "Operations",
        status: "active",
      },
      {
        name: "Sales Executive",
        email: "sales@skylyf.in",
        password: "password123",
        role: "sales_executive",
        phone: "+91 98765 43212",
        department: "Sales",
        status: "active",
      },
      {
        name: "Service Manager",
        email: "service@skylyf.in",
        password: "password123",
        role: "service_manager",
        phone: "+91 98765 43213",
        department: "Service & Installation",
        status: "active",
      },
      {
        name: "Accountant",
        email: "accountant@skylyf.in",
        password: "password123",
        role: "accountant",
        phone: "+91 98765 43214",
        department: "Finance",
        status: "active",
      },
    ]);

    const userMap = {};
    users.forEach((u) => (userMap[u.name] = u._id));

    console.log("📋 Seeding leads...");
    await Lead.create([
      {
        name: "Manoj Tiwari",
        company: "Shree Packaging Industries",
        source: "IndiaMART",
        phone: "+91 99887 76655",
        email: "manoj@shreepack.in",
        requirement: "Automatic paper cup making machine (150ml–250ml)",
        status: "New",
        assignedTo: userMap["Sales Executive"],
        followUpDate: "2026-03-25",
      },
      {
        name: "Kavita Nair",
        company: "Kerala Cup Products",
        source: "Website",
        phone: "+91 88776 65544",
        email: "kavita@keralacup.co",
        requirement: "Paper cup raw material and blank supply",
        status: "Contacted",
        assignedTo: userMap["Sales Executive"],
        followUpDate: "2026-03-24",
      },
      {
        name: "Amit Gupta",
        company: "FastPack Disposables",
        source: "Justdial",
        phone: "+91 77665 54433",
        email: "amit@fastpack.in",
        requirement: "High-speed paper cup machine (200 cups/min)",
        status: "Qualified",
        assignedTo: userMap["Sales Executive"],
        followUpDate: "2026-03-26",
      },
    ]);

    console.log("🏢 Seeding clients...");
    const clients = await Client.create([
      {
        name: "Karan Singh",
        company: "CupKraft Manufacturing",
        phone: "+91 55443 32211",
        email: "karan@cupkraft.com",
        address: "Noida, Uttar Pradesh",
        businessType: "Paper Cup Manufacturing",
        gst: "09AABCC1234F1Z5",
        projectStatus: "Active",
        paymentStatus: "Paid",
      },
      {
        name: "Neha Kapoor",
        company: "DrinkPak Solutions",
        phone: "+91 99001 12233",
        email: "neha@drinkpak.in",
        address: "Ludhiana, Punjab",
        businessType: "Disposable Products",
        gst: "03AABCD5678G2Z3",
        projectStatus: "Active",
        paymentStatus: "Pending",
      },
    ]);

    const clientMap = {};
    clients.forEach((c) => (clientMap[c.name] = c._id));

    console.log("⚙️  Seeding products...");
    const products = await Product.create([
      {
        name: "Automatic Paper Cup Machine",
        category: "Machines",
        price: 850000,
        status: "Active",
      },
      {
        name: "High-Speed Cup Machine (200/min)",
        category: "Machines",
        price: 1450000,
        status: "Active",
      },
      {
        name: "Semi-Automatic Cup Machine",
        category: "Machines",
        price: 350000,
        status: "Active",
      },
      {
        name: "Installation & Training",
        category: "Services",
        price: 45000,
        status: "Active",
      },
      {
        name: "Annual Maintenance Contract",
        category: "Services",
        price: 60000,
        status: "Active",
      },
    ]);

    const productMap = {};
    products.forEach((p) => (productMap[p.name] = p._id));

    console.log("⚙️  Seeding service allocations...");
    await Service.create([
      {
        product: productMap["Automatic Paper Cup Machine"],
        allocatedClient: clientMap["Karan Singh"],
        assignedTo: userMap["Service Manager"],
        status: "In Progress",
        progress: 72,
        timeline: "4-6 weeks delivery",
      },
      {
        product: productMap["High-Speed Cup Machine (200/min)"],
        allocatedClient: clientMap["Neha Kapoor"],
        assignedTo: userMap["Service Manager"],
        status: "Pending",
        progress: 45,
        timeline: "6-8 weeks delivery",
      },
    ]);

    console.log("📑 Seeding quotations...");
    await Quotation.create([
      {
        number: "QT-2026-001",
        date: "2026-03-20",
        clientName: "Manoj Tiwari",
        projectTitle: "Automatic Cup Machine Setup",
        services: [
          { name: "Automatic Paper Cup Machine", price: 850000, quantity: 1 },
          { name: "Installation & Training", price: 45000, quantity: 1 },
        ],
        subtotal: 895000,
        tax: 161100,
        discount: 25000,
        total: 1031100,
        status: "Sent",
        createdBy: userMap["Admin"],
      },
    ]);

    console.log("");
    console.log("═══════════════════════════════════════════════════");
    console.log("  ✅ Database seeded successfully!");
    console.log("═══════════════════════════════════════════════════");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding error:", error);
    process.exit(1);
  }
};

seedDatabase();
