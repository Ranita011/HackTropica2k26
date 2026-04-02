const express = require("express");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

// GET /api/friends — list friends
router.get("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate(
      "friends",
      "username githubUsername streak longestStreak avatarUrl totalFocusTime totalSessions"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user.friends);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/friends/add — add friend by username
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

    // Add friend both ways (mutual friendship)
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

// POST /api/friends/remove — remove friend by username
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
