import ForgetpasswordPage from "./pages/ForgetpasswordPage";
import Loginpage from "./pages/Loginpage";
import Signuppage from "./pages/Signuppage";
import ResetpasswordPage from "./pages/ResetpasswordPage";
import DashboardPage from "./pages/DashboardPage";
import OnboardingPage from "./pages/OnboardingPage";
import AdminDashboardpage from "./pages/adminpages/AdminDashboardpage";
import Module3SettingsPage from "./pages/adminpages/Module3SettingsPage";
import HolidayCalendarPage from "./pages/HolidayCalendarPage";
import AdminCalendarPage from "./pages/adminpages/AdminCalendarPage";
import AttendancePage from "./pages/AttendancePage";
import ProtectedRoute from "./ProtectedRoute";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";


function App() {
  return (
    <Routes>
      <Route path="/login" element={<Loginpage />} />
      <Route path="/signup" element={<Signuppage />} />
      <Route path="/forgot-password" element={<ForgetpasswordPage />} />
      <Route path="/reset-password" element={<ResetpasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/admin" element={<AdminDashboardpage />} />
        <Route path="/admin/dashboard" element={<AdminDashboardpage />} />
        <Route path="/admin/settings" element={<Module3SettingsPage />} />
        <Route path="/calendar" element={<CalendarRoute />} />
        <Route path="/attendance" element={<AttendancePage />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}



function CalendarRoute() {
  const { user } = useAuth();
  return user?.role === "admin" ? <AdminCalendarPage /> : <HolidayCalendarPage />;
}

export default App;
