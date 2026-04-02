import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Layout({ children }) {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  const authPage = location.pathname === "/login" || location.pathname === "/signup";

  const navClass = ({ isActive }) =>
    [
      "rounded-full px-4 py-2 text-sm font-medium transition",
      isActive
        ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25"
        : "text-slate-300 hover:bg-white/5 hover:text-white",
    ].join(" ");

  return (
    <div className="app-shell text-slate-100">
      <header className="topbar">
        <div className="topbar-inner mx-auto w-full max-w-6xl">
          <Link to={token ? "/dashboard" : "/login"} className="flex items-center gap-3 group">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 shadow-[0_0_40px_rgba(16,185,129,0.18)]">
              <span className="text-lg font-black text-emerald-200">C</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm uppercase tracking-[0.28em] text-emerald-300/70">
                CodeStreak
              </div>
              <div className="text-base font-semibold text-white">Enforcer</div>
            </div>
          </Link>

          {!authPage && token ? (
            <nav className="topbar-nav hidden md:flex">
              <NavLink to="/dashboard" className={navClass}>
                Dashboard
              </NavLink>
              <NavLink to="/friends" className={navClass}>
                Friends
              </NavLink>
              <NavLink to="/leaderboard" className={navClass}>
                Leaderboard
              </NavLink>
            </nav>
          ) : null}

          <div className="flex items-center gap-3">
            {token ? (
              <>
                {user ? (
                  <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 sm:block">
                    Signed in as <span className="font-semibold text-white">{user.username}</span>
                  </div>
                ) : null}
                <button
                  onClick={onLogout}
                  className="btn-ghost rounded-full px-4 py-2 text-sm font-medium text-slate-200"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="btn-ghost rounded-full px-4 py-2 text-sm font-medium text-slate-200"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="btn-primary rounded-full px-4 py-2 text-sm font-semibold text-slate-950"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}

