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
import useToastMessage from "../../hooks/useToastMessage";
import ProfileAvatar from "../../components/ProfileAvatar";

const numberFormat = new Intl.NumberFormat("en");
const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "Asia/Karachi",
});
const statusItems = [
  { key: "approved", label: "Approved", color: "bg-green-700" },
  { key: "pending", label: "Pending review", color: "bg-amber-700" },
  { key: "incomplete", label: "Incomplete", color: "bg-slate-400" },
  { key: "rejected", label: "Rejected", color: "bg-red-700" },
];
export default function AdminOverview({ onDataLoaded, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useToastMessage(error, "error");

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
  if (!data) return <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,.045)]">
    <button className="rounded-xl bg-[linear-gradient(90deg,#6A0DAD_0%,#7C3AED_100%)] px-4 py-2.5 font-['Poppins',sans-serif] text-[15px] font-semibold text-white shadow-[0_6px_16px_rgba(106,13,173,.2)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600" onClick={load}>Try again</button>
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
      noteColor: "text-green-700 bg-green-50",
      action: "Employees",
    },
    {
      label: "Active employees",
      value: data.summary.active,
      note: `of ${numberFormat.format(data.summary.approved)} approved`,
      icon: UserRoundCheck,
      color: "bg-green-50 text-green-700",
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
    {error && <div className="mb-3 flex justify-end">
      <button className="rounded-lg px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600" onClick={load}>Refresh data</button>
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

    <div className="mt-4 grid gap-4 lg:grid-cols-2 min-[1200px]:!grid-cols-[minmax(255px,.92fr)_minmax(340px,1.18fr)_minmax(290px,1fr)]">
      <OnboardingPanel onboarding={data.onboarding} onNavigate={onNavigate} />
      <DepartmentPanel departments={data.departments} dayType={data.dayType} onNavigate={onNavigate} />
      <ActivityPanel activities={data.activities} className="lg:col-span-2 min-[1200px]:!col-span-1" />
    </div>
  </section>;
}

function MetricCard({ metric, onClick }) {
  const Icon = metric.icon;
  return <button
    className="flex min-h-[96px] min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-[0_8px_24px_rgba(15,23,42,.045)] transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
    onClick={onClick}
  >
    <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${metric.color}`}><Icon size={20} /></span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[14px] font-medium text-slate-600">{metric.label}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <strong className="font-['Poppins',sans-serif] text-2xl leading-7 font-semibold tracking-[-.4px] text-slate-900">{numberFormat.format(metric.value)}</strong>
        <span className={`rounded-full px-2 py-1 text-[12px] font-medium leading-4 ${metric.noteColor}`}>{metric.note}</span>
      </span>
    </span>
  </button>;
}

function AttendancePanel({ attendance, dayType, date, attendanceRate, onClick }) {
  const segments = [
    { label: "Present", value: attendance.present, color: "#15803D" },
    { label: "Late", value: attendance.late, color: "#B45309" },
    { label: "Absent", value: attendance.absent, color: "#B91C1C" },
    { label: "Not checked in", value: attendance.notCheckedIn, color: "#64748B" },
    { label: "On leave", value: attendance.onLeave, color: "#7C3AED" },
  ];
  const segmentTotal = segments.reduce((sum, segment) => sum + segment.value, 0);
  let runningPercent = 0;
  const ring = segmentTotal
    ? segments.map((segment) => {
      const start = runningPercent;
      runningPercent += (segment.value / segmentTotal) * 100;
      return `${segment.color} ${start}% ${runningPercent}%`;
    }).join(", ")
    : "#7C3AED 0% 100%";
  const labels = segments;
  const checkedIn = attendance.checkedIn;

  return <section className="relative min-w-0 overflow-hidden rounded-2xl bg-[linear-gradient(155deg,#4C1D95_0%,#6A0DAD_55%,#7C3AED_100%)] px-5 py-5 text-white shadow-[0_14px_28px_rgba(76,29,149,.2)] sm:px-6 sm:py-5">
    <div className="pointer-events-none absolute -right-14 -top-20 size-60 rounded-full border border-white/10" />
    <div className="pointer-events-none absolute -right-7 -top-14 size-44 rounded-full border border-white/10" />
    <div className="relative flex min-h-[188px] flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-['Poppins',sans-serif] text-[18px] font-semibold tracking-[-.2px]">Today at a glance</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-xs font-medium text-white">
          <span className="size-1.5 rounded-full bg-green-400" />{dayType === "working" ? "Working day" : titleCase(dayType)}
        </span>
        {date && <span className="text-xs text-violet-100">{formatDate(date)}</span>}
      </div>

      <div className="mt-2 flex min-w-0 items-center gap-3">
        <strong className="shrink-0 font-['Poppins',sans-serif] text-[40px] leading-[1.05] font-semibold tracking-[-.6px]">{numberFormat.format(checkedIn)}</strong>
        <p className="min-w-0 flex-1 pt-1 text-[13px] leading-[1.5] text-violet-100 sm:text-[14px]">
          of {numberFormat.format(attendance.expected)} active employees checked in
        </p>
        <div
          className="grid size-[84px] shrink-0 place-items-center rounded-full p-[7px] sm:size-[124px] sm:p-[9px]"
          role="img"
          aria-label={attendance.expected ? `${attendanceRate}% checked in` : "No attendance expected today"}
          style={{ background: `conic-gradient(${ring})` }}
        >
          <div className="grid size-full place-items-center rounded-full bg-[#4C1D95] text-center">
            <div>
              <strong className="block font-['Poppins',sans-serif] text-[22px] leading-6 font-semibold sm:text-[24px] sm:leading-7">{attendance.expected ? `${attendanceRate}%` : "—"}</strong>
              <span className="text-[11px] text-violet-100 sm:text-xs">checked in</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex min-w-0 flex-wrap gap-2 pt-3">
        {labels.map((segment) => <div key={segment.label} className="min-w-[67px] rounded-xl border border-white/15 bg-white/10 px-2.5 py-2">
          <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-violet-100">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: segment.color }} />{segment.label}
          </span>
          <strong className="mt-1 block font-['Poppins',sans-serif] text-[18px] leading-5 font-semibold">{numberFormat.format(segment.value)}</strong>
        </div>)}
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
      iconStyle: "bg-amber-50 text-amber-700",
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

  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,.045)] sm:px-5">
    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-['Poppins',sans-serif] text-[18px] font-semibold tracking-[-.2px] text-slate-900">Operational alerts</h2>
      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${lastProcessed ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
        <Check size={13} />{lastProcessed ? `Automation processed ${formatDate(lastProcessed)}` : "Automation not yet run"}
      </span>
    </div>
    <div className="divide-y divide-slate-100">
      {rows.map((row) => {
        const Icon = row.icon;
        return <button key={row.action} onClick={() => onNavigate(row.action)} className="group flex w-full min-w-0 items-center gap-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600">
          <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${row.iconStyle}`}><Icon size={17} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-slate-800">{numberFormat.format(row.count)} {row.label}</span>
            <span className="mt-0.5 block truncate text-xs text-slate-600">{row.detail}</span>
          </span>
          <span className="shrink-0 text-xs font-semibold text-violet-800 group-hover:text-violet-950">{row.actionLabel} ›</span>
        </button>;
      })}
      {rows.every((row) => row.count === 0) && <p className="py-5 text-center text-[13px] text-slate-600">No outstanding alerts.</p>}
    </div>
  </section>;
}

function OnboardingPanel({ onboarding, onNavigate }) {
  const classifiedTotal = statusItems.reduce(
    (total, item) => total + (onboarding[item.key] || 0),
    0,
  );
  const unclassified = Math.max(0, onboarding.total - classifiedTotal);
  const items = unclassified
    ? [...statusItems, { key: "unclassified", label: "Unclassified", color: "bg-rose-700" }]
    : statusItems;
  const countFor = (item) => item.key === "unclassified"
    ? unclassified
    : onboarding[item.key] || 0;

  return <section className="min-h-[324px] min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,.045)]">
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-['Poppins',sans-serif] text-[18px] font-semibold tracking-[-.2px] text-slate-900">Onboarding status</h2>
      <button onClick={() => onNavigate("Approvals")} className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${onboarding.pending > 0 ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"}`}>
        {numberFormat.format(onboarding.pending)} need review
      </button>
    </div>
    <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
      {items.map((item) => {
        const percent = onboarding.total ? (countFor(item) / onboarding.total) * 100 : 0;
        return <span key={item.key} className={`${item.color} border-r border-white`} style={{ width: `${percent}%` }} />;
      })}
    </div>
    <div className="mt-3">
      {items.map((item) => {
        const count = countFor(item);
        const percent = onboarding.total ? ((count / onboarding.total) * 100).toFixed(1) : "0.0";
        return <div key={item.key} className="flex items-center gap-2 border-b border-slate-100 py-2 text-[13px] last:border-0">
          <span className={`size-2 shrink-0 rounded-full ${item.color}`} />
          <span className="min-w-0 flex-1 truncate text-slate-700">{item.label}</span>
          <strong className="w-7 text-right font-semibold tabular-nums text-slate-700">{numberFormat.format(count)}</strong>
          <span className="w-10 text-right text-xs tabular-nums text-slate-600">{percent}%</span>
        </div>;
      })}
    </div>
    {unclassified > 0 && <button
      type="button"
      onClick={() => onNavigate("Employees", "unclassified")}
      className="mt-2 w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left text-xs font-medium leading-[1.4] text-rose-800 hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
    >
      {numberFormat.format(unclassified)} employee status{unclassified === 1 ? "" : "es"} need data review. Open employees.
    </button>}
    <div className="mt-3 flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2.5 text-xs font-medium leading-[1.4] text-violet-800">
      <Clock3 size={16} className="shrink-0" />
      <span>Average review time is {onboarding.averageReviewDays === null ? "not available" : `${onboarding.averageReviewDays} days`}</span>
    </div>
  </section>;
}

function DepartmentPanel({ departments, dayType, onNavigate }) {
  return <section className="min-h-[324px] min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,.045)]">
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-['Poppins',sans-serif] text-[18px] font-semibold tracking-[-.2px] text-slate-900">Department summary</h2>
      <button onClick={() => onNavigate("Reports")} className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold text-violet-800 hover:bg-violet-50 hover:text-violet-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600">Full report</button>
    </div>
    {departments.length ? <div className="mt-3">
      {departments.slice(0, 6).map((department) => {
        const rate = department.total ? Math.round((department.checkedIn / department.total) * 100) : 0;
        return <div key={department.name} className="grid grid-cols-[minmax(70px,.85fr)_minmax(54px,1fr)_auto] items-center gap-2 border-b border-slate-100 py-2.5 last:border-0 sm:grid-cols-[minmax(85px,.85fr)_minmax(70px,1fr)_auto]">
          <span className="truncate text-[13px] font-semibold text-slate-700">{department.name}</span>
          <span className="h-2 overflow-hidden rounded-full bg-violet-100">
            <span className="block h-full rounded-full bg-[linear-gradient(90deg,#6A0DAD_0%,#7C3AED_100%)]" style={{ width: `${dayType === "working" ? rate : 100}%` }} />
          </span>
          <span className="w-[84px] text-right text-xs tabular-nums text-slate-600">
            {dayType === "working" ? `${department.checkedIn}/${department.total} · ${rate}%` : `${department.total} employees`}
          </span>
        </div>;
      })}
    </div> : <p className="py-8 text-center text-[13px] text-slate-600">No active departments to show.</p>}
  </section>;
}

function ActivityPanel({ activities, className = "" }) {
  const [expanded, setExpanded] = useState(false);
  const visibleActivities = expanded ? activities : activities.slice(0, 5);

  return <section className={`min-h-[324px] min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,.045)] ${className}`}>
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-['Poppins',sans-serif] text-[18px] font-semibold tracking-[-.2px] text-slate-900">Latest team activity</h2>
      {activities.length > 5
        ? <button onClick={() => setExpanded(!expanded)} className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold text-violet-800 hover:bg-violet-50 hover:text-violet-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600">{expanded ? "Show less" : "View all"}</button>
        : <span className="text-xs font-medium text-slate-600">Last 7 days</span>}
    </div>
    {visibleActivities.length ? <div className="mt-2">
      {visibleActivities.map((item) => <ActivityItem key={item.id} item={item} />)}
    </div> : <p className="py-8 text-center text-[13px] text-slate-600">No recent activity in the last 7 days.</p>}
  </section>;
}

function ActivityItem({ item }) {
  const name = item.name || item.title.split(/ submitted onboarding| profile approved| profile needs changes| requested | checked in| checked out/i)[0];
  return <div className="flex min-w-0 items-center gap-3 border-b border-slate-100 py-2 last:border-0">
    <ProfileAvatar className="size-9 bg-violet-100 font-['Poppins',sans-serif] text-xs font-semibold text-violet-800" name={name} src={item.profilePic} />
    <div className="min-w-0 flex-1">
      <p className="truncate text-[13px] font-semibold text-slate-800">{item.title}</p>
      <p className="mt-0.5 truncate text-xs text-slate-600">{formatTime(item.timestamp)} · {item.detail}</p>
    </div>
  </div>;
}

function DashboardLoading() {
  return <section className="mt-4 animate-pulse space-y-4" aria-label="Loading dashboard">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((item) => <div className="h-24 rounded-2xl border border-slate-200 bg-white" key={item} />)}</div>
    <div className="grid gap-4 lg:grid-cols-[1.42fr_1fr]"><div className="h-[230px] rounded-2xl bg-violet-100" /><div className="h-[230px] rounded-2xl border border-slate-200 bg-white" /></div>
    <div className="grid gap-4 lg:grid-cols-2 min-[1200px]:!grid-cols-3">{[0, 1, 2].map((item) => <div className={`h-[340px] rounded-2xl border border-slate-200 bg-white ${item === 2 ? "lg:col-span-2 min-[1200px]:!col-span-1" : ""}`} key={item} />)}</div>
  </section>;
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
