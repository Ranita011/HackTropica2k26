const express = require("express");
const axios = require("axios");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

// ─── Live Streak from GitHub API ─────────────────────────────
router.get("/live/:username", async (req, res) => {
  try {
    const { username } = req.params;
    if (!username || typeof username !== "string") {
      return res.status(400).json({ message: "Username is required" });
    }

    const cleanUsername = username.trim().toLowerCase();

    const githubToken = process.env.GITHUB_TOKEN;
    const headers = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "CodeStreak-Enforcer",
      ...(githubToken ? { Authorization: `token ${githubToken}` } : {}),
    };

    // Fetch events from last 90 days (GitHub API limit is 90 days)
    const githubRes = await axios.get(
      `https://api.github.com/users/${cleanUsername}/events?per_page=100`,
      { headers }
    );

    const events = githubRes.data || [];
    const now = new Date();
    const offsetMinutes = 0; // Use UTC for simplicity

    // Get today's midnight in UTC
    const todayMidnightMs = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );

    // Filter push events and group by date
    const pushDatesSet = new Set();
    const dayPushCounts = {};

    events.forEach((event) => {
      if (event.type !== "PushEvent") return;
      const eventDate = new Date(event.created_at);
      const eventMs = eventDate.getTime();

      // Only consider events from last 90 days
      const ninetyDaysAgo = now.getTime() - 90 * 24 * 60 * 60 * 1000;
      if (eventMs < ninetyDaysAgo) return;

      // Get date key (YYYY-MM-DD in UTC)
      const dateKey = eventDate.toISOString().split("T")[0];
      pushDatesSet.add(dateKey);
      dayPushCounts[dateKey] = (dayPushCounts[dateKey] || 0) + 1;
    });

    const pushDates = Array.from(pushDatesSet).sort();

    // Calculate streak from GitHub data
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let streakStartDate = null;
    let longestStreakStart = null;

    // Get today's date key in UTC
    const todayUTC = new Date(now);
    todayUTC.setUTCHours(0, 0, 0, 0);
    const todayKey = todayUTC.toISOString().split("T")[0];

    const yesterdayUTC = new Date(todayUTC);
    yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1);
    const yesterdayKey = yesterdayUTC.toISOString().split("T")[0];

    // Check if active today or yesterday to start counting streak
    const hasActivityToday = pushDates.includes(todayKey);
    const hasActivityYesterday = pushDates.includes(yesterdayKey);

    if (hasActivityToday || hasActivityYesterday) {
      // Count backwards from today/yesterday
      let checkDate = hasActivityToday ? new Date(todayUTC) : new Date(yesterdayUTC);
      while (true) {
        const checkKey = checkDate.toISOString().split("T")[0];
        if (pushDates.includes(checkKey)) {
          currentStreak++;
          if (streakStartDate === null) {
            streakStartDate = checkKey;
          }
          checkDate.setUTCDate(checkDate.getUTCDate() - 1);
        } else {
          break;
        }
      }
    }

    // Calculate longest streak by iterating through all dates
    const allDates = pushDates.slice().sort();
    tempStreak = 0;
    let tempStart = null;

    for (let i = 0; i < allDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
        tempStart = allDates[i];
      } else {
        const prevDate = new Date(allDates[i - 1]);
        const currDate = new Date(allDates[i]);
        const diffDays = Math.round((currDate - prevDate) / (24 * 60 * 60 * 1000));

        if (diffDays === 1) {
          tempStreak++;
        } else {
          if (tempStreak > longestStreak) {
            longestStreak = tempStreak;
            longestStreakStart = tempStart;
          }
          tempStreak = 1;
          tempStart = allDates[i];
        }
      }
    }
    // Check last streak
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
      longestStreakStart = tempStart;
    }

    // Ensure longestStreak at least equals currentStreak
    if (longestStreak < currentStreak) {
      longestStreak = currentStreak;
    }

    // Get rank from DB
    const user = await User.findOne({ githubUsername: cleanUsername });
    let rank = null;
    let percentile = null;
    let totalUsers = 0;

    if (user) {
      totalUsers = await User.countDocuments({});
      const higherRanked = await User.countDocuments({ streak: { $gt: user.streak } });
      rank = higherRanked + 1;
      percentile = Math.round((1 - rank / totalUsers) * 100);
    }

    res.json({
      username: cleanUsername,
      streak: currentStreak,
      longestStreak,
      streakStartDate,
      todayPushes: dayPushCounts[todayKey] || 0,
      isActiveToday: hasActivityToday,
      rank,
      percentile,
      totalUsers,
      contributionDays: pushDates.length,
      last90Days: Object.keys(dayPushCounts).sort().slice(-30),
      recentActivity: pushDates.slice(-7),
    });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ message: "GitHub user not found" });
    }
    if (error.response && error.response.status === 403) {
      return res.status(429).json({ message: "GitHub API rate limit exceeded" });
    }
    res.status(500).json({ message: error.message });
  }
});

function getWeeksData(streakDates, timezoneOffsetMinutes) {
  const now = new Date();
  const weeks = [];
  const offset = timezoneOffsetMinutes || 0;
  
  const today = new Date(now.getTime() + offset * 60000);
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  
  const dayOfWeek = today.getUTCDay();
  const startOfWeek = todayUTC - dayOfWeek * 24 * 60 * 60 * 1000;
  
  for (let w = 11; w >= 0; w--) {
    const weekStart = startOfWeek - w * 7 * 24 * 60 * 60 * 1000;
    const week = [];
    
    for (let d = 0; d < 7; d++) {
      const dayMs = weekStart + d * 24 * 60 * 60 * 1000;
      const dayDate = new Date(dayMs);
      
      const hasActivity = streakDates.some((date) => {
        const activityDate = new Date(date.getTime() + offset * 60000);
        const activityUTC = Date.UTC(
          activityDate.getUTCFullYear(),
          activityDate.getUTCMonth(),
          activityDate.getUTCDate()
        );
        return activityUTC === dayMs;
      });
      
      week.push({
        date: new Date(dayMs).toISOString().split("T")[0],
        active: hasActivity,
        isToday: dayMs === todayUTC,
        isFuture: dayMs > todayUTC,
      });
    }
    
    weeks.push(week);
  }
  
  return weeks;
}

function getMonthlyData(streakDates, timezoneOffsetMinutes) {
  const now = new Date();
  const offset = timezoneOffsetMinutes || 0;
  const currentMonth = now.getUTCMonth();
  const currentYear = now.getUTCFullYear();
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getUTCDate();
  const monthData = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dayMs = Date.UTC(currentYear, currentMonth, day);
    const dayDate = new Date(dayMs);
    
    const hasActivity = streakDates.some((date) => {
      const activityDate = new Date(date.getTime() + offset * 60000);
      const activityUTC = Date.UTC(
        activityDate.getUTCFullYear(),
        activityDate.getUTCMonth(),
        activityDate.getUTCDate()
      );
      return activityUTC === dayMs;
    });
    
    monthData.push({
      date: dayDate.toISOString().split("T")[0],
      day,
      active: hasActivity,
    });
  }
  
  return monthData;
}

function getContributionStats(streakDates) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const last30Days = streakDates.filter((date) => date >= thirtyDaysAgo);
  const totalContributions = streakDates.length;
  
  const thisWeekStart = new Date(now);
  thisWeekStart.setUTCHours(0, 0, 0, 0);
  thisWeekStart.setUTCDate(thisWeekStart.getUTCDate() - thisWeekStart.getUTCDay());
  const thisWeekContributions = streakDates.filter((date) => date >= thisWeekStart).length;
  
  return {
    totalContributions,
    last30Days: last30Days.length,
    thisWeek: thisWeekContributions,
  };
}

function getWeeksDataFromGitHub(pushDates, timezoneOffsetMinutes) {
  const now = new Date();
  const weeks = [];
  const offset = timezoneOffsetMinutes || 0;
  
  const today = new Date(now.getTime() + offset * 60000);
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  
  const dayOfWeek = today.getUTCDay();
  const startOfWeek = todayUTC - dayOfWeek * 24 * 60 * 60 * 1000;
  
  for (let w = 11; w >= 0; w--) {
    const weekStart = startOfWeek - w * 7 * 24 * 60 * 60 * 1000;
    const week = [];
    
    for (let d = 0; d < 7; d++) {
      const dayMs = weekStart + d * 24 * 60 * 60 * 1000;
      const dayDate = new Date(dayMs);
      const dayKey = dayDate.toISOString().split("T")[0];
      
      const hasActivity = pushDates.includes(dayKey);
      
      week.push({
        date: dayKey,
        active: hasActivity,
        isToday: dayMs === todayUTC,
        isFuture: dayMs > todayUTC,
      });
    }
    
    weeks.push(week);
  }
  
  return weeks;
}

function getMonthlyDataFromGitHub(pushDates, timezoneOffsetMinutes) {
  const now = new Date();
  const offset = timezoneOffsetMinutes || 0;
  const currentMonth = now.getUTCMonth();
  const currentYear = now.getUTCFullYear();
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getUTCDate();
  const monthData = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dayMs = Date.UTC(currentYear, currentMonth, day);
    const dayDate = new Date(dayMs);
    const dayKey = dayDate.toISOString().split("T")[0];
    
    const hasActivity = pushDates.includes(dayKey);
    
    monthData.push({
      date: dayKey,
      day,
      active: hasActivity,
    });
  }
  
  return monthData;
}

function calculateStreaks(pushDates) {
  if (!pushDates || pushDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const now = new Date();
  const todayUTC = new Date(now);
  todayUTC.setUTCHours(0, 0, 0, 0);
  const todayKey = todayUTC.toISOString().split("T")[0];
  
  const yesterdayUTC = new Date(todayUTC);
  yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1);
  const yesterdayKey = yesterdayUTC.toISOString().split("T")[0];

  const sortedDates = [...pushDates].sort();
  
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const hasActivityToday = pushDates.includes(todayKey);
  const hasActivityYesterday = pushDates.includes(yesterdayKey);

  if (hasActivityToday || hasActivityYesterday) {
    let checkDate = hasActivityToday ? new Date(todayUTC) : new Date(yesterdayUTC);
    while (true) {
      const checkKey = checkDate.toISOString().split("T")[0];
      if (pushDates.includes(checkKey)) {
        currentStreak++;
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
      } else {
        break;
      }
    }
  }

  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const diffDays = Math.round((currDate - prevDate) / (24 * 60 * 60 * 1000));
      
      if (diffDays === 1) {
        tempStreak++;
      } else {
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
        tempStreak = 1;
      }
    }
  }
  
  if (tempStreak > longestStreak) {
    longestStreak = tempStreak;
  }
  
  if (longestStreak < currentStreak) {
    longestStreak = currentStreak;
  }

  return { currentStreak, longestStreak };
}

router.get("/history", protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.githubUsername) {
      return res.status(400).json({ message: "GitHub username not set" });
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

    const events = githubRes.data || [];
    const now = new Date();
    const pushDatesSet = new Set();

    const ninetyDaysAgo = now.getTime() - 90 * 24 * 60 * 60 * 1000;
    events.forEach((event) => {
      if (event.type !== "PushEvent") return;
      const eventDate = new Date(event.created_at);
      if (eventDate.getTime() >= ninetyDaysAgo) {
        pushDatesSet.add(eventDate.toISOString().split("T")[0]);
      }
    });

    const pushDates = Array.from(pushDatesSet).sort();
    const weeks = getWeeksDataFromGitHub(pushDates, user.timezoneOffsetMinutes || 0);
    const monthlyData = getMonthlyDataFromGitHub(pushDates, user.timezoneOffsetMinutes || 0);
    
    const { currentStreak, longestStreak } = calculateStreaks(pushDates);

    res.json({
      streak: currentStreak,
      longestStreak,
      weeks,
      monthlyData,
      stats: {
        totalContributions: pushDates.length,
        last30Days: pushDates.filter(d => {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return new Date(d) >= thirtyDaysAgo;
        }).length,
        thisWeek: pushDates.filter(d => {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return new Date(d) >= weekAgo;
        }).length,
      },
      last90Days: pushDates,
    });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ message: "GitHub user not found" });
    }
    if (error.response && error.response.status === 403) {
      return res.status(429).json({ message: "GitHub API rate limit exceeded" });
    }
    res.status(500).json({ message: error.message });
  }
});

router.get("/stats", protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const now = new Date();
    const offset = user.timezoneOffsetMinutes || 0;
    
    const todayMs = (() => {
      const shifted = new Date(now.getTime() + offset * 60000);
      return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
    })();

    const lastActiveMs = user.lastActiveDate
      ? (() => {
          const shifted = new Date(user.lastActiveDate.getTime() + offset * 60000);
          return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
        })()
      : null;

    const daysSinceActive = lastActiveMs !== null
      ? Math.floor((todayMs - lastActiveMs) / (24 * 60 * 60 * 1000))
      : null;

    const isStreakAtRisk = daysSinceActive !== null && daysSinceActive >= 1 && user.streak > 0;
    const isActiveToday = daysSinceActive === 0;

    const stats = getContributionStats(user.streakDates || []);
    const totalUsers = await User.countDocuments({});
    const higherRanked = await User.countDocuments({ streak: { $gt: user.streak } });
    const rank = higherRanked + 1;

    res.json({
      streak: user.streak,
      longestStreak: user.longestStreak,
      streakStartDate: user.streakStartDate,
      lastActiveDate: user.lastActiveDate,
      daysSinceActive,
      isActiveToday,
      isStreakAtRisk,
      rank,
      totalUsers,
      percentile: Math.round((1 - rank / totalUsers) * 100),
      totalContributions: stats.totalContributions,
      last30Days: stats.last30Days,
      thisWeek: stats.thisWeek,
      totalFocusTime: user.totalFocusTime,
      totalSessions: user.totalSessions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
