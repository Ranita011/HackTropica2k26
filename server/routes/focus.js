const express = require("express");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

// POST /api/focus/session — sync extension focus sessions to user stats
router.post("/session", protect, async (req, res) => {
  try {
    const { elapsedMs } = req.body;

    const elapsed = Number(elapsedMs);
    if (!Number.isFinite(elapsed) || elapsed <= 0) {
      return res.status(400).json({ message: "elapsedMs must be a positive number" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.totalFocusTime = (user.totalFocusTime || 0) + elapsed;
    user.totalSessions = (user.totalSessions || 0) + 1;

    await user.save();

    res.json({
      success: true,
      totalFocusTime: user.totalFocusTime,
      totalSessions: user.totalSessions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

