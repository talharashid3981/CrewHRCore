import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck,
  Clock3,
  FileCheck2,
  UserPlus,
  Users,
} from "lucide-react";
import { getAdminDashboard } from "../../api/auth.api";

const numberFormat = new Intl.NumberFormat("en");
const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "Asia/Karachi",
});
const statusItems = [
  { key: "approved", label: "Approved", color: "bg-violet-600", text: "text-violet-700" },
  { key: "pending", label: "Pending", color: "bg-amber-400", text: "text-amber-700" },
  { key: "incomplete", label: "Incomplete", color: "bg-slate-400", text: "text-slate-600" },
  { key: "rejected", label: "Needs changes", color: "bg-rose-400", text: "text-rose-700" },
];

export default function AdminOverview({ onDataLoaded, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminDashboard();
      setData(result);
      onDataLoaded(result);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load the admin dashboard.");
    } finally {
      setLoading(false);
    }
  }, [onDataLoaded]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  if (loading && !data) return <DashboardLoading />;
  if (!data) return <div className="mt-8 rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-700" role="alert">
    <p>{error || "Dashboard data is unavailable."}</p>
    <button className="mt-4 rounded-lg bg-violet-700 px-4 py-2 font-semibold text-white hover:bg-violet-800" onClick={load}>Try again</button>
  </div>;

  const attendance = data.attendance;
  const attendanceRate = attendance.expected
    ? Math.round((attendance.checkedIn / attendance.expected) * 100)
    : 0;
  const metrics = [
    {
      label: "Total employees",
      value: data.summary.total,
      note: `+${numberFormat.format(data.summary.newThisMonth)} this month`,
      icon: Users,
      iconStyle: "bg-violet-50 text-violet-700",
      trend: "up",
      action: "Employees",
    },
    {
      label: "Active employees",
      value: data.summary.active,
      note: "Approved and active",
      icon: BadgeCheck,
      iconStyle: "bg-emerald-50 text-emerald-700",
      action: "Employees",
    },
    {
      label: "Pending review",
      value: data.summary.pending,
      note: "Employee profiles to review",
      icon: FileCheck2,
      iconStyle: "bg-amber-50 text-amber-700",
      action: "Approvals",
    },
    {
      label: "Leave requests",
      value: data.summary.pendingLeaves,
      note: "Awaiting a decision",
      icon: CalendarCheck,
      iconStyle: "bg-sky-50 text-sky-700",
      action: "Leaves",
    },
  ];

  return <section className="mt-8 min-w-0">
    {error && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
      <span>{error} Showing the last successfully loaded data.</span>
      <button className="font-semibold underline underline-offset-2" onClick={load}>Refresh</button>
    </div>}

    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} onClick={() => onNavigate(metric.action)} />)}
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.85fr)]">
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.15em] text-violet-600">Attendance</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Today at a glance</h2>
            <p className="mt-1 text-sm text-slate-500">{formatDashboardDate(data.date)}{data.holiday?.name ? ` · ${data.holiday.name}` : ""}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${data.dayType === "working" ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700"}`}>
            {data.dayType}
          </span>
        </div>

        <div className="mt-6 grid items-center gap-6 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div className="mx-auto">
            <div
              className="grid size-40 place-items-center rounded-full"
              role="img"
              aria-label={attendance.expected ? `${attendanceRate}% checked in` : "No attendance expected today"}
              style={{ background: `conic-gradient(#7c3aed 0 ${attendanceRate}%, #ede9fe ${attendanceRate}% 100%)` }}
            >
              <div className="grid size-[118px] place-items-center rounded-full bg-white text-center">
                <div>
                  <strong className="block text-3xl font-bold tracking-tight text-slate-900">{attendance.expected ? `${attendanceRate}%` : "—"}</strong>
                  <span className="mt-1 block text-xs text-slate-500">checked in</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <AttendanceStat label="Checked in" value={attendance.checkedIn} detail={`of ${attendance.expected} expected`} color="bg-violet-600" />
            <AttendanceStat label="On time" value={attendance.present} detail="employees" color="bg-emerald-500" />
            <AttendanceStat label="Late" value={attendance.late} detail="employees" color="bg-amber-400" />
            <AttendanceStat label="On leave" value={attendance.onLeave} detail="employees" color="bg-sky-500" />
          </div>
        </div>
        {attendance.expected === 0 && <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Attendance is not scheduled for this {data.dayType}.
        </p>}
        <button className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900" onClick={() => onNavigate("Attendance")}>
          View attendance <ArrowRight size={16} />
        </button>
      </section>

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.15em] text-amber-600">Needs attention</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Operational alerts</h2>
          </div>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><AlertTriangle size={19} /></span>
        </div>
        <div className="mt-5 grid gap-3">
          {data.alerts.pendingProfiles > 0 && <AlertRow
            title={`${data.alerts.pendingProfiles} profile${data.alerts.pendingProfiles === 1 ? "" : "s"} awaiting review`}
            detail={data.alerts.oldestPendingProfileDays === null ? "Review employee onboarding" : `Oldest request · ${formatAge(data.alerts.oldestPendingProfileDays)}`}
            onClick={() => onNavigate("Approvals")}
          />}
          {data.alerts.pendingLeaves > 0 && <AlertRow
            title={`${data.alerts.pendingLeaves} leave request${data.alerts.pendingLeaves === 1 ? "" : "s"} to decide`}
            detail={data.alerts.oldestPendingLeaveDays === null ? "Review the leave queue" : `Oldest request · ${formatAge(data.alerts.oldestPendingLeaveDays)}`}
            onClick={() => onNavigate("Leaves")}
          />}
          {data.alerts.missingCheckOuts > 0 && <AlertRow
            title={`${data.alerts.missingCheckOuts} missing checkout${data.alerts.missingCheckOuts === 1 ? "" : "s"}`}
            detail={data.alerts.missingCheckOutList.slice(0, 2).map((item) => `${item.name} · ${item.date}`).join("  /  ") || "From the last 7 days"}
            onClick={() => onNavigate("Attendance")}
          />}
          {data.alerts.pendingProfiles === 0 && data.alerts.pendingLeaves === 0 && data.alerts.missingCheckOuts === 0 && <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-5 text-sm text-emerald-800">
            No outstanding profile, leave or checkout alerts.
          </div>}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2"><span className={`size-2 rounded-full ${data.automation ? "bg-emerald-500" : "bg-slate-300"}`} /> Daily close</span>
          <span className="text-right">{data.automation?.lastRunAt ? `Last processed ${formatDashboardDate(data.automation.lastProcessedDate)}` : "No run recorded"}</span>
        </div>
      </section>
    </div>

    <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(250px,.9fr)_minmax(300px,1.05fr)_minmax(300px,1fr)]">
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.15em] text-violet-600">People</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Onboarding status</h2>
          </div>
          <UserPlus className="mt-1 text-violet-400" size={20} />
        </div>
        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="text-slate-500">Employee profiles</span>
          <strong className="text-slate-900">{numberFormat.format(data.onboarding.total)}</strong>
        </div>
        <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-label="Onboarding progress">
          {statusItems.map((item) => {
            const percent = data.onboarding.total ? (data.onboarding[item.key] / data.onboarding.total) * 100 : 0;
            return <span key={item.key} className={item.color} style={{ width: `${percent}%` }} />;
          })}
        </div>
        <div className="mt-5 grid gap-3">
          {statusItems.map((item) => <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-slate-600"><span className={`size-2 rounded-full ${item.color}`} />{item.label}</span>
            <strong className={`tabular-nums ${item.text}`}>{numberFormat.format(data.onboarding[item.key])}</strong>
          </div>)}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span>Average approval time</span>
          <strong className="text-slate-800">{data.onboarding.averageReviewDays === null ? "Not available" : `${data.onboarding.averageReviewDays} days`}</strong>
        </div>
        <button className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900" onClick={() => onNavigate("Approvals")}>
          Review approvals <ArrowRight size={16} />
        </button>
      </section>

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.15em] text-violet-600">Attendance</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Department overview</h2>
          </div>
          <Users className="mt-1 text-violet-400" size={20} />
        </div>
        {data.departments.length === 0 ? <p className="mt-6 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">No active employee departments to show.</p> : <div className="mt-5 grid gap-4">
          {data.departments.slice(0, 5).map((department) => {
            const rate = department.total ? Math.round((department.checkedIn / department.total) * 100) : 0;
            return <div key={department.name}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-slate-700">{department.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">{data.dayType === "working" ? `${department.checkedIn}/${department.total} · ${rate}%` : `${department.total} employees`}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <span className={`block h-full rounded-full ${data.dayType === "working" ? "bg-violet-500" : "bg-slate-300"}`} style={{ width: `${data.dayType === "working" ? rate : 100}%` }} />
              </div>
            </div>;
          })}
        </div>}
        <button className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900" onClick={() => onNavigate("Employees")}>
          View employees <ArrowRight size={16} />
        </button>
      </section>

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.15em] text-violet-600">Workspace</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Latest activity</h2>
          </div>
          <Activity className="mt-1 text-violet-400" size={20} />
        </div>
        {data.activities.length === 0 ? <p className="mt-6 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">No recent activity in the last 7 days.</p> : <div className="mt-4 divide-y divide-slate-100">
          {data.activities.map((item) => <ActivityItem key={item.id} item={item} />)}
        </div>}
      </section>
    </div>
  </section>;
}

function MetricCard({ metric, onClick }) {
  const Icon = metric.icon;
  return <button className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md sm:p-5" onClick={onClick}>
    <span className={`grid size-10 place-items-center rounded-xl ${metric.iconStyle}`}><Icon size={19} /></span>
    <span className="mt-4 block truncate text-sm font-medium text-slate-500">{metric.label}</span>
    <span className="mt-1 flex items-baseline gap-2">
      <strong className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{numberFormat.format(metric.value)}</strong>
      {metric.trend && <ArrowUpRight size={16} className="text-emerald-600" />}
    </span>
    <span className="mt-2 block truncate text-xs text-slate-500">{metric.note}</span>
  </button>;
}

function AttendanceStat({ label, value, detail, color }) {
  return <div className="min-w-0 rounded-xl bg-slate-50 p-3 sm:p-3.5">
    <span className="flex items-center gap-2 text-xs font-medium text-slate-500"><span className={`size-2 rounded-full ${color}`} />{label}</span>
    <strong className="mt-2 block text-xl font-bold tabular-nums text-slate-900">{numberFormat.format(value)}</strong>
    <span className="mt-0.5 block truncate text-[11px] text-slate-400">{detail}</span>
  </div>;
}

function AlertRow({ title, detail, onClick }) {
  return <button className="group flex min-w-0 items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/70 p-3.5 text-left transition hover:border-amber-200 hover:bg-amber-50" onClick={onClick}>
    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white text-amber-600"><AlertTriangle size={16} /></span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold text-slate-800">{title}</span>
      <span className="mt-1 block break-words text-xs leading-5 text-slate-500">{detail}</span>
    </span>
    <ArrowRight size={16} className="mt-1 shrink-0 text-amber-600 transition group-hover:translate-x-0.5" />
  </button>;
}

function ActivityItem({ item }) {
  const color = item.kind === "approved" || item.kind === "attendance"
    ? "bg-emerald-50 text-emerald-700"
    : item.kind === "rejected" || item.kind === "late"
      ? "bg-amber-50 text-amber-700"
      : "bg-violet-50 text-violet-700";
  return <div className="flex min-w-0 gap-3 py-3 first:pt-1 last:pb-0">
    <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${color}`}>
      {item.kind === "approved" ? <BadgeCheck size={15} /> : item.kind === "attendance" || item.kind === "late" ? <Clock3 size={15} /> : <UserPlus size={15} />}
    </span>
    <div className="min-w-0 flex-1">
      <p className="break-words text-xs font-semibold leading-5 text-slate-800">{item.title}</p>
      <p className="mt-0.5 break-words text-[11px] leading-4 text-slate-500">{item.detail}</p>
    </div>
    <time className="shrink-0 pt-0.5 text-[10px] text-slate-400" dateTime={item.timestamp}>{formatRelativeTime(item.timestamp)}</time>
  </div>;
}

function DashboardLoading() {
  return <section className="mt-8 animate-pulse space-y-5" aria-label="Loading dashboard">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div className="h-36 rounded-2xl border border-slate-200 bg-white" key={item} />)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.55fr_.85fr]"><div className="h-72 rounded-2xl border border-slate-200 bg-white" /><div className="h-72 rounded-2xl border border-slate-200 bg-white" /></div>
    <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div className="h-80 rounded-2xl border border-slate-200 bg-white" key={item} />)}</div>
  </section>;
}

function formatDashboardDate(value) {
  if (!value) return "Date unavailable";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+05:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : dateFormat.format(date);
}

function formatRelativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (elapsedMinutes < 1) return "Now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays < 7 ? `${elapsedDays}d` : dateFormat.format(date);
}

function formatAge(days) {
  return days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`;
}
