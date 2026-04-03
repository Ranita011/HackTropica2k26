import { useEffect, useState } from "react";
import { api } from "../api/api.js";
import { useAuth } from "../auth/AuthContext.jsx";

function formatMs(ms) {
  if (!ms || ms <= 0) return "0m";
  const totalHours = ms / 3600000;
  if (totalHours >= 1) return `${totalHours.toFixed(1)}h`;
  return `${Math.floor(ms / 60000)}m`;
}

function FriendCard({ friend, onRemove, currentUserStreak }) {
  const streakDiff = friend.streak - currentUserStreak;
  const streakDiffText = streakDiff > 0 
    ? `+${streakDiff}` 
    : streakDiff < 0 
    ? `${streakDiff}` 
    : "same";

  return (
    <div className="surface-soft p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {friend.avatarUrl ? (
            <img
              src={friend.avatarUrl}
              alt=""
              className="h-12 w-12 rounded-full object-cover ring-2 ring-emerald-400/20"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-lg font-bold text-slate-300">
              {friend.username[0].toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{friend.username}</span>
              {friend.isActiveToday && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                  Active
                </span>
              )}
            </div>
            {friend.githubUsername && (
              <div className="text-xs text-slate-400">@{friend.githubUsername}</div>
            )}
            <div className="mt-1 text-xs text-slate-400">
              {friend.activityStatus}
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="flex items-center gap-1">
            <span className="text-xl">🔥</span>
            <span className="text-xl font-black text-white">{friend.streak}</span>
          </div>
          <div className="text-xs text-slate-400">day streak</div>
          {streakDiff !== 0 && (
            <div className={`mt-1 text-xs font-semibold ${
              streakDiff > 0 ? "text-rose-300" : "text-emerald-300"
            }`}>
              {streakDiffText} days
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
        <div className="flex gap-4 text-xs text-slate-400">
          <span>Best: {friend.longestStreak}d</span>
          <span>Focus: {formatMs(friend.totalFocusTime)}</span>
        </div>
        <button
          onClick={() => onRemove(friend.username)}
          className="text-xs text-slate-500 hover:text-rose-400"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export default function Friends() {
  const { token, user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [addUsername, setAddUsername] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await api.friends.list(token);
      setFriends(list || []);
    } catch (err) {
      setError(err?.message || "Failed to load friends");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
  }, [token]);

  const addFriend = async () => {
    const username = addUsername.trim();
    if (!username) return;
    setAdding(true);
    setError("");
    try {
      await api.friends.add({ username }, token);
      setAddUsername("");
      await load();
    } catch (err) {
      setError(err?.message || "Failed to add friend");
    } finally {
      setAdding(false);
    }
  };

  const removeFriend = async (username) => {
    setError("");
    try {
      await api.friends.remove({ username }, token);
      await load();
    } catch (err) {
      setError(err?.message || "Failed to remove friend");
    }
  };

  const currentUserStreak = user?.streak || 0;
  const activeFriends = friends.filter((f) => f.isActiveToday).length;

  return (
    <div className="space-y-5">
      <section className="surface p-6">
        <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
          Social pressure
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white">Friends</h1>
        <p className="mt-2 text-sm text-slate-400">
          Compare streaks and stay accountable together.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="surface-soft p-4">
            <div className="text-2xl font-black text-white">{friends.length}</div>
            <div className="text-sm text-slate-400">Friends</div>
          </div>
          <div className="surface-soft p-4">
            <div className="text-2xl font-black text-emerald-300">{activeFriends}</div>
            <div className="text-sm text-slate-400">Active today</div>
          </div>
          <div className="surface-soft p-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              <span className="text-2xl font-black text-white">{currentUserStreak}</span>
            </div>
            <div className="text-sm text-slate-400">Your streak</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-2 text-sm text-slate-200">
            Add by username
            <input
              className="field"
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
              placeholder="e.g. johndoe"
            />
          </label>
          <button
            onClick={addFriend}
            disabled={adding}
            className="btn-primary"
          >
            {adding ? "Adding..." : "Add friend"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}
      </section>

      <section className="surface p-6">
        {loading ? (
          <div className="text-sm text-slate-400">Loading...</div>
        ) : friends.length === 0 ? (
          <div className="surface-soft px-4 py-5 text-sm text-slate-300">
            No friends yet. Add someone to start competing!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {friends.map((friend) => (
              <FriendCard
                key={friend._id}
                friend={friend}
                onRemove={removeFriend}
                currentUserStreak={currentUserStreak}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

