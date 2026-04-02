import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Login() {
  const navigate = useNavigate();
  const { login, authError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate("/dashboard");
    } catch (err) {
      setLocalError(err?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
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
            {submitting ? "Signing in..." : "Sign in"}
          </button>

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

