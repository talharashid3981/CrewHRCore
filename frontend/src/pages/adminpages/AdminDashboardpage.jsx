import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Download,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Settings,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";
import { exportMonthlyReport } from "../../api/auth.api";
import { useAuth } from "../../context/AuthContext";
import AccountSettings from "../AccountSettings";
import AdminEmployeesPage from "./AdminEmployeesPage";
import Module3SettingsPage from "./Module3SettingsPage";
import AdminLeavesPage from "./AdminLeavesPage";
import AdminAttendanceAutomationPage from "./AdminAttendanceAutomationPage";
import AdminOverview from "./AdminOverview";
import AdminReportsPage from "./AdminReportsPage";
import AdminCalendarPage from "./AdminCalendarPage";

const navItems = [
  { section: "Overview", label: "Dashboard", icon: LayoutDashboard },
  { section: "Employees", label: "Employees", icon: Users },
  { section: "Attendance", label: "Attendance", icon: CalendarCheck },
  { section: "Leaves", label: "Leave management", icon: ClipboardCheck },
  { section: "Calendar", label: "Calendar", icon: CalendarDays },
  { section: "Reports", label: "Reports", icon: FileBarChart },
];

export default function AdminDashboardpage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState("Overview");
  const [employeeStatus, setEmployeeStatus] = useState("");
  const [dashboardData, setDashboardData] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const signOut = async () => {
    await logout();
    navigate("/login");
  };

  const navigateTo = useCallback((target) => {
    if (target === "Approvals") {
      setEmployeeStatus("pending");
      setSection("Employees");
      return;
    }
    if (target === "Employees") setEmployeeStatus("");
    setSection(target);
  }, []);

  const exportReport = async () => {
    setExporting(true);
    setExportError("");
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    const month = `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
    try {
      const response = await exportMonthlyReport({ month });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `crewhr-report-${month}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setExportError(requestError.response?.data?.message || "Unable to export the monthly report.");
    } finally {
      setExporting(false);
    }
  };

  const firstName = user?.name?.split(" ")[0] || "Admin";
  const pendingTotal = (dashboardData?.summary.pending || 0) + (dashboardData?.summary.pendingLeaves || 0);

  return <main className="min-h-screen bg-[#F8FAFC] font-['Inter',sans-serif] text-slate-800 md:flex">
    <aside className="z-20 w-full border-b border-slate-200 bg-white px-4 py-4 md:sticky md:top-0 md:flex md:h-screen md:w-[212px] md:shrink-0 md:flex-col md:border-b-0 md:border-r md:px-[15px] md:py-6">
      <div className="flex items-center justify-between gap-3 px-1 md:px-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-[0_6px_14px_rgba(124,58,237,.25)]"><UsersRound size={19} /></span>
          <span className="min-w-0">
            <span className="block truncate font-['Poppins',sans-serif] text-[14px] font-semibold leading-4 tracking-[-.2px] text-slate-900">Crew HRCore</span>
            <span className="mt-0.5 block text-[9px] font-bold tracking-[.08em] text-violet-700">ADMIN</span>
          </span>
        </div>
        <button className="relative grid size-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-violet-50 hover:text-violet-700 md:hidden" onClick={() => navigateTo("Leaves")} aria-label="View pending requests">
          <Bell size={18} />
          {pendingTotal > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-rose-500" />}
        </button>
      </div>

      <nav className="mt-4 flex gap-1 overflow-x-auto pb-1 md:mt-6 md:grid md:overflow-visible md:pb-0" aria-label="Admin navigation">
        {navItems.map((item) => <NavButton
          key={item.section}
          active={section === item.section}
          onClick={() => navigateTo(item.section)}
          icon={item.icon}
          badge={item.section === "Employees" ? dashboardData?.summary.pending : item.section === "Leaves" ? dashboardData?.summary.pendingLeaves : undefined}
        >{item.label}</NavButton>)}
      </nav>

      <div className="mt-1 flex gap-1 overflow-x-auto md:mt-3 md:block md:overflow-visible">
        <p className="mb-2 hidden px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400 md:block">Settings</p>
        <NavButton active={section === "Office settings"} onClick={() => navigateTo("Office settings")} icon={Settings}>Office settings</NavButton>
        <NavButton active={section === "Account settings"} onClick={() => navigateTo("Account settings")} icon={UserRound}>Account settings</NavButton>
      </div>

      <div className="mt-auto hidden rounded-2xl bg-[#F3E8FF] p-3 md:block">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 font-['Poppins',sans-serif] text-[11px] font-semibold text-white">{initials(user?.name)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-slate-800">{user?.name || "Administrator"}</p>
            <p className="truncate text-[10px] text-slate-500">Administrator</p>
          </div>
          <button className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-white/70 hover:text-rose-600" onClick={signOut} aria-label="Sign out"><LogOut size={14} /></button>
        </div>
      </div>
    </aside>

    <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-4">
      {section === "Overview" ? <>
        <header className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <h1 className="font-['Poppins',sans-serif] text-[24px] font-semibold leading-tight tracking-[-.5px] text-slate-900">Dashboard</h1>
            <p className="mt-1 text-[12px] text-slate-500">{getGreeting()}, {firstName}. Here&apos;s what needs your attention today.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-violet-200 hover:text-violet-700 disabled:opacity-60" onClick={exportReport} disabled={exporting}>
              <Download size={14} className="text-violet-600" />{exporting ? "Preparing..." : "Export report"}
            </button>
            <button className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7116b9] to-[#853de8] px-3.5 text-[11px] font-semibold text-white shadow-[0_5px_12px_rgba(112,22,185,.22)] transition hover:brightness-105" onClick={() => navigateTo("Approvals")}>
              Review approvals
              {dashboardData?.summary.pending > 0 && <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[10px]">{dashboardData.summary.pending}</span>}
            </button>
            <button className="relative grid size-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-violet-700" onClick={() => navigateTo(pendingTotal ? "Leaves" : "Attendance")} aria-label="View operational alerts">
              <Bell size={15} />
              {pendingTotal > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500" />}
            </button>
            <div className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 shadow-sm">
              <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 font-['Poppins',sans-serif] text-[9px] font-semibold text-white">{initials(user?.name)}</span>
              <span className="max-w-20 truncate text-[11px] font-medium text-slate-700">{firstName}</span>
            </div>
          </div>
        </header>
        {exportError && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{exportError}</p>}
        <AdminOverview onDataLoaded={setDashboardData} onNavigate={navigateTo} />
      </> : <>
        {section === "Employees" && <AdminEmployeesPage key={employeeStatus} initialStatus={employeeStatus} embedded />}
        {section === "Office settings" && <div className="-mx-4 -my-5 sm:-mx-6 sm:-my-7 lg:-mx-8"><Module3SettingsPage embedded /></div>}
        {section === "Calendar" && <div className="-mx-4 -my-5 sm:-mx-6 sm:-my-7 lg:-mx-7"><AdminCalendarPage /></div>}
        {section === "Attendance" && <AdminAttendanceAutomationPage user={user} pendingCount={pendingTotal} onNavigate={navigateTo} />}
        {section === "Leaves" && <AdminLeavesPage user={user} onNavigate={navigateTo} />}
        {section === "Reports" && <AdminReportsPage />}
        {section === "Account settings" && <AccountSettings user={user} updateUser={updateUser} onSignOut={signOut} />}
      </>}
    </div>

    <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-800">{user?.name?.[0]?.toUpperCase() || "A"}</span>
          <span className="truncate text-xs font-medium text-slate-600">{user?.name || "Administrator"}</span>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600" onClick={signOut}><LogOut size={15} />Sign out</button>
      </div>
    </div>
  </main>;
}

function NavButton({ active, onClick, icon: Icon, children, badge }) {
  return <button
    type="button"
    onClick={onClick}
    aria-current={active ? "page" : undefined}
    className={`flex shrink-0 items-center gap-2.5 rounded-xl border-0 px-3 py-2.5 text-left text-xs transition md:w-full md:px-2.5 md:py-2.5 md:text-[12px] ${active ? "bg-gradient-to-r from-[#7315bd] to-[#8439ec] font-semibold text-white shadow-[0_6px_14px_rgba(124,58,237,.24)]" : "bg-transparent font-medium text-slate-500 hover:bg-violet-50 hover:text-violet-800"}`}
  >
    <Icon size={16} className="shrink-0" />
    <span className="whitespace-nowrap md:whitespace-normal">{children}</span>
    {badge > 0 && <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-violet-100 text-violet-700"}`}>{badge}</span>}
  </button>;
}

function initials(value = "") {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "HR";
}

function getGreeting() {
  const hour = Number(new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Asia/Karachi",
  }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
