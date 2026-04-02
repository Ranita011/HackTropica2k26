import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Friends from "./pages/Friends.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Layout from "./components/Layout.jsx";
import { useAuth } from "./auth/AuthContext.jsx";

function HomeRedirect() {
  const { token, loadingMe } = useAuth();

  if (loadingMe) {
    return null;
  }

  return <Navigate to={token ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/friends"
              element={
                <RequireAuth>
                  <Friends />
                </RequireAuth>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <RequireAuth>
                  <Leaderboard />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
