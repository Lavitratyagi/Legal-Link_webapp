const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }
    const raw = String(email).trim();
    // Case-insensitive email (older DB rows may not be lowercased)
    let user = await User.findOne({
      email: new RegExp(`^${escapeRegex(raw)}$`, "i")
    });
    if (!user) {
      user = await User.findOne({
        username: new RegExp(`^${escapeRegex(raw)}$`, "i")
      });
    }
    if (!user) {
      console.warn("login: no user for", raw);
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (!(await bcrypt.compare(password, user.password))) {
      console.warn("login: wrong password for", user.email);
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });
    res.json({
      token,
      user: {
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error("login:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    console.log("📥 Incoming Data:", req.body);

    const emailNorm = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: emailNorm });

    if (existingUser) {
      console.log("⚠️ User already exists");
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPass = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email: emailNorm,
      password: hashedPass
    });

    console.log("💾 Saving user...");

    const savedUser = await newUser.save();

    console.log("✅ Saved User in DB:", savedUser);

    res.json({ message: "Signup successful" });

  } catch (err) {
    console.error("❌ ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};