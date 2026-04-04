const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
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

async function fetchGitHubUserEvents(username) {
  const githubToken = process.env.GITHUB_TOKEN;
  const baseHeaders = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "CodeStreak-Enforcer",
  };

  const url = `https://api.github.com/users/${username}/events?per_page=100`;

  try {
    const res = await axios.get(url, {
      headers: {
        ...baseHeaders,
        ...(githubToken ? { Authorization: `token ${githubToken}` } : {}),
      },
    });
    return res.data;
  } catch (error) {
    const status = error?.response?.status;
    // If configured token is invalid, retry anonymously instead of failing verify.
    if (status === 401 && githubToken) {
      const retry = await axios.get(url, { headers: baseHeaders });
      return retry.data;
    }
    throw error;
  }
}

async function fetchAuthorizedUserEvents(accessToken) {
  const headers = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "CodeStreak-Enforcer",
    Authorization: `Bearer ${accessToken}`,
  };
  const res = await axios.get("https://api.github.com/user/events?per_page=100", {
    headers,
  });
  return res.data || [];
}

function getRequiredOAuthEnv() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI;
  return { clientId, clientSecret, redirectUri };
}

router.get("/oauth/start", protect, async (req, res) => {
  const { clientId, redirectUri } = getRequiredOAuthEnv();
  if (!clientId || !redirectUri || !process.env.JWT_SECRET) {
    return res.status(500).json({
      message: "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and GITHUB_OAUTH_REDIRECT_URI.",
    });
  }

  const state = jwt.sign(
    { userId: req.userId, purpose: "github_oauth" },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email repo",
    state,
    allow_signup: "true",
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  res.json({ authUrl });
});

router.get("/oauth/callback", async (req, res) => {
  const { code, state } = req.query;
  const { clientId, clientSecret, redirectUri } = getRequiredOAuthEnv();

  if (!clientId || !clientSecret || !redirectUri || !process.env.JWT_SECRET) {
    return res.status(500).send("GitHub OAuth is not configured on server.");
  }

  if (!code || !state) {
    return res.status(400).send("Missing OAuth code/state.");
  }

  let decoded;
  try {
    decoded = jwt.verify(state, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(400).send("Invalid OAuth state.");
  }

  if (!decoded?.userId || decoded?.purpose !== "github_oauth") {
    return res.status(400).send("Invalid OAuth state payload.");
  }

  try {
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      },
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "CodeStreak-Enforcer",
        },
      }
    );

    const accessToken = tokenRes.data?.access_token;
    if (!accessToken) {
      return res.status(400).send("GitHub did not return an access token.");
    }

    const ghUserRes = await axios.get("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CodeStreak-Enforcer",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const ghUser = ghUserRes.data || {};
    const githubUsername = ghUser.login || "";
    const githubId = ghUser.id ? String(ghUser.id) : "";
    const avatarUrl = ghUser.avatar_url || (githubUsername ? `https://github.com/${githubUsername}.png` : "");

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    user.githubUsername = githubUsername;
    user.githubId = githubId;
    user.githubAccessToken = accessToken;
    user.githubConnectedAt = new Date();
    user.avatarUrl = avatarUrl;
    await user.save();

    return res.send(`<!doctype html>
<html>
  <body>
    <script>
      if (window.opener) {
        window.opener.postMessage({ source: "codestreak-github-oauth", success: true, githubUsername: ${JSON.stringify(githubUsername)} }, "*");
      }
      window.close();
    </script>
    GitHub connected. You can close this window.
  </body>
</html>`);
  } catch (error) {
    const message = error?.response?.data?.error_description || error?.message || "GitHub OAuth failed";
    return res.status(500).send(`<!doctype html>
<html>
  <body>
    <script>
      if (window.opener) {
        window.opener.postMessage({ source: "codestreak-github-oauth", success: false, error: ${JSON.stringify(message)} }, "*");
      }
      window.close();
    </script>
    GitHub connect failed: ${message}
  </body>
</html>`);
  }
});

router.post("/check", protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.githubAccessToken) {
      return res.status(400).json({
        message: "Connect GitHub first from the dashboard.",
      });
    }

    const events = await fetchAuthorizedUserEvents(user.githubAccessToken);
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
    let daysSinceLastActive = null;
    let alreadyActiveToday = false;

    if (hasCommittedToday) {
      const todayDate = normalizeToLocalMidnight(now, offset);
      alreadyActiveToday = user.lastActiveDate &&
        isSameLocalDay(user.lastActiveDate, now, offset);

      if (!alreadyActiveToday) {
        daysSinceLastActive = user.lastActiveDate
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
    console.error("Verify error:", error);
    if (error.response && error.response.status === 401) {
      return res.status(401).json({ message: "GitHub authorization expired. Reconnect GitHub from dashboard." });
    }
    if (error.response && error.response.status === 403) {
      return res.status(429).json({
        message: "GitHub API rate limit exceeded. Try again later.",
      });
    }
    res.status(500).json({ message: error?.message || "Verification failed. Please try again." });
  }
});

router.get("/activity", protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.githubAccessToken) {
      return res.status(400).json({ message: "GitHub is not connected" });
    }

    const githubRes = await axios.get("https://api.github.com/user/events?per_page=30", {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CodeStreak-Enforcer",
        Authorization: `Bearer ${user.githubAccessToken}`,
      },
    });

    const events = githubRes.data.map((event) => ({
      type: event.type,
      repo: event.repo?.name,
      createdAt: event.created_at,
    }));

    res.json({ events, username: user.githubUsername });
  } catch (error) {
    if (error.response && error.response.status === 401) {
      return res.status(401).json({ message: "GitHub authorization expired. Reconnect GitHub." });
    }
    if (error.response && error.response.status === 403) {
      return res.status(429).json({ message: "GitHub API rate limit exceeded" });
    }
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
