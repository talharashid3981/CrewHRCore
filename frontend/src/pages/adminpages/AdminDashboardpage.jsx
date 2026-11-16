import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, CalendarDays, ClipboardCheck, LayoutDashboard, LogOut, Settings, Users } from "lucide-react";
import { getEmployeeSummary, listEmployees } from "../../api/auth.api";
import { useAuth } from "../../context/AuthContext";
import AdminEmployeesPage from "./AdminEmployeesPage";

const emptySummary = { total: 0, incomplete: 0, pending: 0, approved: 0, rejected: 0, active: 0, inactive: 0 };

export default function AdminDashboardpage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState("Overview");
  const [summary, setSummary] = useState(emptySummary);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getEmployeeSummary(), listEmployees({ limit: 100 })])
      .then(([summaryData, employeeData]) => {
        if (!active) return;
        setSummary({ ...emptySummary, ...(summaryData.summary || {}) });
        setEmployees(employeeData.users || []);
      })
      .catch((requestError) => active && setError(requestError.response?.data?.message || "Unable to load admin dashboard."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const departments = useMemo(() => Object.values(employees.reduce((result, employee) => {
    const department = employee.department || "General";
    if (!result[department]) result[department] = { name: department, total: 0, approved: 0, pending: 0, rejected: 0 };
    result[department].total += 1;
    if (employee.onboardingStatus === "approved") result[department].approved += 1;
    if (employee.onboardingStatus === "pending") result[department].pending += 1;
    if (employee.onboardingStatus === "rejected") result[department].rejected += 1;
    return result;
  }, {})).slice(0, 6), [employees]);

  const signOut = async () => { await logout(); navigate("/login"); };
  const firstName = user?.name?.split(" ")[0] || "Admin";

  return <main className="flex min-h-screen flex-col bg-slate-50 text-slate-800 md:flex-row">
    <aside className="flex w-full flex-col border-b border-slate-200 bg-white p-4 md:w-60 md:border-b-0 md:border-r md:p-6">
      <div className="flex items-center gap-2 px-2 text-sm font-bold text-slate-900"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-800 to-violet-400 text-lg text-white">✓</span>Crew HRCore</div>
      <nav className="mt-8 grid gap-1">
        <NavButton active={section === "Overview"} onClick={() => setSection("Overview")} icon={LayoutDashboard}>Overview</NavButton>
        <NavButton active={section === "Employees"} onClick={() => setSection("Employees")} icon={Users}>Employees</NavButton>
        <NavButton active={section === "Attendance"} onClick={() => setSection("Attendance")} icon={CalendarCheck}>Attendance</NavButton>
        <NavButton active={section === "Schedule"} onClick={() => navigate("/admin/settings")} icon={CalendarDays}>Schedule</NavButton>
      </nav>
      <p className="mb-2 mt-8 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Settings</p>
      <NavButton active={section === "Settings"} onClick={() => navigate("/admin/settings")} icon={Settings}>Settings</NavButton>
      <button className="mt-4 flex items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-3 text-left text-sm text-slate-500 hover:bg-violet-50 hover:text-violet-800 md:mt-auto" onClick={signOut}><LogOut size={17} /> Sign out</button>
    </aside>

    <section className="w-full min-w-0 p-6 sm:p-10">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-violet-600">Admin workspace</p><h1 className="text-3xl font-bold tracking-tight text-slate-950">Welcome, {firstName}.</h1><p className="mt-2 text-sm text-slate-500">Manage your people and attendance workspace from one place.</p></div><div className="flex items-center gap-2 text-xs font-bold text-slate-700"><span className="grid h-9 w-9 place-items-center rounded-full bg-violet-600 text-white">{user?.name?.[0]?.toUpperCase() || "A"}</span><span className="hidden sm:inline">{user?.email}</span></div></header>
      {error && <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      {section === "Overview" && <Overview summary={summary} employees={employees} departments={departments} loading={loading} />}
      {section === "Employees" && <AdminEmployeesPage embedded />}
      {section !== "Overview" && section !== "Employees" && <Placeholder section={section} />}
    </section>
  </main>;
}

function NavButton({ active, onClick, icon: Icon, children }) { return <button onClick={onClick} className={`flex items-center gap-2 rounded-lg border-0 px-3 py-3 text-left text-sm transition ${active ? "bg-violet-50 font-bold text-violet-800" : "bg-transparent text-slate-500 hover:bg-violet-50 hover:text-violet-800"}`}><Icon size={17} />{children}</button>; }

function Overview({ summary, employees, departments, loading }) {
  const cards = [["Total employees", summary.total, "All registered employees"], ["Pending review", summary.pending, "Waiting for approval"], ["Approved", summary.approved, "Ready for attendance"], ["Needs attention", summary.incomplete + summary.rejected, "Incomplete or rejected"]];
  return <section className="mt-8 max-w-6xl"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, hint]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><span className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-violet-100 text-violet-700"><Users size={20} /></span><p className="text-sm text-slate-500">{label}</p><strong className="mt-1 block text-3xl font-bold text-slate-950">{loading ? "—" : value}</strong><small className="mt-2 block text-xs text-slate-400">{hint}</small></article>)}</div><div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Employee onboarding</h2><p className="mt-2 text-sm text-slate-500">Review the current state of your employee records.</p></div><ClipboardCheck className="text-violet-300" size={28} /></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Progress label="Approved" value={summary.approved} total={summary.total} color="bg-emerald-500" /><Progress label="Pending" value={summary.pending} total={summary.total} color="bg-amber-400" /><Progress label="Rejected" value={summary.rejected} total={summary.total} color="bg-red-400" /></div></section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Latest employees</h2><div className="mt-4 grid gap-3">{loading ? <p className="text-sm text-slate-400">Loading employees...</p> : employees.length === 0 ? <p className="text-sm text-slate-400">No employees found.</p> : employees.slice(0, 4).map((employee) => <div className="flex items-center gap-3" key={employee.id}><span className="grid h-9 w-9 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{employee.name?.[0]?.toUpperCase()}</span><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-800">{employee.name}</strong><span className="block truncate text-xs text-slate-400">{employee.department || "General"}</span></div><span className="text-[11px] font-semibold capitalize text-violet-700">{employee.onboardingStatus}</span></div>)}</div></section></div><section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Departments</h2><p className="mt-2 text-sm text-slate-500">Department totals calculated from employee records.</p></div><Users className="text-violet-300" size={27} /></div>{departments.length === 0 ? <p className="mt-6 text-sm text-slate-400">No department data available.</p> : <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{departments.map((department) => <div className="rounded-xl bg-slate-50 p-4" key={department.name}><div className="flex items-center justify-between"><strong className="text-sm text-violet-700">{department.name}</strong><span className="text-2xl font-bold text-slate-900">{department.total}</span></div><p className="mt-2 text-xs text-slate-500">{department.approved} approved · {department.pending} pending · {department.rejected} rejected</p></div>)}</div>}</section></section>;
}

function Progress({ label, value, total, color }) { const percent = total ? Math.round((value / total) * 100) : 0; return <div><div className="flex justify-between text-xs text-slate-500"><span>{label}</span><strong className="text-slate-800">{value}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></div></div>; }

function Placeholder({ section }) { return <section className="mt-8 grid min-h-80 place-items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-violet-700"><CalendarDays size={27} /></span><h2 className="mt-5 text-xl font-bold text-slate-900">{section}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">This workspace is ready. Its backend functionality will be connected when the module API is implemented.</p></div></section>; }
