import { useEffect, useState } from "react";
import { api } from "../api/api.js";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Friends() {
  const { token } = useAuth();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className="space-y-5">
      <section className="surface p-6">
        <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
          Social pressure
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white">Friends</h1>
        <p className="mt-2 text-sm text-slate-400">
          Add people by username, compare streaks, and remove dead weight when needed.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-2 text-sm text-slate-200">
            Add by GitHub or username
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

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}
      </section>

      <section className="surface p-6">
        {loading ? (
          <div className="text-sm text-slate-400">Loading...</div>
        ) : friends.length === 0 ? (
          <div className="surface-soft px-4 py-5 text-sm text-slate-300">
            You have no friends yet. Add someone to start a streak challenge.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {friends.map((f) => (
              <div
                key={f._id}
                className="surface-soft flex items-center justify-between gap-4 p-4"
              >
                <div className="flex items-center gap-3">
                  {f.avatarUrl ? (
                    <img
                      src={f.avatarUrl}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover ring-2 ring-emerald-400/20"
                    />
                  ) : (
                    <div className="h-11 w-11 rounded-full bg-slate-700 ring-2 ring-emerald-400/10" />
                  )}
                  <div>
                    <div className="font-semibold text-white">{f.username}</div>
                    <div className="text-xs text-slate-400">
                      Streak: {f.streak || 0}d
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeFriend(f.username)}
                  className="btn-ghost px-3 py-2 text-sm font-medium text-slate-200"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

