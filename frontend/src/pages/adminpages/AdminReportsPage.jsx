import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileBarChart,
  LoaderCircle,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { exportMonthlyReport, getEmployeeMonthlyReport, getMonthlyReport } from "../../api/auth.api";
import { useAuth } from "../../context/AuthContext";

dayjs.extend(utc);
dayjs.extend(timezone);

const timeZone = "Asia/Karachi";
const currentMonth = () => dayjs().tz(timeZone).format("YYYY-MM");
const pageSize = 8;
const statusStyles = {
  present: "bg-emerald-50 text-emerald-700",
  late: "bg-amber-50 text-amber-700",
  absent: "bg-rose-50 text-rose-700",
  leave: "bg-violet-50 text-violet-700",
  holiday: "bg-sky-50 text-sky-700",
  weekend: "bg-slate-100 text-slate-600",
  pending: "bg-slate-100 text-slate-500",
  notEligible: "bg-slate-100 text-slate-500",
};
const barSegments = [
  { key: "present", label: "Present", color: "bg-emerald-500" },
  { key: "late", label: "Late", color: "bg-amber-500" },
  { key: "leave", label: "On leave", color: "bg-violet-500" },
  { key: "absent", label: "Absent", color: "bg-rose-500" },
];
const avatarColors = [
  "from-violet-500 to-fuchsia-500",
  "from-rose-500 to-red-600",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-blue-600",
  "from-amber-500 to-orange-600",
];

const initials = (name = "") =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "U";

const formatMinutes = (minutes = 0) => {
  const safeMinutes = Math.max(0, Math.round(minutes));
  return `${Math.floor(safeMinutes / 60)}h ${String(safeMinutes % 60).padStart(2, "0")}m`;
};

const formatHours = (hours = 0) => formatMinutes(hours * 60);
const formatDate = (date, format = "D MMM") => dayjs(`${date}T12:00:00`).format(format);
const formatTime = (value) => value
  ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(value))
  : "—";

const aggregate = (reports = []) => reports.reduce((result, report) => {
  for (const day of report.daily || []) {
    if (Object.prototype.hasOwnProperty.call(result, day.status)) result[day.status] += 1;
    result.workedMinutes += day.workedMinutes || day.attendance?.workedMinutes || 0;
  }
  return result;
}, { present: 0, late: 0, absent: 0, leave: 0, workedMinutes: 0 });

const rate = (numerator, denominator) =>
  denominator ? (numerator / denominator) * 100 : 0;

const metricValues = (reports) => {
  const totals = aggregate(reports);
  const attendedDays = totals.present + totals.late + totals.absent;
  const workedDays = totals.present + totals.late;
  return {
    attendance: rate(totals.present + totals.late, attendedDays),
    late: rate(totals.late, attendedDays),
    absence: rate(totals.absent, attendedDays),
    averageMinutes: workedDays ? totals.workedMinutes / workedDays : 0,
  };
};

const chartDaysFor = (reports) => {
  const byDate = new Map();
  for (const report of reports) {
    for (const day of report.daily || []) {
      if (!["present", "late", "leave", "absent"].includes(day.status)) continue;
      if (!byDate.has(day.date)) byDate.set(day.date, { date: day.date, present: 0, late: 0, leave: 0, absent: 0 });
      byDate.get(day.date)[day.status] += 1;
    }
  }
  return [...byDate.values()].sort((first, second) => first.date.localeCompare(second.date));
};

const matchesStatus = (report, filter) => {
  if (filter === "all") return true;
  if (filter === "missing") return report.summary.missingCheckOuts > 0;
  if (filter === "attendance") return report.summary.attendancePercent >= 90;
  return report.summary[filter] > 0;
};

function Trend({ value, unit, favorableWhenUp, previousMonth }) {
  if (value === null) {
    return <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-500">No prior month comparison</span>;
  }
  const improved = value === 0 || (value > 0) === favorableWhenUp;
  const Icon = value < 0 ? TrendingDown : TrendingUp;
  const text = unit === "pts"
    ? `${value > 0 ? "+" : ""}${value.toFixed(1).replace(/\.0$/, "")} pts vs ${previousMonth}`
    : `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatMinutes(Math.abs(value))} vs ${previousMonth}`;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold ${improved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
      {value === 0 ? <ArrowDown size={11} /> : <Icon size={11} />}
      {text}
    </span>
  );
}

function MetricCard({ label, value, icon: Icon, trend, tone = "violet" }) {
  const colors = {
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };
  return (
    <article className="flex min-h-[98px] flex-col justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_5px_16px_rgba(15,23,42,.035)] sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-500 sm:text-[12px]">{label}</p>
        <span className={`grid size-7 place-items-center rounded-lg ${colors[tone]}`}><Icon size={14} /></span>
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <strong className="font-['Poppins',sans-serif] text-[24px] font-semibold leading-none tracking-[-.7px] text-slate-900 sm:text-[27px]">{value}</strong>
        {trend}
      </div>
    </article>
  );
}

export default function AdminReportsPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth);
  const [reports, setReports] = useState([]);
  const [previousReports, setPreviousReports] = useState([]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState("asc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [comparisonError, setComparisonError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const requestId = useRef(0);
  const detailRequestId = useRef(0);

  const previousMonth = dayjs(`${month}-01`).subtract(1, "month").format("YYYY-MM");
  const monthLabel = dayjs(`${month}-01`).format("MMMM YYYY");
  const previousMonthLabel = dayjs(`${previousMonth}-01`).format("MMM");
  const maxMonth = currentMonth();

  useEffect(() => {
    const request = ++requestId.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      setComparisonError("");
      Promise.allSettled([
        getMonthlyReport({ month }),
        getMonthlyReport({ month: previousMonth }),
      ]).then(([currentResult, previousResult]) => {
        if (request !== requestId.current) return;
        if (currentResult.status === "rejected") {
          setError(currentResult.reason?.response?.data?.message || "Unable to load monthly report.");
          setReports([]);
          setPreviousReports([]);
        } else {
          setReports(currentResult.value.reports || []);
          if (previousResult.status === "fulfilled") {
            setPreviousReports(previousResult.value.reports || []);
          } else {
            setPreviousReports([]);
            setComparisonError("Month-over-month comparisons are unavailable right now.");
          }
        }
        setLoading(false);
      });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      requestId.current += 1;
    };
  }, [month, previousMonth]);

  useEffect(() => {
    if (!selected) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        detailRequestId.current += 1;
        setSelected(null);
        setDetailError("");
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selected]);

  const departments = useMemo(
    () => [...new Set(reports.map((report) => report.employee.department).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [reports],
  );
  const filteredReports = useMemo(() => reports
    .filter((report) => {
      const query = search.trim().toLowerCase();
      const matchesSearch = !query
        || report.employee.name.toLowerCase().includes(query)
        || report.employee.email.toLowerCase().includes(query);
      return matchesSearch
        && (!department || report.employee.department === department)
        && matchesStatus(report, statusFilter);
    })
    .sort((first, second) => sortDirection === "asc"
      ? first.summary.attendancePercent - second.summary.attendancePercent
      : second.summary.attendancePercent - first.summary.attendancePercent),
  [department, reports, search, sortDirection, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredReports.length / pageSize));
  const visibleReports = filteredReports.slice((page - 1) * pageSize, page * pageSize);
  const currentMetrics = useMemo(() => metricValues(reports), [reports]);
  const previousMetrics = useMemo(() => metricValues(previousReports), [previousReports]);
  const chartDays = useMemo(() => chartDaysFor(reports), [reports]);
  const maxDailyEmployees = Math.max(1, ...chartDays.map((day) => day.present + day.late + day.leave + day.absent));

  const setMonthByOffset = (offset) => {
    setMonth((value) => dayjs(`${value}-01`).add(offset, "month").format("YYYY-MM"));
    setPage(1);
  };

  const openDetail = async (report) => {
    const request = ++detailRequestId.current;
    setSelected({ employee: report.employee, month, daily: [] });
    setDetailLoading(true);
    setDetailError("");
    try {
      const result = await getEmployeeMonthlyReport(report.employee.id, { month });
      if (request === detailRequestId.current) setSelected(result);
    } catch (requestError) {
      if (request === detailRequestId.current) {
        setDetailError(requestError.response?.data?.message || "Unable to load employee report details.");
      }
    } finally {
      if (request === detailRequestId.current) setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    detailRequestId.current += 1;
    setSelected(null);
    setDetailLoading(false);
    setDetailError("");
  };

  const download = async () => {
    setExporting(true);
    setError("");
    try {
      const response = await exportMonthlyReport({
        month,
        department: department || undefined,
        search: search.trim() || undefined,
      });
      const url = URL.createObjectURL(new Blob([response.data], {
        type: response.headers["content-type"] || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `crew-hrcore-attendance-${month}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to export report.");
    } finally {
      setExporting(false);
    }
  };

  const hasPreviousMetrics = previousReports.length > 0;
  const metricTrend = (key, favorableWhenUp, unit = "pts") => ({
      value: hasPreviousMetrics ? currentMetrics[key] - previousMetrics[key] : null,
      unit,
      favorableWhenUp,
      previousMonth: previousMonthLabel,
    });

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((number) => number === 1 || number === totalPages || Math.abs(number - page) <= 1);
  const chartRangeLabel = chartDays.length
    ? chartDays[0].date.slice(0, 7) === chartDays[chartDays.length - 1].date.slice(0, 7)
      ? `${formatDate(chartDays[0].date, "D")}–${formatDate(chartDays[chartDays.length - 1].date, "D MMM")}`
      : `${formatDate(chartDays[0].date)}–${formatDate(chartDays[chartDays.length - 1].date)}`
    : "No completed working days";
  const avatarName = user?.name || "Administrator";

  return (
    <main className="w-full min-w-0 font-['Inter',sans-serif] text-slate-800">
      <header className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div className="min-w-0">
          <h1 className="font-['Poppins',sans-serif] text-[24px] font-semibold leading-tight tracking-[-.5px] text-slate-900 sm:text-[27px]">Reports</h1>
          <p className="mt-1 text-[11px] text-slate-500 sm:text-[12px]">Monthly attendance summaries and trends.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button type="button" onClick={() => setMonthByOffset(-1)} aria-label="Previous month" className="grid size-7 place-items-center rounded-lg text-slate-500 transition hover:bg-violet-50 hover:text-violet-700"><ChevronLeft size={15} /></button>
            <label className="relative flex h-7 min-w-[125px] cursor-pointer items-center justify-center px-2 text-[11px] font-semibold text-slate-700 sm:min-w-[145px] sm:text-[12px]">
              <span>{monthLabel}</span>
              <input aria-label="Report month" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" type="month" max={maxMonth} value={month} onChange={(event) => { setMonth(event.target.value); setPage(1); }} />
            </label>
            <button type="button" onClick={() => setMonthByOffset(1)} aria-label="Next month" disabled={month >= maxMonth} className="grid size-7 place-items-center rounded-lg text-slate-500 transition hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-35"><ChevronRight size={15} /></button>
          </div>
          <button type="button" onClick={download} disabled={exporting || loading} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7116b9] to-[#853de8] px-3.5 text-[11px] font-semibold text-white shadow-[0_6px_15px_rgba(112,22,185,.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4">
            {exporting ? <LoaderCircle className="animate-spin" size={14} /> : <Download size={14} />}
            {exporting ? "Exporting..." : "Export report"}
          </button>
          <button type="button" aria-label="Notifications" className="relative grid size-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-violet-700"><Bell size={15} /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-rose-500" /></button>
          <div className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 shadow-sm">
            <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 font-['Poppins',sans-serif] text-[9px] font-semibold text-white">{initials(avatarName)}</span>
            <span className="max-w-16 truncate text-[10px] font-medium text-slate-700 sm:max-w-24 sm:text-[11px]">{avatarName.split(" ")[0]}</span>
          </div>
        </div>
      </header>

      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700" role="alert">{error}</p>}
      {comparisonError && !error && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] text-amber-800" role="status">{comparisonError}</p>}

      <section className="mb-4 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)] xl:gap-4">
        <article className="min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,.04)] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">Daily attendance</h2>
              <p className="mt-1 text-[9px] text-slate-500 sm:text-[10px]">{loading ? "Updating daily totals…" : `Working days ${chartRangeLabel} · weekends skipped`}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[9px] font-semibold text-violet-700"><Users size={12} />{reports.length} employees</span>
          </div>
          {loading ? (
            <div className="grid h-[145px] place-items-center"><LoaderCircle className="animate-spin text-violet-600" size={21} /></div>
          ) : chartDays.length ? (
            <div className="mt-3 overflow-x-auto pb-1">
              <div className="flex min-w-[540px] items-end gap-1.5 sm:gap-2">
                {chartDays.map((day) => {
                  const total = day.present + day.late + day.leave + day.absent;
                  return (
                    <div className="flex min-w-0 flex-1 flex-col items-center gap-1" key={day.date}>
                      <span className="text-[8px] text-slate-400">{total}</span>
                      <div className="flex h-[92px] w-full max-w-[28px] flex-col-reverse overflow-hidden rounded-t-[3px] bg-slate-100 sm:h-[104px]">
                        {barSegments.map((segment) => day[segment.key] > 0 && (
                          <span
                            className={`block min-h-[2px] w-full ${segment.color}`}
                            key={segment.key}
                            style={{ height: `${(day[segment.key] / maxDailyEmployees) * 100}%` }}
                            title={`${segment.label}: ${day[segment.key]}`}
                          />
                        ))}
                      </div>
                      <span className="text-[8px] font-medium text-slate-500">{formatDate(day.date, "D")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="grid h-[145px] place-items-center text-center">
              <p className="text-[11px] text-slate-400">Attendance totals will appear after the first working day.</p>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2">
            {barSegments.map((segment) => <span className="inline-flex items-center gap-1 text-[9px] text-slate-500" key={segment.key}><span className={`size-2 rounded-sm ${segment.color}`} />{segment.label}</span>)}
            {chartDays.length > 0 && <span className="ml-auto text-[9px] text-slate-400">{formatDate(chartDays[chartDays.length - 1].date, "D MMM")} to date</span>}
          </div>
        </article>

        <div className="grid min-w-0 grid-cols-2 gap-3">
          <MetricCard
            label="Attendance rate"
            value={`${currentMetrics.attendance.toFixed(0)}%`}
            icon={FileBarChart}
            trend={<Trend {...metricTrend("attendance", true)} />}
            tone="emerald"
          />
          <MetricCard
            label="Late rate"
            value={`${currentMetrics.late.toFixed(1)}%`}
            icon={Clock3}
            trend={<Trend {...metricTrend("late", false)} />}
            tone="amber"
          />
          <MetricCard
            label="Absence rate"
            value={`${currentMetrics.absence.toFixed(1)}%`}
            icon={CalendarDays}
            trend={<Trend {...metricTrend("absence", false)} />}
            tone="rose"
          />
          <MetricCard
            label="Avg worked per day"
            value={formatMinutes(currentMetrics.averageMinutes)}
            icon={Clock3}
            trend={<Trend {...metricTrend("averageMinutes", true, "time")} />}
            tone="violet"
          />
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_6px_18px_rgba(15,23,42,.04)]">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-violet-50 text-violet-700"><FileBarChart size={15} /></span>
            <div>
              <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">Employee summary</h2>
              <p className="mt-0.5 text-[9px] text-slate-500">{loading ? "Loading employee data…" : `${filteredReports.length} of ${reports.length} employees`}</p>
            </div>
          </div>
          <div className="grid gap-2 min-[520px]:grid-cols-[minmax(180px,1.4fr)_minmax(135px,1fr)_minmax(125px,1fr)] lg:w-auto lg:min-w-[480px]">
            <label className="relative block min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-violet-500" size={14} />
              <input className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[10px] outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search employee" aria-label="Search employee" />
            </label>
            <label className="sr-only" htmlFor="report-department">Department</label>
            <select id="report-department" className="h-9 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-[10px] text-slate-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1); }}>
              <option value="">Department: All</option>
              {departments.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <label className="sr-only" htmlFor="report-status">Status</label>
            <select id="report-status" className="h-9 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-[10px] text-slate-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
              <option value="all">Status: All</option>
              <option value="late">Has late days</option>
              <option value="absent">Has absences</option>
              <option value="leave">Has leave</option>
              <option value="missing">Missing check-out</option>
              <option value="attendance">Attendance 90%+</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-[280px] place-items-center"><LoaderCircle className="animate-spin text-violet-600" size={23} /></div>
        ) : reports.length === 0 ? (
          <div className="grid min-h-[260px] place-items-center px-5 text-center">
            <div><span className="mx-auto grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Users size={20} /></span><p className="mt-3 text-[12px] font-semibold text-slate-700">No employee reports for {monthLabel}</p><p className="mt-1 text-[10px] text-slate-400">Approved employee attendance will appear here.</p></div>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="grid min-h-[210px] place-items-center px-5 text-center"><p className="text-[11px] text-slate-400">No employees match the selected filters.</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left">
                <thead className="bg-white text-[9px] font-semibold text-slate-400">
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3 sm:px-5">Employee</th>
                    <th className="px-3 py-3">Department</th>
                    <th className="px-3 py-3 text-center">Days</th>
                    <th className="px-3 py-3 text-center">Present</th>
                    <th className="px-3 py-3 text-center">Late</th>
                    <th className="px-3 py-3 text-center">Absent</th>
                    <th className="px-3 py-3 text-center">Leave</th>
                    <th className="px-3 py-3 text-center">Missing</th>
                    <th className="px-3 py-3">
                      <button type="button" onClick={() => { setSortDirection((value) => value === "asc" ? "desc" : "asc"); setPage(1); }} className="inline-flex items-center gap-1 text-violet-700" aria-label="Sort by attendance rate">
                        Attendance {sortDirection === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                      </button>
                    </th>
                    <th className="px-3 py-3">Worked hours</th>
                    <th className="px-3 py-3"><span className="sr-only">Details</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[10px]">
                  {visibleReports.map((report, index) => {
                    const { employee, summary } = report;
                    const tone = summary.attendancePercent < 80 ? "bg-amber-500" : summary.attendancePercent < 95 ? "bg-violet-500" : "bg-emerald-500";
                    return (
                      <tr className="transition hover:bg-violet-50/35" key={employee.id}>
                        <td className="px-4 py-2 sm:px-5">
                          <button type="button" onClick={() => openDetail(report)} className="flex min-w-0 items-center gap-2.5 text-left">
                            <span className={`grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br ${avatarColors[((page - 1) * pageSize + index) % avatarColors.length]} text-[8px] font-bold text-white`}>{initials(employee.name)}</span>
                            <span className="min-w-0">
                              <span className="block max-w-[180px] truncate text-[10px] font-semibold text-slate-800 hover:text-violet-700">{employee.name}</span>
                              <span className="block max-w-[180px] truncate text-[9px] text-slate-400">{employee.email}</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-2 text-[10px] text-slate-500">{employee.department || "General"}</td>
                        <td className="px-3 py-2 text-center text-slate-600">{summary.workingDays}</td>
                        <td className="px-3 py-2 text-center font-semibold text-emerald-700">{summary.present}</td>
                        <td className="px-3 py-2 text-center font-semibold text-amber-700">{summary.late}</td>
                        <td className={`px-3 py-2 text-center font-semibold ${summary.absent ? "text-rose-600" : "text-slate-300"}`}>{summary.absent}</td>
                        <td className="px-3 py-2 text-center font-semibold text-violet-700">{summary.leave}</td>
                        <td className={`px-3 py-2 text-center ${summary.missingCheckOuts ? "font-semibold text-amber-700" : "text-slate-300"}`}>{summary.missingCheckOuts}</td>
                        <td className="px-3 py-2">
                          <div className="flex min-w-[86px] items-center gap-2">
                            <span className="h-1.5 min-w-10 flex-1 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, summary.attendancePercent)}%` }} /></span>
                            <span className="w-8 text-right font-semibold text-slate-700">{Math.round(summary.attendancePercent)}%</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatHours(summary.workedHours)}</td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => openDetail(report)} aria-label={`View ${employee.name} details`} className="grid size-7 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"><ChevronRight size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <footer className="flex flex-col justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
              <p className="text-[9px] text-slate-500">
                Showing {filteredReports.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredReports.length)} of {filteredReports.length} employees · {chartDays.length} working days so far
              </p>
              <nav className="flex items-center gap-1" aria-label="Report pages">
                <button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous page" className="grid size-7 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-violet-50 disabled:opacity-40"><ChevronLeft size={13} /></button>
                {pageNumbers.map((number, index) => (
                  <span className="contents" key={number}>
                    {index > 0 && number - pageNumbers[index - 1] > 1 && <span className="px-1 text-[10px] text-slate-400">…</span>}
                    <button type="button" aria-current={page === number ? "page" : undefined} onClick={() => setPage(number)} className={`grid size-7 place-items-center rounded-lg text-[10px] font-semibold ${page === number ? "bg-gradient-to-r from-[#7116b9] to-[#853de8] text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-violet-50"}`}>{number}</button>
                  </span>
                ))}
                <button type="button" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} aria-label="Next page" className="grid size-7 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-violet-50 disabled:opacity-40"><ChevronRight size={13} /></button>
              </nav>
            </footer>
          </>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-3 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetail(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="report-detail-title" className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]">
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-100 font-semibold text-violet-700">{initials(selected.employee?.name)}</span>
                <div className="min-w-0">
                  <h2 id="report-detail-title" className="truncate font-['Poppins',sans-serif] text-[15px] font-semibold text-slate-900">{selected.employee?.name || "Employee detail"}</h2>
                  <p className="truncate text-[10px] text-slate-500">{selected.employee?.email} · {dayjs(`${selected.month}-01`).format("MMMM YYYY")}</p>
                </div>
              </div>
              <button type="button" onClick={closeDetail} aria-label="Close employee details" className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={16} /></button>
            </header>
            {detailError && <p className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-700 sm:mx-6" role="alert">{detailError}</p>}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {detailLoading ? <div className="grid min-h-40 place-items-center"><LoaderCircle className="animate-spin text-violet-600" size={22} /></div> : (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <DetailStat label="Working days" value={selected.summary?.workingDays ?? "—"} />
                    <DetailStat label="Attendance" value={selected.summary ? `${Math.round(selected.summary.attendancePercent)}%` : "—"} />
                    <DetailStat label="Worked" value={selected.summary ? formatHours(selected.summary.workedHours) : "—"} />
                    <DetailStat label="Missing check-outs" value={selected.summary?.missingCheckOuts ?? "—"} />
                  </div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-[11px] font-semibold text-slate-800">Daily attendance</h3>
                    <span className="text-[9px] text-slate-400">{selected.daily?.length || 0} dates</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(selected.daily || []).map((day) => (
                      <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5" key={day.date}>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-slate-700">{formatDate(day.date, "ddd, D MMM")}</p>
                          <p className="mt-1 truncate text-[9px] text-slate-500">
                            {day.checkIn ? `${formatTime(day.checkIn)}${day.checkOut ? ` – ${formatTime(day.checkOut)}` : " – No checkout"}` : "No check-in record"}
                            {day.workedMinutes ? ` · ${formatMinutes(day.workedMinutes)}` : ""}
                            {day.lateByMinutes ? ` · ${day.lateByMinutes}m late` : ""}
                            {day.missingCheckOut ? " · Missing checkout" : ""}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold capitalize ${statusStyles[day.status] || statusStyles.pending}`}>
                          {day.status === "notEligible" ? "Not eligible" : day.status}
                          {day.leaveDays ? ` · ${day.leaveDays}d${day.leavePeriod ? ` ${day.leavePeriod}` : ""}` : ""}
                        </span>
                      </div>
                    ))}
                    {!selected.daily?.length && <p className="col-span-full rounded-xl bg-slate-50 px-3 py-8 text-center text-[10px] text-slate-400">No daily attendance records for this month.</p>}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function DetailStat({ label, value }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"><p className="text-[9px] text-slate-500">{label}</p><strong className="mt-1 block truncate text-[12px] font-semibold text-slate-900">{value}</strong></div>;
}
