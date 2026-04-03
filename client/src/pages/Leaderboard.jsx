import { useEffect, useState } from "react";
import { api } from "../api/api.js";
import { useAuth } from "../auth/AuthContext.jsx";

function formatMs(ms) {
  if (!ms || ms <= 0) return "0m";
  const totalHours = ms / 3600000;
  if (totalHours >= 1) return `${totalHours.toFixed(1)}h`;
  return `${Math.floor(ms / 60000)}m`;
}

function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return <span className="text-lg font-black text-slate-400">{rank}</span>;
}

function LeaderboardRow({ rank, user, isCurrentUser }) {
  return (
    <tr className={`border-t border-white/10 ${isCurrentUser ? "bg-emerald-500/10" : ""}`}>
      <td className="py-4 pr-4">
        <RankBadge rank={rank} />
      </td>
      <td className="py-4 pr-4">
        <div className="flex items-center gap-3">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-400/20"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-lg font-bold text-slate-300">
              {user.username[0].toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{user.username}</span>
              {user.isActiveToday && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                  Active
                </span>
              )}
              {isCurrentUser && (
                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300">
                  You
                </span>
              )}
            </div>
            {user.githubUsername && (
              <div className="text-xs text-slate-400">@{user.githubUsername}</div>
            )}
          </div>
        </div>
      </td>
      <td className="py-4 pr-4">
        <div className="flex items-center gap-1">
          <span className="text-lg">🔥</span>
          <span className="text-xl font-black text-emerald-300">{user.streak || 0}</span>
        </div>
      </td>
      <td className="py-4 pr-4 text-slate-300">{user.longestStreak || 0}</td>
      <td className="py-4 text-slate-300">{formatMs(user.totalFocusTime)}</td>
    </tr>
  );
}

export default function Leaderboard() {
  const { token, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [myRank, setMyRank] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await api.leaderboard.list(token);
      setRows(list || []);
      
      if (user?._id) {
        const rankInfo = await api.leaderboard.rank(token, user._id);
        setMyRank(rankInfo);
      }
    } catch (err) {
      setError(err?.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
  }, [token, user]);

  const topThree = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="space-y-5">
      <section className="surface p-6">
        <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
          Rankings
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white">Leaderboard</h1>
        <p className="mt-2 text-sm text-slate-400">
          Top coders ranked by streak. Stay active to keep your rank!
        </p>
        
        {myRank && (
          <div className="mt-4 inline-flex items-center gap-3 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3">
            <div className="text-sm text-slate-300">Your rank:</div>
            <span className="text-2xl font-black text-white">#{myRank.rank}</span>
            <div className="text-sm text-slate-400">
              Top {myRank.percentile}% of {myRank.totalUsers} users
            </div>
          </div>
        )}
        
        {error && (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}
      </section>

      {loading ? (
        <div className="surface p-6 text-sm text-slate-400">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="surface p-6 text-sm text-slate-300">
          No leaderboard data yet.
        </div>
      ) : (
        <>
          {topThree.length > 0 && (
            <section className="surface p-6">
              <div className="mb-4 text-xs uppercase tracking-[0.24em] text-slate-400">
                Top 3
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {topThree.map((user, index) => (
                  <div
                    key={user._id}
                    className={`surface-soft relative p-5 ${
                      index === 0 ? "border-2 border-yellow-400/30" : ""
                    }`}
                  >
                    {index === 0 && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-yellow-400/20 px-3 py-1 text-xs font-bold text-yellow-300">
                        🏆 Champion
                      </div>
                    )}
                    <div className="flex flex-col items-center text-center">
                      <div className="text-4xl">
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                      </div>
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt=""
                          className="mt-3 h-16 w-16 rounded-full object-cover ring-4 ring-emerald-400/20"
                        />
                      ) : (
                        <div className="mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-700 text-2xl font-bold text-slate-300">
                          {user.username[0].toUpperCase()}
                        </div>
                      )}
                      <div className="mt-2 font-bold text-white">{user.username}</div>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-xl">🔥</span>
                        <span className="text-2xl font-black text-emerald-300">
                          {user.streak || 0}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Longest: {user.longestStreak || 0}d
                      </div>
                      {user.isActiveToday && (
                        <div className="mt-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">
                          Active today
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section className="surface p-6">
              <div className="mb-4 text-xs uppercase tracking-[0.24em] text-slate-400">
                Rankings 4-{rows.length}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-slate-300">
                  <thead className="text-left">
                    <tr className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      <th className="pb-3 pr-4">Rank</th>
                      <th className="pb-3 pr-4">User</th>
                      <th className="pb-3 pr-4">Streak</th>
                      <th className="pb-3 pr-4">Longest</th>
                      <th className="pb-3">Focus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((r) => (
                      <LeaderboardRow
                        key={r._id}
                        rank={r.rank}
                        user={r}
                        isCurrentUser={r._id === user?._id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

