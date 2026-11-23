import { useState } from "react";
import {
  CalendarDays,
  Clock3,
  LayoutDashboard,
  LogOut,
  Menu,
  SlidersHorizontal,
  Sun,
  UsersRound,
  X,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import AttendancePage from "./AttendancePage";
import HolidayCalendarPage from "./HolidayCalendarPage";
import LeavePage from "./LeavePage";
import EmployeeOverview from "./EmployeeOverview";
import AccountSettings from "./AccountSettings";
import { useAuth } from "../context/AuthContext";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "attendance", label: "My attendance", icon: Clock3 },
  { id: "leave", label: "My leave", icon: Sun },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "settings", label: "Account settings", icon: SlidersHorizontal },
];
const tabIds = new Set(tabs.map(({ id }) => id));

const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "U";

export default function DashboardPage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = tabIds.has(requestedTab) ? requestedTab : "dashboard";
  const [menuOpen, setMenuOpen] = useState(false);

  const setActiveTab = (tab) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      if (tab === "dashboard") nextParams.delete("tab");
      else nextParams.set("tab", tab);
      return nextParams;
    });
  };

  const signOut = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] font-['Inter',sans-serif] text-slate-800 lg:flex">
      <aside className="relative z-30 border-b border-[#E9E5F7] bg-white p-3 sm:px-5 sm:py-3 lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[212px] lg:flex-col lg:border-b-0 lg:border-r lg:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 px-1 lg:px-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center">
              <BrandLogo alt="" />
            </span>
            <span className="truncate font-['Poppins',sans-serif] text-[16px] font-semibold tracking-[-0.3px] text-slate-900">
              Crew HRCore
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 lg:hidden">
            <button
              aria-controls="dashboard-navigation"
              aria-expanded={menuOpen}
              aria-label={
                menuOpen ? "Close navigation menu" : "Open navigation menu"
              }
              className="grid h-10 w-10 place-items-center rounded-lg border border-[#E9E5F7] bg-white text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800"
              onClick={() => setMenuOpen((isOpen) => !isOpen)}
              type="button"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <nav
          aria-label="Main navigation"
          className={`${menuOpen ? "grid" : "hidden"} absolute left-0 right-0 top-full z-50 gap-1 border-b border-[#E9E5F7] bg-white p-3 shadow-[0_14px_24px_rgba(106,13,173,0.12)] lg:static lg:mt-7 lg:grid lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
          id="dashboard-navigation"
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              aria-current={activeTab === id ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition ${
                activeTab === id
                  ? "bg-gradient-to-r from-[#6A0DAD] to-[#7C3AED] font-semibold text-white shadow-[0_8px_18px_rgba(106,13,173,0.24)]"
                  : "text-slate-600 hover:bg-violet-50 hover:text-violet-800"
              }`}
              key={id}
              onClick={() => {
                setActiveTab(id);
                setMenuOpen(false);
              }}
              type="button"
            >
              <Icon className="shrink-0" size={17} strokeWidth={1.9} />
              {label}
            </button>
          ))}
          {user?.role === "admin" && (
            <>
              <span className="my-1 hidden border-t border-slate-100 lg:block" />
              <button
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-slate-600 transition hover:bg-violet-50 hover:text-violet-800"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/admin/dashboard");
                }}
                type="button"
              >
                <UsersRound size={17} strokeWidth={1.9} />
                Admin workspace
              </button>
            </>
          )}
          <div className="mt-2 flex items-center gap-3 border-t border-slate-100 px-2 pt-3 lg:hidden">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-purple-100 font-['Poppins',sans-serif] text-[12px] font-semibold text-violet-700">
              {initials(user?.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-slate-900">
                {user?.name || "Employee"}
              </span>
              <span className="block truncate text-[12px] text-slate-500">
                {user?.role === "admin" ? "Administrator" : "Employee"}
              </span>
            </span>
            <button
              aria-label="Sign out"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-violet-50 hover:text-violet-800"
              onClick={signOut}
              title="Sign out"
              type="button"
            >
              <LogOut size={16} />
            </button>
          </div>
        </nav>

        <div className="mt-auto hidden items-center gap-3 rounded-lg bg-[#F3E8FF] p-3 lg:flex">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-purple-800 font-['Poppins',sans-serif] text-[12px] font-semibold text-white">
            {initials(user?.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold text-slate-900">
              {user?.name || "Employee"}
            </span>
            <span className="block truncate text-[12px] text-slate-500">
              {user?.role === "admin"
                ? "Administrator"
                : `Employee · ${
                    user?.onboardingStatus
                      ? user.onboardingStatus[0].toUpperCase() +
                        user.onboardingStatus.slice(1)
                      : "Approved"
                  }`}
            </span>
          </span>
          <button
            aria-label="Sign out"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white hover:text-violet-800"
            onClick={signOut}
            title="Sign out"
            type="button"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <section className="min-w-0 flex-1 p-4 sm:p-6 lg:ml-[212px] lg:px-[27px] lg:py-6">
        {activeTab === "dashboard" && (
          <>
            <DashboardHeader />
            <EmployeeOverview
              onNavigate={(tab) => setActiveTab(tab)}
            />
          </>
        )}
        {activeTab === "attendance" && (
          <>
            <DashboardHeader
              title="My attendance"
              subtitle="Check in, check out and review your attendance history."
            />
            <AttendancePage embedded />
          </>
        )}
        {activeTab === "calendar" && (
          <div className="-m-4 min-w-0 sm:-m-6 lg:-my-5 lg:-mx-[27px]">
            <HolidayCalendarPage embedded />
          </div>
        )}
        {activeTab === "leave" && (
          <>
            <DashboardHeader
              title="My leave"
              subtitle="Check balances, request time off and track your requests."
            />
            <LeavePage />
          </>
        )}
        {activeTab === "settings" && (
          <AccountSettings
            user={user}
            updateUser={updateUser}
            onSignOut={signOut}
          />
        )}
      </section>
    </main>
  );
}
function DashboardHeader({ title = "Dashboard", subtitle }) {
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Karachi",
  }).format(new Date());

  return (
    <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="font-['Poppins',sans-serif] text-[28px] font-semibold leading-[1.2] tracking-[-0.6px] text-slate-900 xl:text-[30px]">
          {title}
        </h1>
        <p className="mt-1 text-[14px] leading-[1.5] text-slate-600 sm:text-[15px]">
          {subtitle || `${todayLabel} · Asia/Karachi`}
        </p>
      </div>
    </header>
  );
}
