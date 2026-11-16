import { useState } from "react";
import { CalendarCheck, CalendarDays, ClipboardCheck, LogOut, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AttendancePage from "./AttendancePage";
import HolidayCalendarPage from "./HolidayCalendarPage";
import LeavePage from "./LeavePage";
import EmployeeOverview from "./EmployeeOverview";
import { useAuth } from "../context/AuthContext";

const tabs = [
  { label: "Overview", icon: ClipboardCheck },
  { label: "Attendance", icon: CalendarCheck },
  { label: "Calendar", icon: CalendarDays },
  { label: "Leaves", icon: ClipboardCheck },
];

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Overview");
  const signOut = async () => { await logout(); navigate("/login"); };

  return <main className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-800 md:flex-row">
    <aside className="flex w-full flex-col border-b border-slate-200 bg-white p-4 md:w-60 md:border-b-0 md:border-r md:p-6">
      <div className="flex items-center gap-2 px-2 text-sm font-bold text-slate-900"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-800 to-violet-400 text-lg text-white">✓</span>Crew HRCore</div>
      <nav className="mt-6 flex gap-1 overflow-x-auto md:mt-10 md:grid">{tabs.map(({ label, icon: Icon }) => <button key={label} onClick={() => setActiveTab(label)} className={`flex shrink-0 items-center gap-2 rounded-lg border-0 px-3 py-3 text-left text-sm font-medium transition ${activeTab === label ? "bg-violet-50 font-semibold text-violet-800" : "bg-transparent text-slate-500 hover:bg-violet-50 hover:text-violet-800"}`}><Icon size={17} />{label}</button>)}{user?.role === "admin" && <button onClick={() => navigate("/admin/dashboard")} className="flex shrink-0 items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-3 text-left text-sm font-medium text-slate-500 hover:bg-violet-50 hover:text-violet-800"><Users size={17} />Admin workspace</button>}</nav>
      <button className="mt-4 flex items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-3 text-left text-sm font-medium text-slate-500 hover:bg-violet-50 hover:text-violet-800 md:mt-auto" onClick={signOut}><LogOut size={17} />Sign out</button>
    </aside>
    <section className="w-full min-w-0 p-6 sm:p-10">
      {activeTab === "Overview" && <OverviewHeader user={user} />}
      {activeTab === "Overview" && <EmployeeOverview />}
      {activeTab === "Attendance" && <div className="-m-6 sm:-m-10"><AttendancePage embedded /></div>}
      {activeTab === "Calendar" && <div className="-m-6 sm:-m-10"><HolidayCalendarPage embedded /></div>}
      {activeTab === "Leaves" && <LeavePage />}
    </section>
  </main>;
}

function OverviewHeader({ user }) { return <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="mb-2 text-xs font-medium uppercase tracking-wider text-violet-600">Employee workspace</p><h1 className="text-[32px] font-bold leading-tight tracking-tight text-slate-950">Welcome, {user?.name?.split(" ")[0]}.</h1><p className="mt-2 text-[14px] font-normal text-slate-500">Manage your attendance workspace from one place.</p></div><div className="flex items-center gap-2 text-[12px] font-medium text-slate-700"><span className="grid h-9 w-9 place-items-center rounded-full bg-violet-600 font-semibold text-white">{user?.name?.[0]?.toUpperCase()}</span><span className="hidden sm:inline">{user?.email}</span></div></header>; }
