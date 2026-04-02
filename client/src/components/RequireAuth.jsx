import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function RequireAuth({ children }) {
  const { token, loadingMe } = useAuth();

  if (loadingMe) {
    return (
      <div className="p-6 text-sm text-slate-600 dark:text-slate-300">
        Loading...
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

