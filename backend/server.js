require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();

// 1. Connect to MongoDB Atlas
connectDB();

// 2. Middleware
app.use(cors());
app.use(express.json()); // Allows the server to accept JSON data

console.log("🔥 LegalLink Server Initializing...");


// 4. Basic Test Route
app.get("/", (req, res) => {
  res.send("LegalLink Backend is running successfully!");
});

// 5. Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});