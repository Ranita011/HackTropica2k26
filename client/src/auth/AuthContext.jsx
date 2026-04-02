import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/api.js";

const AuthContext = createContext(null);
const TOKEN_KEY = "codestreak_token";

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [authError, setAuthError] = useState("");

  const value = useMemo(
    () => ({
      token,
      user,
      loadingMe,
      authError,
      signup: async ({ username, email, password, githubUsername }) => {
        setAuthError("");
        const data = await api.auth.signup({
          username,
          email,
          password,
          githubUsername,
        });
        if (!data?.token) throw new Error("Signup succeeded but token missing");
        const userData = { ...data };
        delete userData.token;
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        setUser(userData);
        return data;
      },
      login: async ({ email, password }) => {
        setAuthError("");
        const data = await api.auth.login({ email, password });
        if (!data?.token) throw new Error("Login succeeded but token missing");
        const userData = { ...data };
        delete userData.token;
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        setUser(userData);
        return data;
      },
      logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setUser(null);
      },
      refreshMe: async () => {
        if (!token) {
          setUser(null);
          return;
        }
        setLoadingMe(true);
        setAuthError("");
        try {
          const me = await api.auth.me(token);
          setUser(me);
        } catch (err) {
          setAuthError(err?.message || "Failed to load profile");
          setUser(null);
          localStorage.removeItem(TOKEN_KEY);
          setToken("");
        } finally {
          setLoadingMe(false);
        }
      },
      updateProfile: async ({ githubUsername, timezoneOffsetMinutes }) => {
        if (!token) throw new Error("Not authenticated");
        setAuthError("");
        const payload = {
          githubUsername,
          timezoneOffsetMinutes,
        };
        const updated = await api.auth.updateProfile(payload, token);
        setUser(updated);
        return updated;
      },
    }),
    [token, user, loadingMe, authError]
  );

  useEffect(() => {
    // Keep profile in sync across hard reloads.
    value.refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // When token changes (login/logout), refresh profile.
    if (token) value.refreshMe();
    else setUser(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

