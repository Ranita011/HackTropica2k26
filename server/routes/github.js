const express = require("express");
const axios = require("axios");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

function getLocalMidnightUTCms(date, offsetMinutes) {
  // When offsetMinutes is null, fall back to server-local midnight.
  if (!Number.isFinite(offsetMinutes)) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  // Shift UTC timestamp by user offset so local time components can be read with UTC getters.
  const shifted = new Date(date.getTime() + offsetMinutes * 60000);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const day = shifted.getUTCDate();

  const midnightShiftedUTC = Date.UTC(y, m, day, 0, 0, 0);
  return midnightShiftedUTC - offsetMinutes * 60000;
}

// POST /api/github/check — verify GitHub activity and update streak
router.post("/check", protect, async (req, res) => {
  try {
    const providedUsernameRaw = req.body?.githubUsername;
    const providedUsername =
      typeof providedUsernameRaw === "string"
        ? providedUsernameRaw.trim()
        : "";

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (providedUsername) {
      user.githubUsername = providedUsername;
      user.avatarUrl = `https://github.com/${providedUsername}.png`;
    }

    if (!user.githubUsername) {
      return res
        .status(400)
        .json({ message: "Please provide your GitHub username first." });
    }

    // Fetch recent GitHub events
    const githubToken = process.env.GITHUB_TOKEN;
    const headers = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "CodeStreak-Enforcer",
      ...(githubToken ? { Authorization: `token ${githubToken}` } : {}),
    };

    const githubRes = await axios.get(
      `https://api.github.com/users/${user.githubUsername}/events?per_page=30`,
      {
        headers,
      }
    );

    const events = githubRes.data;

    // Find push events from today
    const now = new Date();
    const todayMidnightUTCms = getLocalMidnightUTCms(
      now,
      user.timezoneOffsetMinutes
    );
    const todayPushEvents = events.filter((event) => {
      const eventDate = new Date(event.created_at);
      return (
        event.type === "PushEvent" && eventDate.getTime() >= todayMidnightUTCms
      );
    });

    const hasCommittedToday = todayPushEvents.length > 0;

    if (hasCommittedToday) {
      const lastCommitDate = user.lastCommitDate
        ? new Date(user.lastCommitDate)
        : null;

      let shouldIncrement = true;
      if (lastCommitDate) {
        const lastCommitMidnightUTCms = getLocalMidnightUTCms(
          lastCommitDate,
          user.timezoneOffsetMinutes
        );

        // Same day check has already been counted before.
        shouldIncrement = lastCommitMidnightUTCms !== todayMidnightUTCms;
      } else {
        shouldIncrement = true;
      }

      if (shouldIncrement) {
        user.streak = (user.streak || 0) + 1;
      }

      user.lastCommitDate = new Date();
      if (user.streak > user.longestStreak) {
        user.longestStreak = user.streak;
      }

      await user.save();

      return res.json({
        verified: true,
        githubUsername: user.githubUsername,
        streak: user.streak,
        longestStreak: user.longestStreak,
        message: `Great job! You have ${todayPushEvents.length} push event(s) today. Streak: ${user.streak} days!`,
        todayEvents: todayPushEvents.length,
      });
    } else {
      await user.save();

      return res.json({
        verified: false,
        githubUsername: user.githubUsername,
        streak: user.streak,
        message: "No push events found today. Streak stays the same.",
        todayEvents: 0,
      });
    }
  } catch (error) {
    // Handle GitHub API rate limit
    if (error.response && error.response.status === 403) {
      return res.status(429).json({
        message: "GitHub API rate limit exceeded. Try again later.",
      });
    }
    res.status(500).json({ message: error.message });
  }
});

// GET /api/github/activity — fetch recent activity summary
router.get("/activity", protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.githubUsername) {
      return res.status(400).json({ message: "GitHub username not set" });
    }

    const githubRes = await axios.get(
      `https://api.github.com/users/${user.githubUsername}/events?per_page=10`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "CodeStreak-Enforcer",
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
      }
    );

    const events = githubRes.data.map((event) => ({
      type: event.type,
      repo: event.repo?.name,
      createdAt: event.created_at,
    }));

    res.json({ events, username: user.githubUsername });
  } catch (error) {
    if (error.response && error.response.status === 403) {
      return res.status(429).json({ message: "GitHub API rate limit exceeded" });
    }
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
