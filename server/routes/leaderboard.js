const express = require("express");
const User = require("../models/User");

const router = express.Router();

function getDaysSinceActive(lastActiveDate, offsetMinutes) {
  if (!lastActiveDate) return null;
  const now = new Date();
  const lastActive = new Date(lastActiveDate);
  
  if (!Number.isFinite(offsetMinutes)) {
    const diff = now.getTime() - lastActive.getTime();
    return Math.floor(diff / (24 * 60 * 60 * 1000));
  }
  
  const shifted = new Date(now.getTime() + offsetMinutes * 60000);
  const lastShifted = new Date(lastActive.getTime() + offsetMinutes * 60000);
  
  const nowDay = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())).getTime();
  const lastDay = new Date(Date.UTC(lastShifted.getUTCFullYear(), lastShifted.getUTCMonth(), lastShifted.getUTCDate())).getTime();
  
  return Math.floor((nowDay - lastDay) / (24 * 60 * 60 * 1000));
}

router.get("/", async (req, res) => {
  try {
    const users = await User.find({})
      .select("username githubUsername streak longestStreak avatarUrl totalFocusTime totalSessions lastActiveDate timezoneOffsetMinutes")
      .sort({ streak: -1, longestStreak: -1 })
      .limit(100);

    const leaderboard = users.map((user, index) => {
      const daysAgo = getDaysSinceActive(user.lastActiveDate, user.timezoneOffsetMinutes);
      const isActiveToday = daysAgo === 0;
      
      return {
        rank: index + 1,
        _id: user._id,
        username: user.username,
        githubUsername: user.githubUsername,
        streak: user.streak,
        longestStreak: user.longestStreak,
        avatarUrl: user.avatarUrl,
        totalFocusTime: user.totalFocusTime,
        totalSessions: user.totalSessions,
        lastActiveDate: user.lastActiveDate,
        isActiveToday,
        daysAgo,
      };
    });

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/rank/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select("streak");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const higherRankedCount = await User.countDocuments({
      streak: { $gt: user.streak },
    });

    const rank = higherRankedCount + 1;

    const totalUsers = await User.countDocuments({});

    res.json({
      rank,
      totalUsers,
      percentile: Math.round((1 - rank / totalUsers) * 100),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
