import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Download,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UserRound,
  Users,
  X,
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
import useToastMessage from "../../hooks/useToastMessage";
import BrandLogo from "../../components/BrandLogo";

const navItems = [
  { section: "Overview", label: "Dashboard", icon: LayoutDashboard },
  { section: "Employees", label: "Employees", icon: Users },
  { section: "Attendance", label: "Attendance", icon: CalendarCheck },
  { section: "Leaves", label: "Leave management", icon: ClipboardCheck },
  { section: "Calendar", label: "Calendar", icon: CalendarDays },
  { section: "Reports", label: "Reports", icon: FileBarChart },
];
const adminSections = new Set([
  "Overview",
  ...navItems.filter((item) => item.section !== "Overview").map((item) => item.section),
  "Office settings",
  "Account settings",
]);

export default function AdminDashboardpage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = searchParams.get("section");
  const section = adminSections.has(requestedSection) ? requestedSection : "Overview";
  const [employeeStatus, setEmployeeStatus] = useState("");
  const [dashboardData, setDashboardData] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useToastMessage(exportError, "error");

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  const signOut = async () => {
    await logout();
    navigate("/login");
  };

  const navigateTo = useCallback((target, nextEmployeeStatus = "") => {
    setMobileMenuOpen(false);
    const nextSection = target === "Approvals" ? "Employees" : target;
    if (target === "Approvals") {
      setEmployeeStatus("pending");
    } else if (target === "Employees") {
      setEmployeeStatus(nextEmployeeStatus);
    }
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      if (nextSection === "Overview") nextParams.delete("section");
      else nextParams.set("section", nextSection);
      return nextParams;
    });
  }, [setSearchParams]);

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
  return <main className="min-h-screen bg-[linear-gradient(160deg,#F3E8FF_0%,#F8FAFC_55%,#EDE9FE_100%)] font-['Inter',sans-serif] text-slate-800 md:flex">
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#E9E5F7] bg-white/95 px-3 backdrop-blur md:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center"><BrandLogo alt="" /></span>
        <span className="truncate font-['Poppins',sans-serif] text-[15px] font-semibold text-slate-900">Crew HRCore</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" className="grid size-10 place-items-center rounded-xl text-slate-600 transition hover:bg-violet-50 hover:text-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation menu" aria-controls="admin-sidebar" aria-expanded={mobileMenuOpen}>
          <Menu size={20} />
        </button>
      </div>
    </header>
    {mobileMenuOpen && <button type="button" className="fixed inset-0 z-30 bg-slate-950/40 md:hidden" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation menu" />}
    <aside id="admin-sidebar" className={`fixed inset-y-0 left-0 z-40 flex h-screen w-[280px] shrink-0 flex-col border-r border-[#E9E5F7] bg-white/95 px-4 py-4 shadow-xl backdrop-blur transition-transform duration-200 md:sticky md:top-0 md:z-20 md:h-screen md:w-[228px] md:border-b-0 md:px-4 md:py-6 md:shadow-none ${mobileMenuOpen ? "visible translate-x-0" : "invisible -translate-x-full"} md:visible md:translate-x-0`}>
      <div className="flex items-center justify-between gap-3 px-1 md:px-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-10 shrink-0 place-items-center"><BrandLogo alt="" /></span>
          <span className="min-w-0">
            <span className="block truncate font-['Poppins',sans-serif] text-[16px] font-semibold leading-5 tracking-[-.3px] text-slate-900">Crew HRCore</span>
            <span className="mt-0.5 block text-xs font-medium text-violet-800">Admin workspace</span>
          </span>
        </div>
        <button type="button" className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-600 transition hover:bg-violet-50 hover:text-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 md:hidden" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation menu">
          <X size={18} />
        </button>
      </div>

      <nav className="mt-4 grid grid-cols-1 gap-1 md:mt-6" aria-label="Admin navigation">
        {navItems.map((item) => <NavButton
          key={item.section}
          active={section === item.section}
          onClick={() => navigateTo(item.section)}
          icon={item.icon}
          badge={item.section === "Employees" ? dashboardData?.summary.pending : item.section === "Leaves" ? dashboardData?.summary.pendingLeaves : undefined}
        >{item.label}</NavButton>)}
      </nav>

      <div className="mt-1 grid grid-cols-1 gap-1 md:mt-3 md:block">
        <p className="mb-2 hidden px-3 text-[13px] font-semibold text-slate-600 md:block">Settings</p>
        <NavButton active={section === "Office settings"} onClick={() => navigateTo("Office settings")} icon={Settings}>Office settings</NavButton>
        <NavButton active={section === "Account settings"} onClick={() => navigateTo("Account settings")} icon={UserRound}>Account settings</NavButton>
      </div>

      <div className="mt-auto hidden rounded-2xl border border-[#E9E5F7] bg-white/90 p-3 md:block">
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-100 font-['Poppins',sans-serif] text-[13px] font-semibold text-violet-800">{initials(user?.name)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-800">{user?.name || "Administrator"}</p>
            <p className="truncate text-xs text-slate-600">Administrator</p>
          </div>
          <button className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600" onClick={signOut} aria-label="Sign out"><LogOut size={16} /></button>
        </div>
      </div>
    </aside>

    <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-6">
      {section === "Overview" ? <>
        <header className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <h1 className="font-['Poppins',sans-serif] text-[30px] font-semibold leading-[1.25] tracking-[-.6px] text-slate-900">Dashboard</h1>
            <p className="mt-1 text-[14px] leading-[1.5] text-slate-600 sm:text-[15px]">{getGreeting()}, {firstName}. Here&apos;s what needs your attention today.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50/60 hover:text-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:opacity-60" onClick={exportReport} disabled={exporting}>
              <Download size={16} className="text-violet-800" />{exporting ? "Preparing..." : "Export report"}
            </button>
          </div>
        </header>
        <AdminOverview onDataLoaded={setDashboardData} onNavigate={navigateTo} />
      </> : <>
        {section === "Employees" && <AdminEmployeesPage key={employeeStatus} initialStatus={employeeStatus} embedded />}
        {section === "Office settings" && <Module3SettingsPage embedded onNavigate={navigateTo} />}
        {section === "Calendar" && <div className="-mx-4 -my-5 sm:-mx-6 sm:-my-7 lg:-mx-7"><AdminCalendarPage /></div>}
        {section === "Attendance" && <AdminAttendanceAutomationPage onNavigate={navigateTo} />}
        {section === "Leaves" && <AdminLeavesPage />}
        {section === "Reports" && <AdminReportsPage />}
        {section === "Account settings" && <AccountSettings user={user} updateUser={updateUser} onSignOut={signOut} />}
      </>}
    </div>

    <div className="border-t border-[#E9E5F7] bg-white/95 px-4 py-3 md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-100 font-['Poppins',sans-serif] text-[13px] font-semibold text-violet-800">{user?.name?.[0]?.toUpperCase() || "A"}</span>
          <span className="truncate text-[13px] font-medium text-slate-700">{user?.name || "Administrator"}</span>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600" onClick={signOut}><LogOut size={16} />Sign out</button>
      </div>
    </div>
  </main>;
}

function NavButton({ active, onClick, icon: Icon, children, badge }) {
  return <button
    type="button"
    onClick={onClick}
    aria-current={active ? "page" : undefined}
    className={`flex min-w-0 items-center gap-2.5 rounded-xl border-0 px-3 py-2.5 text-left text-[13px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 md:w-full md:px-3 md:py-2.5 ${active ? "bg-violet-100 font-semibold text-violet-800" : "bg-transparent font-medium text-slate-600 hover:bg-violet-50 hover:text-violet-800"}`}
  >
    <Icon size={16} className="shrink-0" />
    <span className="whitespace-nowrap md:whitespace-normal">{children}</span>
    {badge > 0 && <span className={`ml-auto rounded-full px-1.5 py-0.5 text-xs font-semibold ${active ? "bg-white text-violet-800" : "bg-violet-100 text-violet-800"}`}>{badge}</span>}
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
