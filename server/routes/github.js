const express = require("express");
const axios = require("axios");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

function getLocalDateUTCms(date, offsetMinutes) {
  if (!Number.isFinite(offsetMinutes)) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  const shifted = new Date(date.getTime() + offsetMinutes * 60000);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const day = shifted.getUTCDate();

  const midnightShiftedUTC = Date.UTC(y, m, day, 0, 0, 0);
  return midnightShiftedUTC - offsetMinutes * 60000;
}

function isSameLocalDay(date1Ms, date2Ms, offsetMinutes) {
  const d1 = getLocalDateUTCms(new Date(date1Ms), offsetMinutes);
  const d2 = getLocalDateUTCms(new Date(date2Ms), offsetMinutes);
  return d1 === d2;
}

function getDaysDifference(date1, date2, offsetMinutes) {
  const d1 = getLocalDateUTCms(date1, offsetMinutes);
  const d2 = getLocalDateUTCms(date2, offsetMinutes);
  return Math.floor((d2 - d1) / (24 * 60 * 60 * 1000));
}

function normalizeToLocalMidnight(date, offsetMinutes) {
  const ms = getLocalDateUTCms(date, offsetMinutes);
  return new Date(ms);
}

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

    const githubToken = process.env.GITHUB_TOKEN;
    const headers = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "CodeStreak-Enforcer",
      ...(githubToken ? { Authorization: `token ${githubToken}` } : {}),
    };

    const githubRes = await axios.get(
      `https://api.github.com/users/${user.githubUsername}/events?per_page=100`,
      { headers }
    );

    const events = githubRes.data;
    const now = new Date();
    const offset = user.timezoneOffsetMinutes;
    const todayMidnightMs = getLocalDateUTCms(now, offset);

    const todayPushEvents = events.filter((event) => {
      const eventDate = new Date(event.created_at);
      return (
        event.type === "PushEvent" && eventDate.getTime() >= todayMidnightMs
      );
    });

    const hasCommittedToday = todayPushEvents.length > 0;

    if (hasCommittedToday) {
      const todayDate = normalizeToLocalMidnight(now, offset);
      const alreadyActiveToday = user.lastActiveDate &&
        isSameLocalDay(user.lastActiveDate, now, offset);

      if (!alreadyActiveToday) {
        const daysSinceLastActive = user.lastActiveDate
          ? getDaysDifference(user.lastActiveDate, now, offset)
          : Infinity;

        if (daysSinceLastActive === 1) {
          user.streak += 1;
        } else if (daysSinceLastActive > 1) {
          user.streak = 1;
          user.streakStartDate = todayDate;
          user.streakDates = [];
        } else {
          user.streak = 1;
          user.streakStartDate = user.streakStartDate || todayDate;
        }

        if (user.streak > user.longestStreak) {
          user.longestStreak = user.streak;
        }

        user.streakDates.push(todayDate);
        if (user.streakDates.length > 365) {
          user.streakDates = user.streakDates.slice(-365);
        }
      }

      user.lastActiveDate = now;
      user.lastCommitDate = now;
      await user.save();

      const daysUntilStreakEnds = user.streak > 0 ? 1 - daysSinceLastActive : 0;

      return res.json({
        verified: true,
        githubUsername: user.githubUsername,
        streak: user.streak,
        longestStreak: user.longestStreak,
        streakStartDate: user.streakStartDate,
        message: alreadyActiveToday
          ? `Already counted today! Keep it up! Streak: ${user.streak} days 🔥`
          : daysSinceLastActive > 1
          ? `Streak reset! New streak started: ${user.streak} day! Let's build it back up!`
          : `${todayPushEvents.length} push event(s) today. Streak: ${user.streak} days! 🔥`,
        todayEvents: todayPushEvents.length,
        alreadyActiveToday,
      });
    } else {
      await user.save();

      const lastActiveDaysAgo = user.lastActiveDate
        ? getDaysDifference(user.lastActiveDate, now, offset)
        : null;

      return res.json({
        verified: false,
        githubUsername: user.githubUsername,
        streak: user.streak,
        longestStreak: user.longestStreak,
        message: lastActiveDaysAgo !== null && lastActiveDaysAgo >= 1
          ? `Last active ${lastActiveDaysAgo} day(s) ago. Streak at risk!`
          : "No push events found today. Keep coding!",
        todayEvents: 0,
        lastActiveDaysAgo,
      });
    }
  } catch (error) {
    if (error.response && error.response.status === 403) {
      return res.status(429).json({
        message: "GitHub API rate limit exceeded. Try again later.",
      });
    }
    res.status(500).json({ message: error.message });
  }
});

router.get("/activity", protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.githubUsername) {
      return res.status(400).json({ message: "GitHub username not set" });
    }

    const githubRes = await axios.get(
      `https://api.github.com/users/${user.githubUsername}/events?per_page=30`,
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
