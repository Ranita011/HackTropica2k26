import { useEffect, useRef, useState } from "react";
import { api } from "../api/api.js";
import { useAuth } from "../auth/AuthContext.jsx";

function formatMs(ms) {
  if (!ms || ms <= 0) return "0m";
  const totalHours = ms / 3600000;
  if (totalHours >= 1) return `${totalHours.toFixed(1)}h`;
  const totalMins = Math.floor(ms / 60000);
  return `${totalMins}m`;
}

export default function Dashboard() {
  const { user, token, updateProfile, refreshMe } = useAuth();
  const [githubUsername, setGithubUsername] = useState(user?.githubUsername || "");
  const [verifyGithubUsername, setVerifyGithubUsername] = useState(
    user?.githubUsername || ""
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [extensionStatus, setExtensionStatus] = useState("");
  const [connectingExtension, setConnectingExtension] = useState(false);
  const autoConnectedTokenRef = useRef("");

  useEffect(() => {
    setGithubUsername(user?.githubUsername || "");
    setVerifyGithubUsername(user?.githubUsername || "");
  }, [user]);

  const timezoneOffsetMinutes = new Date().getTimezoneOffset();

  // Keep timezone in sync even if the user didn't touch their GitHub field.
  useEffect(() => {
    if (!user || !token) return;
    const hasOffset = Number.isFinite(user.timezoneOffsetMinutes);
    if (hasOffset) return;

    updateProfile({ timezoneOffsetMinutes }).catch(() => {
      // Non-blocking: streak verification will fall back to server-local time.
    });
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
    const usernameForCheck = verifyGithubUsername.trim();
    if (!usernameForCheck) {
      setVerifyResult({
        verified: false,
        message: "Please enter your GitHub username before verifying.",
      });
      return;
    }

    setVerifyResult(null);
    setVerifying(true);
    try {
      const res = await api.github.verify(token, {
        githubUsername: usernameForCheck,
      });
      setVerifyResult(res);

      if (user?.githubUsername !== usernameForCheck) {
        updateProfile({
          githubUsername: usernameForCheck,
          timezoneOffsetMinutes,
        }).catch(() => {
          // Non-blocking: verify result is already available.
        });
      }

      // Pull latest persisted streak/profile values after a successful verify.
      refreshMe().catch(() => {
        // Non-blocking: verify result is already shown in the UI.
      });
    } catch (err) {
      setVerifyResult({ verified: false, message: err?.message || "Verify failed" });
    } finally {
      setVerifying(false);
    }
  };

  const connectExtensionWithToken = async (jwtToken) => {
    if (!jwtToken) {
      return { success: false, error: "Missing token" };
    }

    const requestId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const result = await new Promise((resolve) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          window.removeEventListener("message", onResult);
          resolve({ success: false, error: "Extension did not respond" });
        }
      }, 1500);

      const onResult = (event) => {
        if (event.source !== window) return;

        const data = event.data;
        if (!data || typeof data !== "object") return;
        if (data.source !== "codestreak-extension") return;
        if (data.type !== "CODESTREAK_SET_AUTH_RESULT") return;
        if (data.requestId !== requestId) return;

        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          window.removeEventListener("message", onResult);
          resolve({
            success: Boolean(data.success),
            error: data.error || "",
          });
        }
      };

      window.addEventListener("message", onResult);
      window.postMessage(
        {
          source: "codestreak-web",
          type: "CODESTREAK_SET_AUTH",
          requestId,
          payload: {
            jwtToken,
            apiBaseUrl: api.API_URL,
          },
        },
        "*"
      );
    });

    return result;
  };

  useEffect(() => {
    if (!token) return;
    if (autoConnectedTokenRef.current === token) return;

    autoConnectedTokenRef.current = token;

    let cancelled = false;
    setConnectingExtension(true);

    connectExtensionWithToken(token)
      .then((result) => {
        if (cancelled) return;

        if (result.success) {
          setExtensionStatus("Extension auto-connected.");
          setTimeout(() => setExtensionStatus(""), 2000);
          return;
        }

        setExtensionStatus(
          `Auto-connect failed: ${result.error || "Unknown error"}`
        );
      })
      .finally(() => {
        if (!cancelled) {
          setConnectingExtension(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const onAutoConnectExtension = async () => {
    if (!token || connectingExtension) return;

    setConnectingExtension(true);
    setExtensionStatus("Connecting extension...");
    try {
      const result = await connectExtensionWithToken(token);
      if (result.success) {
        setExtensionStatus("Extension connected successfully.");
      } else {
        setExtensionStatus(`Extension connection failed: ${result.error || "Unknown error"}`);
      }
    } finally {
      setConnectingExtension(false);
      setTimeout(() => setExtensionStatus(""), 3000);
    }
  };

  if (!user) return null;

  const displayedStreak =
    verifyResult && typeof verifyResult.streak === "number"
      ? verifyResult.streak
      : user.streak || 0;
  const displayedLongestStreak =
    verifyResult && typeof verifyResult.longestStreak === "number"
      ? verifyResult.longestStreak
      : user.longestStreak || 0;

  const hasGithub = Boolean(user?.githubUsername);

  return (
    <div className="space-y-6">
      <section className="surface overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
          <div>
            <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
              Dashboard
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Welcome back, {user.username}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
              GitHub pushes update your streak. Focus sessions sync into the backend so you can
              measure actual work, not just browser time.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="surface-soft p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Streak</div>
                <div className="mt-2 text-2xl font-black text-white">{displayedStreak}</div>
                <div className="text-sm text-slate-400">current days</div>
              </div>
              <div className="surface-soft p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Focus</div>
                <div className="mt-2 text-2xl font-black text-white">{formatMs(user.totalFocusTime)}</div>
                <div className="text-sm text-slate-400">total tracked time</div>
              </div>
              <div className="surface-soft p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Sessions</div>
                <div className="mt-2 text-2xl font-black text-white">{user.totalSessions || 0}</div>
                <div className="text-sm text-slate-400">focus sessions</div>
              </div>
            </div>
          </div>

          <div className="surface-soft p-5">
            <div className="text-sm font-semibold text-emerald-200">Verification status</div>
            <div className="mt-2 text-2xl font-black text-white">
              {hasGithub ? "Ready to verify" : "Needs GitHub setup"}
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {hasGithub
                ? `Your profile is linked to ${user.githubUsername}. Hit verify after pushing code.`
                : "Add your GitHub username to make streak checks work."}
            </p>

            <label className="mt-4 flex flex-col gap-2 text-sm text-slate-200">
              GitHub username for verification
              <input
                className="field"
                value={verifyGithubUsername}
                onChange={(e) => setVerifyGithubUsername(e.target.value)}
                placeholder="octocat"
                type="text"
              />
            </label>

            <button
              onClick={verifyToday}
              disabled={verifying || !verifyGithubUsername.trim()}
              className="btn-primary mt-5 w-full"
            >
              {verifying ? "Verifying..." : "Verify today"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="surface p-6">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Streak history</div>
          <div className="mt-2 text-3xl font-black text-white">
            {displayedStreak} day{displayedStreak === 1 ? "" : "s"}
          </div>
          <div className="mt-2 text-sm text-slate-400">
            Longest streak: <span className="font-semibold text-slate-100">{displayedLongestStreak}</span>
          </div>
          {verifyResult ? (
            <div
              className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                verifyResult.verified
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                  : "border-amber-400/20 bg-amber-400/10 text-amber-100"
              }`}
            >
              <div className="font-semibold">
                {verifyResult.verified ? "Verified" : "Not verified"}
              </div>
              <div className="mt-1 text-slate-200/90">{verifyResult.message}</div>
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.3)]">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Profile</div>
          {hasGithub ? (
            <div className="mt-3 inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-sm font-semibold text-emerald-200">
              GitHub: {user.githubUsername}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              Add your GitHub username to enable streak verification.
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
            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className="btn-secondary"
            >
              {savingProfile ? "Saving..." : "Save profile"}
            </button>
          </div>

          {profileError ? (
            <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
              {profileError}
            </div>
          ) : null}
        </div>
      </section>

      <section className="surface p-6">
        <h2 className="text-lg font-bold text-white">Extension setup</h2>
        <p className="mt-2 text-sm text-slate-400">
          Connect your extension directly from this dashboard. Your token is sent in the background
          and is never shown in the UI.
        </p>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-end">
          <button
            onClick={onAutoConnectExtension}
            className="btn-primary"
            disabled={!token || connectingExtension}
          >
            {connectingExtension ? "Connecting..." : "Connect extension"}
          </button>
        </div>

        {extensionStatus ? (
          <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            {extensionStatus}
          </div>
        ) : null}
      </section>
    </div>
  );
}

