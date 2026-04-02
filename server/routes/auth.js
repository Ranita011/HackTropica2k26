const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const plain = user.toObject ? user.toObject() : { ...user };
  delete plain.password;
  return plain;
}

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, githubUsername } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Username, email, and password are required",
      });
    }

    // Check existing user
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });
    if (existingUser) {
      const field = existingUser.email === email ? "Email" : "Username";
      return res.status(400).json({ message: `${field} already exists` });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      githubUsername: githubUsername || "",
      avatarUrl: githubUsername
        ? `https://github.com/${githubUsername}.png`
        : "",
    });

    res.status(201).json({
      ...sanitizeUser(user),
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifierRaw = email ?? username;
    const identifier = typeof identifierRaw === "string" ? identifierRaw.trim() : "";

    if (!identifier || !password) {
      return res.status(400).json({ message: "Email/username and password are required" });
    }

    const byEmail = identifier.toLowerCase();
    const usernamePattern = new RegExp(`^${escapeRegex(identifier)}$`, "i");
    const user = await User.findOne({
      $or: [{ email: byEmail }, { username: usernamePattern }],
    });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    res.json({
      ...sanitizeUser(user),
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/auth/me
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(sanitizeUser(user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/auth/profile
router.put("/profile", protect, async (req, res) => {
  try {
    const { githubUsername, timezoneOffsetMinutes } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (githubUsername !== undefined) {
      user.githubUsername = githubUsername;
      user.avatarUrl = githubUsername
        ? `https://github.com/${githubUsername}.png`
        : "";
    }

    if (timezoneOffsetMinutes !== undefined) {
      const offset = Number(timezoneOffsetMinutes);
      if (Number.isFinite(offset)) {
        user.timezoneOffsetMinutes = offset;
      }
    }

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
