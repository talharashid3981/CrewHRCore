import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Loader from "./components/Loader";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin" && location.pathname.startsWith("/admin")) {
    return <Navigate to="/dashboard" replace />;
  }
  if (user.role === "admin" && location.pathname === "/onboarding") {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (user.role === "admin" && location.pathname === "/dashboard") {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (user.role === "employee" && user.onboardingStatus !== "approved" && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  if (user.role === "employee" && user.onboardingStatus === "approved" && location.pathname === "/onboarding") {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
