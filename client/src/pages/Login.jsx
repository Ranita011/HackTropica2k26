import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/api.js";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Login() {
  const navigate = useNavigate();
  const { login, updateProfile, authError } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [localError, setLocalError] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [signedIn, setSignedIn] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    setVerifyResult(null);
    setSignedIn(false);
    setSubmitting(true);
    try {
      const data = await login({ email: identifier, password });
      const usernameForCheck = githubUsername.trim();

      if (!usernameForCheck) {
        navigate("/dashboard");
        return;
      }

      setVerifying(true);
      const res = await api.github.verify(data.token, {
        githubUsername: usernameForCheck,
      });
      setVerifyResult(res);
      setSignedIn(true);

      if (data?.githubUsername !== usernameForCheck) {
        updateProfile({
          githubUsername: usernameForCheck,
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        }).catch(() => {});
      }
    } catch (err) {
      setLocalError(err?.message || "Login failed");
      setSignedIn(false);
      setVerifyResult(null);
    } finally {
      setVerifying(false);
      setSubmitting(false);
    }
  };

  const continueToDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <div className="hero-grid">
      <section className="surface p-8">
        <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
          Daily discipline
        </div>
        <h1 className="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl">
          Log in and keep the streak moving.
        </h1>
        <p className="mt-4 max-w-xl text-base text-slate-300">
          Focus sessions, GitHub verification, and social accountability all live in one loop.
          The dashboard and the extension use the same token.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ["Focus", "Block distractions during work sessions"],
            ["Verify", "GitHub pushes update your streak"],
            ["Compete", "Friends and leaderboard keep pressure on"],
          ].map(([title, body]) => (
            <div key={title} className="surface-soft p-4">
              <div className="text-sm font-semibold text-white">{title}</div>
              <div className="mt-1 text-sm text-slate-400">{body}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="surface p-8">
        <h2 className="text-2xl font-bold text-white">Welcome back</h2>
        <p className="mt-2 text-sm text-slate-400">Use the same account as the extension.</p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            Email or username
            <input
              className="field"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              type="text"
              required
              placeholder="you@example.com or demouser"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            Password
            <input
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-200">
            GitHub username for verification
            <input
              className="field"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
              type="text"
              placeholder="octocat"
            />
          </label>

          <p className="text-xs text-slate-400">
            If you enter a GitHub username here, verification runs immediately after sign in.
          </p>

          {(localError || authError) && (
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
              {localError || authError}
            </div>
          )}

          <button
            disabled={submitting || verifying}
            className="btn-primary mt-2"
            type="submit"
          >
            {verifying
              ? "Verifying..."
              : submitting
              ? "Signing in..."
              : githubUsername.trim()
              ? "Sign in and verify"
              : "Sign in"}
          </button>

          {signedIn && verifyResult && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
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

          {signedIn && (
            <button onClick={continueToDashboard} className="btn-secondary mt-1" type="button">
              Continue to dashboard
            </button>
          )}

          <div className="text-sm text-slate-400 mt-2">
            No account yet?{" "}
            <Link className="font-semibold text-emerald-300 hover:text-emerald-200" to="/signup">
              Create one
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}

