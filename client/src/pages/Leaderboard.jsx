import { useEffect, useState } from "react";
import { api } from "../api/api.js";
import { useAuth } from "../auth/AuthContext.jsx";

function formatMs(ms) {
  if (!ms || ms <= 0) return "0m";
  const totalHours = ms / 3600000;
  if (totalHours >= 1) return `${totalHours.toFixed(1)}h`;
  return `${Math.floor(ms / 60000)}m`;
}

export default function Leaderboard() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await api.leaderboard.list(token);
      setRows(list || []);
    } catch (err) {
      setError(err?.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="space-y-5">
      <section className="surface p-6">
        <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
          Rankings
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white">Leaderboard</h1>
        <p className="mt-2 text-sm text-slate-400">
          Ranked by streak, then longest streak.
        </p>
        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}
      </section>

      <section className="surface p-6">
        {loading ? (
          <div className="text-sm text-slate-400">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="surface-soft px-4 py-5 text-sm text-slate-300">
            No leaderboard data yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-300">
              <thead className="text-left">
                <tr className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  <th className="py-3 pr-3">Rank</th>
                  <th className="py-3 pr-3">User</th>
                  <th className="py-3 pr-3">Streak</th>
                  <th className="py-3 pr-3">Longest</th>
                  <th className="py-3 pr-3">Total focus</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r._id}
                    className="border-t border-white/10"
                  >
                    <td className="py-4 pr-3 font-black text-white">{r.rank}</td>
                    <td className="py-4 pr-3">
                      <div className="flex items-center gap-3">
                        {r.avatarUrl ? (
                          <img
                            src={r.avatarUrl}
                            alt=""
                            className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-400/15"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-slate-700 ring-2 ring-emerald-400/10" />
                        )}
                        <div>
                          <div className="font-semibold text-white">{r.username}</div>
                          {r.githubUsername && (
                            <div className="text-xs text-slate-400">
                              GitHub: {r.githubUsername}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-3 font-semibold text-emerald-200">{r.streak || 0}</td>
                    <td className="py-4 pr-3 text-slate-300">{r.longestStreak || 0}</td>
                    <td className="py-4 pr-3 text-slate-300">{formatMs(r.totalFocusTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

