const express = require("express");
const User = require("../models/User");

const router = express.Router();

// GET /api/leaderboard — top 50 users by streak
router.get("/", async (req, res) => {
  try {
    const users = await User.find({})
      .select("username githubUsername streak longestStreak avatarUrl totalFocusTime totalSessions")
      .sort({ streak: -1, longestStreak: -1 })
      .limit(50);

    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      _id: user._id,
      username: user.username,
      githubUsername: user.githubUsername,
      streak: user.streak,
      longestStreak: user.longestStreak,
      avatarUrl: user.avatarUrl,
      totalFocusTime: user.totalFocusTime,
      totalSessions: user.totalSessions,
    }));

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
