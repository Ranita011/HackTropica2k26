const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function normalizeBody(body) {
  if (body === undefined) return undefined;
  return JSON.stringify(body);
}

export async function apiFetch(path, { method = "GET", body, token } = {}) {
  const url = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: normalizeBody(body),
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && data.message) || res.statusText;
    throw new Error(message || `Request failed (${res.status})`);
  }

  return data;
}

export const api = {
  API_URL,
  auth: {
    signup: (payload) => apiFetch("/api/auth/signup", { method: "POST", body: payload }),
    login: (payload) => apiFetch("/api/auth/login", { method: "POST", body: payload }),
    me: (token) => apiFetch("/api/auth/me", { method: "GET", token }),
    updateProfile: (payload, token) =>
      apiFetch("/api/auth/profile", { method: "PUT", body: payload, token }),
  },
  friends: {
    list: (token) => apiFetch("/api/friends", { method: "GET", token }),
    add: (payload, token) =>
      apiFetch("/api/friends/add", { method: "POST", body: payload, token }),
    remove: (payload, token) =>
      apiFetch("/api/friends/remove", { method: "POST", body: payload, token }),
  },
  leaderboard: {
    list: (token) => apiFetch("/api/leaderboard", { method: "GET", token }),
    rank: (token, userId) => apiFetch(`/api/leaderboard/rank/${userId}`, { method: "GET", token }),
  },
  github: {
    verify: (token, payload) =>
      apiFetch("/api/check", { method: "POST", token, body: payload }),
    activity: (token) => apiFetch("/api/activity", { method: "GET", token }),
  },
  streak: {
    history: (token) => apiFetch("/api/streak/history", { method: "GET", token }),
    stats: (token) => apiFetch("/api/streak/stats", { method: "GET", token }),
  },
  focus: {
    syncSession: (payload, token) =>
      apiFetch("/api/focus/session", { method: "POST", body: payload, token }),
  },
};

