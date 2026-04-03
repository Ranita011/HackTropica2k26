import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/api.js";

const AuthContext = createContext(null);
const TOKEN_KEY = "codestreak_token";

async function connectExtensionWithToken(jwtToken, apiBaseUrl) {
  if (!jwtToken) {
    return { success: false, error: "Missing token" };
  }

  if (typeof window === "undefined" || typeof window.postMessage !== "function") {
    return { success: false, error: "Window messaging is unavailable" };
  }

  const connectOnce = () => {
    const requestId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return new Promise((resolve) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          window.removeEventListener("message", onResult);
          resolve({ success: false, error: "Extension did not respond" });
        }
      }, 3000);

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
            apiBaseUrl,
          },
        },
        "*"
      );
    });
  };

  let result = await connectOnce();
  if (result.success) return result;

  await new Promise((resolve) => setTimeout(resolve, 350));
  result = await connectOnce();
  if (result.success) return result;

  return connectOnce();
}

async function sendExtensionCommand(type, payload = {}) {
  if (typeof window === "undefined" || typeof window.postMessage !== "function") {
    return { success: false, error: "Window messaging is unavailable" };
  }

  const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        window.removeEventListener("message", onResult);
        resolve({ success: false, error: "Extension did not respond" });
      }
    }, 3000);

    const onResult = (event) => {
      if (event.source !== window) return;

      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.source !== "codestreak-extension") return;
      if (data.type !== `${type}_RESULT`) return;
      if (data.requestId !== requestId) return;

      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        window.removeEventListener("message", onResult);
        resolve({
          success: Boolean(data.success),
          error: data.error || "",
          payload: data.payload || {}
        });
      }
    };

    window.addEventListener("message", onResult);
    window.postMessage(
      {
        source: "codestreak-web",
        type,
        requestId,
        payload,
      },
      "*"
    );
  });
}

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
  const [extensionStatus, setExtensionStatus] = useState("");
  const [connectingExtension, setConnectingExtension] = useState(false);
  const autoConnectedTokenRef = useRef("");

  const connectExtension = async () => {
    if (!token) {
      return { success: false, error: "Missing token" };
    }

    setConnectingExtension(true);
    setExtensionStatus("Checking extension...");

    try {
      const result = await connectExtensionWithToken(token, api.API_URL);
      if (result.success) {
        setExtensionStatus("Extension connected.");
        setTimeout(() => setExtensionStatus(""), 2000);
      } else {
        setExtensionStatus("Extension ready (auth auto-synced).");
        setTimeout(() => setExtensionStatus(""), 3000);
      }

      return result;
    } finally {
      setConnectingExtension(false);
    }
  };

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

  useEffect(() => {
    if (!token) {
      autoConnectedTokenRef.current = "";
      setExtensionStatus("");
      setConnectingExtension(false);
      return;
    }

    if (autoConnectedTokenRef.current === token) return;
    autoConnectedTokenRef.current = token;

    const currentToken = token;

    setConnectingExtension(true);
    setExtensionStatus("Syncing with extension...");

    connectExtensionWithToken(currentToken, api.API_URL)
      .then((result) => {
        if (autoConnectedTokenRef.current !== currentToken) return;

        if (result.success) {
          setExtensionStatus("Extension connected.");
          setTimeout(() => setExtensionStatus(""), 2000);
        } else {
          setExtensionStatus("Extension ready (auth auto-synced).");
          setTimeout(() => setExtensionStatus(""), 3000);
        }
      })
      .finally(() => {
        if (autoConnectedTokenRef.current === currentToken) {
          setConnectingExtension(false);
        }
      });
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        ...value,
        extensionStatus,
        connectingExtension,
        connectExtension,
        startExtensionFocus: () => sendExtensionCommand("CODESTREAK_START_FOCUS"),
        stopExtensionFocus: () => sendExtensionCommand("CODESTREAK_STOP_FOCUS"),
        getExtensionFocusStatus: () => sendExtensionCommand("CODESTREAK_GET_STATUS"),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}