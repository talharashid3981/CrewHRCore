import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import { exportMonthlyReport, listEmployees } from "../../api/auth.api";
import { useAuth } from "../../context/AuthContext";
import AccountSettings from "../AccountSettings";
import AdminEmployeesPage from "./AdminEmployeesPage";
import Module3SettingsPage from "./Module3SettingsPage";
import HolidayCalendarPage from "../HolidayCalendarPage";
import AdminLeavesPage from "./AdminLeavesPage";
import AdminAttendanceAutomationPage from "./AdminAttendanceAutomationPage";
import AdminOverview from "./AdminOverview";
import AdminReportsPage from "./AdminReportsPage";

const navItems = [
  { section: "Overview", label: "Dashboard", icon: LayoutDashboard },
  { section: "Employees", label: "Employees", icon: Users },
  { section: "Attendance", label: "Attendance", icon: CalendarCheck },
  { section: "Calendar", label: "Calendar", icon: CalendarDays },
  { section: "Leaves", label: "Leave management", icon: ClipboardCheck },
  { section: "Reports", label: "Reports", icon: FileBarChart },
];

export default function AdminDashboardpage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState("Overview");
  const [employeeStatus, setEmployeeStatus] = useState("");
  const [dashboardData, setDashboardData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [employeesError, setEmployeesError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    let active = true;
    listEmployees({ limit: 100 })
      .then((result) => {
        if (active) setEmployees(result.users || []);
      })
      .catch((requestError) => {
        if (active) setEmployeesError(requestError.response?.data?.message || "Unable to load employee details.");
      });
    return () => { active = false; };
  }, []);

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

  return <main className="min-h-screen bg-[#F7F7FB] font-sans text-slate-800 md:flex">
    <aside className="z-20 w-full border-b border-slate-200 bg-white px-4 py-4 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-b-0 md:border-r md:px-4 md:py-6">
      <div className="flex items-center justify-between gap-3 px-1 md:px-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-800 to-violet-500 text-base font-bold text-white shadow-sm">C</span>
          <span className="truncate text-sm font-bold tracking-tight text-slate-900">Crew HRCore</span>
        </div>
        <button className="relative grid size-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-violet-50 hover:text-violet-700 md:hidden" onClick={() => navigateTo("Leaves")} aria-label="View pending requests">
          <Bell size={18} />
          {pendingTotal > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-rose-500" />}
        </button>
      </div>

      <nav className="mt-4 flex gap-1 overflow-x-auto pb-1 md:mt-8 md:grid md:overflow-visible md:pb-0" aria-label="Admin navigation">
        {navItems.map((item) => <NavButton
          key={item.section}
          active={section === item.section}
          onClick={() => navigateTo(item.section)}
          icon={item.icon}
          badge={item.section === "Employees" ? dashboardData?.summary.pending : item.section === "Leaves" ? dashboardData?.summary.pendingLeaves : undefined}
        >{item.label}</NavButton>)}
      </nav>

      <div className="mt-1 flex gap-1 overflow-x-auto md:mt-4 md:block md:overflow-visible">
        <p className="mb-2 hidden px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400 md:block">Settings</p>
        <NavButton active={section === "Office settings"} onClick={() => navigateTo("Office settings")} icon={Settings}>Office settings</NavButton>
        <NavButton active={section === "Account settings"} onClick={() => navigateTo("Account settings")} icon={UserRound}>Account settings</NavButton>
      </div>

      <div className="mt-auto hidden border-t border-slate-100 pt-4 md:block">
        <div className="flex items-center gap-3 px-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-100 text-sm font-bold text-violet-800">{user?.name?.[0]?.toUpperCase() || "A"}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-800">{user?.name || "Administrator"}</p>
            <p className="truncate text-[10px] text-slate-400">{user?.email}</p>
          </div>
          <button className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={signOut} aria-label="Sign out"><LogOut size={16} /></button>
        </div>
      </div>
    </aside>

    <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      {section === "Overview" ? <>
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-violet-600">Admin workspace</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-[30px]">Welcome back, {firstName}</h1>
            <p className="mt-1.5 text-sm text-slate-500">Here’s what’s happening across your team today.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-violet-200 hover:text-violet-700 disabled:opacity-60 sm:text-sm" onClick={exportReport} disabled={exporting}>
              <Download size={16} />{exporting ? "Preparing..." : "Export report"}
            </button>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-700 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-800 sm:text-sm" onClick={() => navigateTo("Approvals")}>
              <ClipboardCheck size={16} />Review approvals
              {dashboardData?.summary.pending > 0 && <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{dashboardData.summary.pending}</span>}
            </button>
            <button className="relative hidden size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-violet-700 sm:grid" onClick={() => navigateTo(pendingTotal ? "Leaves" : "Attendance")} aria-label="View operational alerts">
              <Bell size={17} />
              {pendingTotal > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500" />}
            </button>
            <span className="hidden size-10 place-items-center rounded-full bg-violet-100 text-sm font-bold text-violet-800 sm:grid">{user?.name?.[0]?.toUpperCase() || "A"}</span>
          </div>
        </header>
        {exportError && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{exportError}</p>}
        <AdminOverview onDataLoaded={setDashboardData} onNavigate={navigateTo} />
      </> : <>
        {section === "Employees" && <AdminEmployeesPage key={employeeStatus} initialStatus={employeeStatus} embedded />}
        {section === "Office settings" && <div className="-mx-4 -my-5 sm:-mx-6 sm:-my-7 lg:-mx-8"><Module3SettingsPage embedded /></div>}
        {section === "Calendar" && <div className="-mx-4 -my-5 sm:-mx-6 sm:-my-7 lg:-mx-8"><HolidayCalendarPage adminMode embedded /></div>}
        {section === "Attendance" && <>
          {employeesError && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{employeesError}</p>}
          <AdminAttendanceAutomationPage employees={employees} />
        </>}
        {section === "Leaves" && <AdminLeavesPage />}
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
    className={`flex shrink-0 items-center gap-2.5 rounded-xl border-0 px-3 py-2.5 text-left text-xs transition md:w-full md:px-3 md:py-2.5 md:text-[13px] ${active ? "bg-violet-50 font-semibold text-violet-800" : "bg-transparent font-medium text-slate-500 hover:bg-slate-50 hover:text-violet-800"}`}
  >
    <Icon size={16} className="shrink-0" />
    <span className="whitespace-nowrap md:whitespace-normal">{children}</span>
    {badge > 0 && <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-500"}`}>{badge}</span>}
  </button>;
}
