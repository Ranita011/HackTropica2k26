const express = require("express");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

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

function formatActivityStatus(daysAgo) {
  if (daysAgo === null) return "Never active";
  if (daysAgo === 0) return "Active today 🔥";
  if (daysAgo === 1) return "Active yesterday";
  if (daysAgo <= 7) return `Active ${daysAgo} days ago`;
  return `Last active ${daysAgo} days ago`;
}

router.get("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate(
      "friends",
      "username githubUsername streak longestStreak avatarUrl totalFocusTime totalSessions lastActiveDate streakDates timezoneOffsetMinutes"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const friendsWithActivity = user.friends.map((friend) => {
      const daysAgo = getDaysSinceActive(friend.lastActiveDate, friend.timezoneOffsetMinutes);
      const isActiveToday = daysAgo === 0;
      const isStreakAtRisk = daysAgo >= 1;
      
      return {
        _id: friend._id,
        username: friend.username,
        githubUsername: friend.githubUsername,
        streak: friend.streak,
        longestStreak: friend.longestStreak,
        avatarUrl: friend.avatarUrl,
        totalFocusTime: friend.totalFocusTime,
        totalSessions: friend.totalSessions,
        lastActiveDate: friend.lastActiveDate,
        daysAgo,
        activityStatus: formatActivityStatus(daysAgo),
        isActiveToday,
        isStreakAtRisk,
      };
    });

    friendsWithActivity.sort((a, b) => b.streak - a.streak);

    res.json(friendsWithActivity);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/add", protect, async (req, res) => {
  try {
    const { username } = req.body;
    const targetUsername = typeof username === "string" ? username.trim() : "";

    if (!targetUsername) {
      return res.status(400).json({ message: "Username is required" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const friend = await User.findOne({ username: targetUsername });

    if (!friend) {
      return res.status(404).json({ message: "User not found" });
    }

    if (friend._id.toString() === req.userId) {
      return res.status(400).json({ message: "You cannot add yourself" });
    }

    const alreadyFriends = user.friends.some(
      (id) => id.toString() === friend._id.toString()
    );

    if (alreadyFriends) {
      return res.status(400).json({ message: "Already friends" });
    }

    user.friends.push(friend._id);
    friend.friends.push(user._id);
    await user.save();
    await friend.save();

    res.json({
      message: `Added ${targetUsername} as a friend`,
      friend: {
        _id: friend._id,
        username: friend.username,
        githubUsername: friend.githubUsername,
        streak: friend.streak,
        avatarUrl: friend.avatarUrl,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/remove", protect, async (req, res) => {
  try {
    const { username } = req.body;
    const targetUsername = typeof username === "string" ? username.trim() : "";

    if (!targetUsername) {
      return res.status(400).json({ message: "Username is required" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const friend = await User.findOne({ username: targetUsername });

    if (!friend) {
      return res.status(404).json({ message: "User not found" });
    }

    user.friends = user.friends.filter(
      (id) => id.toString() !== friend._id.toString()
    );
    friend.friends = friend.friends.filter(
      (id) => id.toString() !== user._id.toString()
    );

    await user.save();
    await friend.save();

    res.json({ message: `Removed ${targetUsername} from friends` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
