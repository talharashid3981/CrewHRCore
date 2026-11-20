import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock3,
  FileCheck2,
  Users,
  UserRoundCheck,
} from "lucide-react";
import { getAdminDashboard } from "../../api/auth.api";

const numberFormat = new Intl.NumberFormat("en");
const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "Asia/Karachi",
});
const statusItems = [
  { key: "approved", label: "Approved", color: "bg-emerald-500", text: "text-slate-700" },
  { key: "pending", label: "Pending review", color: "bg-violet-500", text: "text-slate-700" },
  { key: "incomplete", label: "Incomplete", color: "bg-amber-400", text: "text-slate-700" },
  { key: "rejected", label: "Rejected", color: "bg-rose-500", text: "text-slate-700" },
];
const activityColors = [
  "bg-violet-600",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-emerald-600",
  "bg-sky-600",
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
  if (!data) return <div className="mt-5 rounded-2xl border border-rose-200 bg-white p-5 text-sm text-rose-700" role="alert">
    <p>{error || "Dashboard data is unavailable."}</p>
    <button className="mt-3 rounded-lg bg-violet-700 px-4 py-2 font-semibold text-white hover:bg-violet-800" onClick={load}>Try again</button>
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
      color: "bg-violet-100 text-violet-700",
      noteColor: "text-emerald-700 bg-emerald-50",
      action: "Employees",
    },
    {
      label: "Active employees",
      value: data.summary.active,
      note: `of ${numberFormat.format(data.summary.approved)} approved`,
      icon: UserRoundCheck,
      color: "bg-emerald-50 text-emerald-700",
      noteColor: "text-violet-700 bg-violet-50",
      action: "Employees",
    },
    {
      label: "Pending review",
      value: data.summary.pending,
      note: data.alerts.oldestPendingProfileDays === null
        ? "No profiles waiting"
        : `Oldest ${formatAge(data.alerts.oldestPendingProfileDays)}`,
      icon: Clock3,
      color: "bg-amber-50 text-amber-700",
      noteColor: "text-amber-700 bg-amber-50",
      action: "Approvals",
    },
    {
      label: "Leave requests",
      value: data.summary.pendingLeaves,
      note: data.alerts.oldestPendingLeaveDays === null
        ? "No requests waiting"
        : `Oldest ${formatAge(data.alerts.oldestPendingLeaveDays)}`,
      icon: FileCheck2,
      color: "bg-violet-100 text-violet-700",
      noteColor: "text-violet-700 bg-violet-50",
      action: "Leaves",
    },
  ];

  return <section className="mt-4 min-w-0">
    {error && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700" role="alert">
      <span>{error} Showing the last successfully loaded data.</span>
      <button className="font-semibold underline underline-offset-2" onClick={load}>Refresh</button>
    </div>}

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} onClick={() => onNavigate(metric.action)} />)}
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.42fr)_minmax(300px,1fr)]">
      <AttendancePanel
        attendance={attendance}
        dayType={data.dayType}
        date={data.date}
        attendanceRate={attendanceRate}
        onClick={() => onNavigate("Attendance")}
      />
      <AlertsPanel alerts={data.alerts} automation={data.automation} onNavigate={onNavigate} />
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-2 min-[1200px]:grid-cols-[minmax(255px,.92fr)_minmax(340px,1.18fr)_minmax(290px,1fr)]">
      <OnboardingPanel onboarding={data.onboarding} onNavigate={onNavigate} />
      <DepartmentPanel departments={data.departments} dayType={data.dayType} onNavigate={onNavigate} />
      <ActivityPanel activities={data.activities} />
    </div>
  </section>;
}

function MetricCard({ metric, onClick }) {
  const Icon = metric.icon;
  return <button
    className="flex min-h-[82px] min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3.5 py-3 text-left shadow-[0_5px_18px_rgba(15,23,42,.045)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md sm:px-4"
    onClick={onClick}
  >
    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${metric.color}`}><Icon size={19} /></span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-xs font-medium text-slate-500">{metric.label}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <strong className="font-['Poppins',sans-serif] text-[23px] leading-7 font-semibold tracking-tight text-slate-900">{numberFormat.format(metric.value)}</strong>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold leading-4 ${metric.noteColor}`}>{metric.note}</span>
      </span>
    </span>
  </button>;
}

function AttendancePanel({ attendance, dayType, date, attendanceRate, onClick }) {
  const segments = [
    { label: "Present", value: attendance.present, color: "#31d39a" },
    { label: "Late", value: attendance.late, color: "#ffb800" },
    { label: "Not checked in", value: attendance.notCheckedIn, color: "#ff8fc9" },
    { label: "On leave", value: attendance.onLeave, color: "#b79aff" },
  ];
  const segmentTotal = segments.reduce((sum, segment) => sum + segment.value, 0);
  let runningPercent = 0;
  const ring = segmentTotal
    ? segments.map((segment) => {
      const start = runningPercent;
      runningPercent += (segment.value / segmentTotal) * 100;
      return `${segment.color} ${start}% ${runningPercent}%`;
    }).join(", ")
    : "#7324d6 0% 100%";
  const labels = segments;
  const checkedIn = attendance.checkedIn;

  return <section className="relative min-w-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#5b16a4] via-[#7315c1] to-[#8439ec] px-5 py-4 text-white shadow-[0_14px_28px_rgba(91,22,164,.22)] sm:px-5 sm:py-4.5">
    <div className="pointer-events-none absolute -right-14 -top-20 size-60 rounded-full border border-white/10" />
    <div className="pointer-events-none absolute -right-7 -top-14 size-44 rounded-full border border-white/10" />
    <div className="relative flex min-h-[188px] flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-['Poppins',sans-serif] text-[15px] font-semibold tracking-tight">Today at a glance</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white/95">
          <span className="size-1.5 rounded-full bg-emerald-400" />{dayType === "working" ? "Working day" : titleCase(dayType)}
        </span>
        {date && <span className="text-[10px] text-violet-100">{formatDate(date)}</span>}
      </div>

      <div className="mt-1 flex min-w-0 items-center gap-2 pr-28 sm:pr-0">
        <strong className="font-['Poppins',sans-serif] text-[38px] leading-[1.05] font-semibold tracking-tight">{numberFormat.format(checkedIn)}</strong>
        <p className="pt-1 text-xs text-violet-100 sm:text-[13px]">
          of {numberFormat.format(attendance.expected)} active employees checked in
        </p>
      </div>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-3">
        <div className="flex min-w-0 flex-wrap gap-2">
          {labels.map((segment) => <div key={segment.label} className="min-w-[67px] rounded-xl border border-white/15 bg-white/10 px-2.5 py-2">
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[10px] text-violet-100">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: segment.color }} />{segment.label}
            </span>
            <strong className="mt-1 block text-[18px] leading-5 font-bold">{numberFormat.format(segment.value)}</strong>
          </div>)}
        </div>

        <div
          className="absolute right-0 top-1 grid size-[114px] shrink-0 place-items-center rounded-full p-[9px] sm:static sm:size-[124px]"
          role="img"
          aria-label={attendance.expected ? `${attendanceRate}% checked in` : "No attendance expected today"}
          style={{ background: `conic-gradient(${ring})` }}
        >
          <div className="grid size-full place-items-center rounded-full bg-[#7120c7] text-center">
            <div>
              <strong className="block font-['Poppins',sans-serif] text-[24px] leading-7 font-semibold">{attendance.expected ? `${attendanceRate}%` : "—"}</strong>
              <span className="text-[10px] text-violet-100">checked in</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <button type="button" onClick={onClick} className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500" aria-label="View attendance" />
  </section>;
}

function AlertsPanel({ alerts, automation, onNavigate }) {
  const rows = [
    {
      count: alerts.missingCheckOuts,
      label: `missing check-out${alerts.missingCheckOuts === 1 ? "" : "s"}`,
      detail: alerts.missingCheckOutList[0]
        ? `Oldest · ${alerts.missingCheckOutList[0].name} · ${formatDate(alerts.missingCheckOutList[0].date)}`
        : "From the last 7 days",
      icon: AlertTriangle,
      iconStyle: "bg-rose-50 text-rose-600",
      action: "Attendance",
      actionLabel: "Review",
    },
    {
      count: alerts.pendingProfiles,
      label: `profile${alerts.pendingProfiles === 1 ? "" : "s"} awaiting approval`,
      detail: alerts.oldestPendingProfileDays === null
        ? "No profiles waiting for review"
        : `Oldest submitted ${formatAge(alerts.oldestPendingProfileDays)}`,
      icon: UserRoundCheck,
      iconStyle: "bg-violet-50 text-violet-600",
      action: "Approvals",
      actionLabel: "Review",
    },
    {
      count: alerts.pendingLeaves,
      label: `leave request${alerts.pendingLeaves === 1 ? "" : "s"} to decide`,
      detail: alerts.oldestPendingLeaveDays === null
        ? "No leave requests waiting"
        : `Oldest request ${formatAge(alerts.oldestPendingLeaveDays)}`,
      icon: FileCheck2,
      iconStyle: "bg-violet-50 text-violet-600",
      action: "Leaves",
      actionLabel: "Review",
    },
  ];
  const lastProcessed = automation?.lastProcessedDate;

  return <section className="min-w-0 rounded-2xl border border-slate-100 bg-white px-4 py-3.5 shadow-[0_5px_18px_rgba(15,23,42,.045)] sm:px-5">
    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-['Poppins',sans-serif] text-[15px] font-semibold tracking-tight text-slate-900">Operational alerts</h2>
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold ${lastProcessed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
        <Check size={11} />{lastProcessed ? `Automation processed ${formatDate(lastProcessed)}` : "Automation not yet run"}
      </span>
    </div>
    <div className="divide-y divide-slate-100">
      {rows.map((row) => {
        const Icon = row.icon;
        return <button key={row.action} onClick={() => onNavigate(row.action)} className="group flex w-full min-w-0 items-center gap-2.5 py-2 text-left">
          <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${row.iconStyle}`}><Icon size={16} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-slate-800">{numberFormat.format(row.count)} {row.label}</span>
            <span className="mt-0.5 block truncate text-[10px] text-slate-500">{row.detail}</span>
          </span>
          <span className="shrink-0 text-[10px] font-bold text-violet-700">{row.actionLabel} ›</span>
        </button>;
      })}
      {rows.every((row) => row.count === 0) && <p className="py-5 text-center text-xs text-slate-500">No outstanding alerts.</p>}
    </div>
  </section>;
}

function OnboardingPanel({ onboarding, onNavigate }) {
  return <section className="min-h-[324px] min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_5px_18px_rgba(15,23,42,.045)] sm:p-[18px]">
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold tracking-tight text-slate-900">Onboarding status</h2>
      <button onClick={() => onNavigate("Approvals")} className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-700 hover:bg-amber-100">
        {numberFormat.format(onboarding.pending)} need review
      </button>
    </div>
    <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
      {statusItems.map((item) => {
        const percent = onboarding.total ? (onboarding[item.key] / onboarding.total) * 100 : 0;
        return <span key={item.key} className={`${item.color} border-r border-white`} style={{ width: `${percent}%` }} />;
      })}
    </div>
    <div className="mt-3">
      {statusItems.map((item) => {
        const count = onboarding[item.key];
        const percent = onboarding.total ? ((count / onboarding.total) * 100).toFixed(1) : "0.0";
        return <div key={item.key} className="flex items-center gap-2 border-b border-slate-100 py-[7px] text-[11px] last:border-0">
          <span className={`size-2 shrink-0 rounded-full ${item.color}`} />
          <span className="min-w-0 flex-1 truncate text-slate-700">{item.label}</span>
          <strong className="w-7 text-right font-semibold tabular-nums text-slate-700">{numberFormat.format(count)}</strong>
          <span className="w-10 text-right text-[10px] tabular-nums text-slate-500">{percent}%</span>
        </div>;
      })}
    </div>
    <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#F3E8FF] px-3 py-2 text-[10px] font-medium text-violet-800">
      <Clock3 size={13} className="shrink-0" />
      <span>Average review time is {onboarding.averageReviewDays === null ? "not available" : `${onboarding.averageReviewDays} days`}</span>
    </div>
  </section>;
}

function DepartmentPanel({ departments, dayType, onNavigate }) {
  return <section className="min-h-[324px] min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_5px_18px_rgba(15,23,42,.045)] sm:p-[18px]">
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold tracking-tight text-slate-900">Department summary</h2>
      <button onClick={() => onNavigate("Reports")} className="shrink-0 text-[10px] font-bold text-violet-700 hover:text-violet-900">Full report</button>
    </div>
    {departments.length ? <div className="mt-3">
      {departments.slice(0, 6).map((department) => {
        const rate = department.total ? Math.round((department.checkedIn / department.total) * 100) : 0;
        return <div key={department.name} className="grid grid-cols-[minmax(70px,.85fr)_minmax(54px,1fr)_auto] items-center gap-2 border-b border-slate-100 py-[9px] last:border-0 sm:grid-cols-[minmax(85px,.85fr)_minmax(70px,1fr)_auto]">
          <span className="truncate text-[11px] font-semibold text-slate-700">{department.name}</span>
          <span className="h-[7px] overflow-hidden rounded-full bg-violet-100">
            <span className="block h-full rounded-full bg-gradient-to-r from-[#7315b9] to-[#8d4cf5]" style={{ width: `${dayType === "working" ? rate : 100}%` }} />
          </span>
          <span className="w-[84px] text-right text-[10px] tabular-nums text-slate-500">
            {dayType === "working" ? `${department.checkedIn}/${department.total} · ${rate}%` : `${department.total} employees`}
          </span>
        </div>;
      })}
    </div> : <p className="py-8 text-center text-xs text-slate-500">No active departments to show.</p>}
  </section>;
}

function ActivityPanel({ activities }) {
  const [expanded, setExpanded] = useState(false);
  const visibleActivities = expanded ? activities : activities.slice(0, 5);

  return <section className="min-h-[324px] min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_5px_18px_rgba(15,23,42,.045)] sm:p-[18px]">
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold tracking-tight text-slate-900">Latest activity</h2>
      {activities.length > 5
        ? <button onClick={() => setExpanded(!expanded)} className="shrink-0 text-[10px] font-semibold text-violet-700 hover:text-violet-900">{expanded ? "Show less" : "View all"}</button>
        : <span className="text-[10px] font-semibold text-violet-700">Last 7 days</span>}
    </div>
    {visibleActivities.length ? <div className="mt-2">
      {visibleActivities.map((item, index) => <ActivityItem key={item.id} item={item} index={index} />)}
    </div> : <p className="py-8 text-center text-xs text-slate-500">No recent activity in the last 7 days.</p>}
  </section>;
}

function ActivityItem({ item, index }) {
  const name = item.title.split(/ submitted onboarding| profile approved| profile needs changes| requested | checked in| checked out/i)[0];
  return <div className="flex min-w-0 items-center gap-2.5 border-b border-slate-100 py-[7px] last:border-0">
    <span className={`grid size-[30px] shrink-0 place-items-center rounded-full text-[9px] font-bold text-white ${activityColors[index % activityColors.length]}`}>
      {initials(name)}
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[10px] font-semibold text-slate-800">{item.title}</p>
      <p className="mt-0.5 truncate text-[9px] text-slate-500">{formatTime(item.timestamp)} · {item.detail}</p>
    </div>
  </div>;
}

function DashboardLoading() {
  return <section className="mt-4 animate-pulse space-y-4" aria-label="Loading dashboard">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((item) => <div className="h-[82px] rounded-2xl border border-slate-100 bg-white" key={item} />)}</div>
    <div className="grid gap-4 lg:grid-cols-[1.42fr_1fr]"><div className="h-[230px] rounded-2xl bg-violet-700" /><div className="h-[230px] rounded-2xl border border-slate-100 bg-white" /></div>
    <div className="grid gap-4 lg:grid-cols-2 min-[1200px]:grid-cols-3">{[0, 1, 2].map((item) => <div className="h-[320px] rounded-2xl border border-slate-100 bg-white" key={item} />)}</div>
  </section>;
}

function initials(value = "") {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "HR";
}

function formatDate(value) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+05:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Karachi",
  }).format(date);
}

function formatAge(days) {
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function titleCase(value = "") {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
