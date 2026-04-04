import { useEffect, useState } from "react";
import { api } from "../api/api.js";
import { useAuth } from "../auth/AuthContext.jsx";

function formatMs(ms) {
  if (!ms || ms <= 0) return "0m";
  const totalHours = ms / 3600000;
  if (totalHours >= 1) return `${totalHours.toFixed(1)}h`;
  const totalMins = Math.floor(ms / 60000);
  return `${totalMins}m`;
}

function StreakCalendar({ weeks }) {
  if (!weeks || weeks.length === 0) {
    return (
      <div className="text-sm text-slate-400">No activity yet. Start coding!</div>
    );
  }

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="mt-4">
      <div className="flex gap-1 text-[10px] text-slate-500">
        {dayLabels.map((label) => (
          <div key={label} className="w-3 text-center">{label[0]}</div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => (
              <div
                key={di}
                className={`h-3 w-3 rounded-sm ${
                  day.isFuture
                    ? "bg-slate-800"
                    : day.active
                    ? "bg-emerald-500"
                    : "bg-slate-700"
                }`}
                title={`${day.date}${day.active ? " (active)" : ""}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <span>Less</span>
        <div className="h-3 w-3 rounded-sm bg-slate-700" />
        <div className="h-3 w-3 rounded-sm bg-emerald-500" />
        <span>More</span>
      </div>
    </div>
  );
}

function StreakBadge({ streak, isActiveToday, isStreakAtRisk }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-4xl">🔥</span>
      <div>
        <div className="text-3xl font-black text-white">{streak}</div>
        <div className="text-sm text-slate-400">day streak</div>
      </div>
      {isActiveToday && (
        <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-300">
          Active today
        </span>
      )}
      {isStreakAtRisk && (
        <span className="ml-2 animate-pulse rounded-full bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-300">
          At risk!
        </span>
      )}
    </div>
  );
}

export default function Dashboard() {
  const {
    user,
    token,
    updateProfile,
    refreshMe,
    extensionStatus,
    connectingExtension,
    connectExtension,
    startExtensionFocus,
    stopExtensionFocus,
    getExtensionFocusStatus,
  } = useAuth();

  const [isFocusing, setIsFocusing] = useState(false);
  const [githubUsername, setGithubUsername] = useState(user?.githubUsername || "");
  const [verifyGithubUsername, setVerifyGithubUsername] = useState(
    user?.githubUsername || ""
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [connectingGithub, setConnectingGithub] = useState(false);
  const [githubConnectError, setGithubConnectError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [streakStats, setStreakStats] = useState(null);
  const [streakHistory, setStreakHistory] = useState(null);

  const mergeLiveIntoStats = (stats, live) => {
    if (!live) return stats;
    return {
      ...stats,
      streak: live.streak,
      longestStreak: live.longestStreak,
      isActiveToday: live.isActiveToday,
    };
  };

  useEffect(() => {
    setGithubUsername(user?.githubUsername || "");
    setVerifyGithubUsername(user?.githubUsername || "");
  }, [user]);

  useEffect(() => {
    if (!token || !user?.githubUsername) return;

    Promise.all([
      api.streak.stats(token),
      api.streak.history(token),
      api.streak.live(user.githubUsername).catch(() => null),
    ])
      .then(([stats, history, live]) => {
        setStreakStats(mergeLiveIntoStats(stats, live));
        setStreakHistory(history);
      })
      .catch(console.error);
  }, [token, user?.githubUsername]);

  const timezoneOffsetMinutes = new Date().getTimezoneOffset();

  useEffect(() => {
    if (!user || !token) return;
    const hasOffset = Number.isFinite(user.timezoneOffsetMinutes);
    if (hasOffset) return;

    updateProfile({ timezoneOffsetMinutes }).catch(() => {});
  }, [user, token, timezoneOffsetMinutes, updateProfile]);

  const saveProfile = async () => {
    setProfileError("");
    const next = githubUsername.trim();
    if (!next) {
      setProfileError("GitHub username is required.");
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({
        githubUsername: next,
        timezoneOffsetMinutes,
      });
    } catch (err) {
      setProfileError(err?.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const verifyToday = async () => {
    if (!user?.githubConnected) {
      setVerifyResult({
        verified: false,
        message: "Connect GitHub first.",
      });
      return;
    }

    setVerifyResult(null);
    setVerifying(true);
    try {
      const res = await api.github.verify(token, {});
      setVerifyResult(res);

      const liveData = await api.streak.live(user.githubUsername).catch(() => null);

      const [newStats, newHistory] = await Promise.all([
        api.streak.stats(token),
        api.streak.history(token),
      ]);
      setStreakStats(mergeLiveIntoStats(newStats, liveData));
      setStreakHistory(newHistory);
      refreshMe().catch(() => {});
    } catch (err) {
      setVerifyResult({ verified: false, message: err?.message || "Verify failed" });
    } finally {
      setVerifying(false);
    }
  };

  const connectGitHub = async () => {
    if (!token || connectingGithub) return;
    setGithubConnectError("");
    setConnectingGithub(true);

    try {
      const { authUrl } = await api.github.oauthStart(token);
      if (!authUrl) throw new Error("Failed to start GitHub OAuth");

      const popup = window.open(authUrl, "codestreak-github-oauth", "width=560,height=760");
      if (!popup) {
        throw new Error("Popup blocked. Allow popups and try again.");
      }

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("GitHub connect timed out"));
        }, 120000);

        const poll = setInterval(() => {
          if (popup.closed) {
            cleanup();
            reject(new Error("GitHub connect window was closed"));
          }
        }, 500);

        const onMessage = (event) => {
          if (!event.data || event.data.source !== "codestreak-github-oauth") return;
          cleanup();
          if (event.data.success) {
            resolve();
          } else {
            reject(new Error(event.data.error || "GitHub connect failed"));
          }
        };

        const cleanup = () => {
          clearTimeout(timeout);
          clearInterval(poll);
          window.removeEventListener("message", onMessage);
          if (!popup.closed) popup.close();
        };

        window.addEventListener("message", onMessage);
      });

      await refreshMe();
      setVerifyResult({ verified: true, message: "GitHub connected successfully. You can verify now." });
    } catch (err) {
      setGithubConnectError(err?.message || "Failed to connect GitHub");
    } finally {
      setConnectingGithub(false);
    }
  };

  const onAutoConnectExtension = async () => {
    if (!token || connectingExtension) return;
    await connectExtension();
  };

  useEffect(() => {
    if (token && getExtensionFocusStatus) {
      getExtensionFocusStatus().then((res) => {
        if (res?.success && res.payload?.focusMode) {
          setIsFocusing(true);
        }
      });
    }
  }, [token, getExtensionFocusStatus]);

  const handleStartFocus = async () => {
    const res = await startExtensionFocus();
    if (res.success) {
      setIsFocusing(true);
    } else {
      alert("Failed to start focus mode: " + res.error);
    }
  };

  const handleStopFocus = async () => {
    const res = await stopExtensionFocus();
    if (res.success) {
      setIsFocusing(false);
      refreshMe();
    } else {
      alert("Failed to stop focus mode: " + res.error);
    }
  };

  if (!user) return null;

  const displayedStreak =
    verifyResult && typeof verifyResult.streak === "number"
      ? verifyResult.streak
      : streakStats?.streak ?? user.streak ?? 0;
  const displayedLongestStreak =
    verifyResult && typeof verifyResult.longestStreak === "number"
      ? verifyResult.longestStreak
      : streakStats?.longestStreak ?? user.longestStreak ?? 0;

  const hasGithub = Boolean(user?.githubUsername);
  const hasGithubConnected = Boolean(user?.githubConnected);
  const isActiveToday = streakStats?.isActiveToday ?? false;
  const isStreakAtRisk = streakStats?.isStreakAtRisk ?? false;

  return (
    <div className="space-y-6">
      <section className="surface overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
          <div>
            <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">
              Dashboard
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Welcome back, {user.username}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
              GitHub pushes update your streak. Focus sessions sync into the backend so you can
              measure actual work, not just browser time.
            </p>

            <div className="mt-6">
              <StreakBadge
                streak={displayedStreak}
                isActiveToday={isActiveToday}
                isStreakAtRisk={isStreakAtRisk}
              />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="surface-soft p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Longest</div>
                <div className="mt-2 text-2xl font-black text-white">{displayedLongestStreak}</div>
                <div className="text-sm text-slate-400">days ever</div>
              </div>
              <div className="surface-soft p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Focus</div>
                <div className="mt-2 text-2xl font-black text-white">{formatMs(user.totalFocusTime)}</div>
                <div className="text-sm text-slate-400">total tracked</div>
              </div>
              <div className="surface-soft p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Rank</div>
                <div className="mt-2 text-2xl font-black text-white">
                  #{streakStats?.rank ?? "-"}
                </div>
                <div className="text-sm text-slate-400">
                  top {streakStats?.percentile ?? 0}%
                </div>
              </div>
            </div>
          </div>

          <div className="surface-soft p-5">
            <div className="text-sm font-semibold text-blue-200">Verification</div>
            <div className="mt-2 text-2xl font-black text-white">
              {hasGithubConnected ? "Ready to verify" : "Connect GitHub"}
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {hasGithubConnected
                ? `Connected as ${user.githubUsername}. Push code then verify.`
                : "Connect once with GitHub to enable streak verification."}
            </p>

            {!hasGithubConnected && (
              <button
                onClick={connectGitHub}
                disabled={connectingGithub}
                className="btn-secondary mt-4 w-full"
                type="button"
              >
                {connectingGithub ? "Connecting GitHub..." : "Connect GitHub"}
              </button>
            )}

            {githubConnectError && (
              <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                {githubConnectError}
              </div>
            )}

            <label className="mt-4 flex flex-col gap-2 text-sm text-slate-200">
              GitHub username
              <input
                className="field"
                value={verifyGithubUsername}
                onChange={(e) => setVerifyGithubUsername(e.target.value)}
                placeholder="octocat"
                type="text"
                disabled={hasGithubConnected}
              />
            </label>

            <button
              onClick={verifyToday}
              disabled={verifying || !hasGithubConnected}
              className="btn-primary mt-5 w-full"
            >
              {verifying ? "Verifying..." : "Verify today"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="surface p-6">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Activity</div>
            {streakStats?.stats && (
              <div className="text-xs text-slate-500">
                {streakStats.stats.thisWeek} this week
              </div>
            )}
          </div>
          <StreakCalendar weeks={streakHistory?.weeks} />
          {verifyResult && (
            <div
              className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                verifyResult.verified
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                  : "border-amber-400/20 bg-amber-400/10 text-amber-100"
              }`}
            >
              <div className="font-semibold">
                {verifyResult.verified ? "Verified!" : "Not verified"}
              </div>
              <div className="mt-1 text-slate-200/90">{verifyResult.message}</div>
            </div>
          )}
        </div>

        <div className="surface p-6">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Stats</div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="surface-soft p-4">
              <div className="text-2xl font-black text-white">
                {streakStats?.totalContributions ?? 0}
              </div>
              <div className="text-sm text-slate-400">Total contributions</div>
            </div>
            <div className="surface-soft p-4">
              <div className="text-2xl font-black text-white">
                {streakStats?.last30Days ?? 0}
              </div>
              <div className="text-sm text-slate-400">Last 30 days</div>
            </div>
            <div className="surface-soft p-4">
              <div className="text-2xl font-black text-white">
                {user.totalSessions || 0}
              </div>
              <div className="text-sm text-slate-400">Focus sessions</div>
            </div>
            <div className="surface-soft p-4">
              <div className="text-2xl font-black text-white">
                {formatMs(user.totalFocusTime)}
              </div>
              <div className="text-sm text-slate-400">Focus time</div>
            </div>
          </div>
        </div>
      </section>

      <section className="surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Extension</h2>
          <button
            onClick={onAutoConnectExtension}
            className="btn-secondary"
            disabled={!token || connectingExtension}
          >
            {connectingExtension ? "Connecting..." : "Connect extension"}
          </button>
        </div>

        <div className="mt-4 flex gap-3">
          {!isFocusing ? (
            <button onClick={handleStartFocus} className="btn-primary bg-emerald-500 hover:bg-emerald-400">
              Start Focus Mode
            </button>
          ) : (
            <button onClick={handleStopFocus} className="btn-primary bg-rose-500 hover:bg-rose-400">
              Stop Focus Mode
            </button>
          )}
        </div>

        {extensionStatus ? (
          <div className="mt-4 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-sm text-blue-100">
            {extensionStatus}
          </div>
        ) : null}
        
        {isFocusing && (
          <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            Focus mode is active. Distracting sites are blocked.
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.3)]">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Profile</div>
        {hasGithub ? (
          <div className="mt-3 inline-flex items-center rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-sm font-semibold text-blue-200">
            GitHub: {user.githubUsername}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            Add GitHub username to enable streak verification.
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-2 text-sm text-slate-200">
            GitHub username
            <input
              className="field"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
              placeholder="octocat"
              type="text"
            />
          </label>
          <button onClick={saveProfile} disabled={savingProfile} className="btn-secondary">
            {savingProfile ? "Saving..." : "Save profile"}
          </button>
        </div>

        {profileError ? (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {profileError}
          </div>
        ) : null}
      </section>
    </div>
  );
}
