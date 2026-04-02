import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Signup() {
  const navigate = useNavigate();
  const { signup, authError } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [githubUsername, setGithubUsername] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    setSubmitting(true);
    try {
      await signup({ username, email, password, githubUsername: githubUsername.trim() });
      navigate("/dashboard");
    } catch (err) {
      setLocalError(err?.message || "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hero-grid">
      <section className="surface p-8">
        <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
          Build your streak
        </div>
        <h1 className="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl">
          Create your account and lock in the workflow.
        </h1>
        <p className="mt-4 max-w-xl text-base text-slate-300">
          CodeStreak pairs a web dashboard with a Chrome extension so focus mode, GitHub
          verification, and social pressure work together.
        </p>
      </section>

      <section className="surface p-8">
        <h2 className="text-2xl font-bold text-white">Sign up</h2>
        <p className="mt-2 text-sm text-slate-400">You can add your GitHub username now or later.</p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            Username
            <input
              className="field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              type="text"
              required
              minLength={3}
              maxLength={30}
              placeholder="jane-doe"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            Email
            <input
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="you@example.com"
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
            GitHub username (optional)
            <input
              className="field"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
              type="text"
              placeholder="e.g. octocat"
            />
          </label>

          {(localError || authError) && (
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
              {localError || authError}
            </div>
          )}

          <button
            disabled={submitting}
            className="btn-primary mt-2"
            type="submit"
          >
            {submitting ? "Creating..." : "Create account"}
          </button>

          <div className="text-sm text-slate-400 mt-2">
            Already have an account?{" "}
            <Link className="font-semibold text-emerald-300 hover:text-emerald-200" to="/login">
              Login
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}

