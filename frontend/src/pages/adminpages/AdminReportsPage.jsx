import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
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
import useToastMessage from "../../hooks/useToastMessage";
import ProfileAvatar from "../../components/ProfileAvatar";

dayjs.extend(utc);
dayjs.extend(timezone);

const timeZone = "Asia/Karachi";
const currentMonth = () => dayjs().tz(timeZone).format("YYYY-MM");
const pageSize = 8;
const statusStyles = {
  present: "bg-green-50 text-green-700",
  late: "bg-amber-50 text-amber-800",
  absent: "bg-red-50 text-red-700",
  leave: "bg-violet-100 text-violet-800",
  holiday: "bg-violet-50 text-violet-800",
  weekend: "bg-slate-100 text-slate-600",
  pending: "bg-slate-100 text-slate-500",
  notEligible: "bg-slate-100 text-slate-500",
};
const barSegments = [
  { key: "present", label: "Present", color: "bg-green-700" },
  { key: "late", label: "Late", color: "bg-amber-700" },
  { key: "leave", label: "On leave", color: "bg-violet-600" },
  { key: "absent", label: "Absent", color: "bg-red-700" },
];

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
    return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">No prior month comparison</span>;
  }
  const improved = value === 0 || (value > 0) === favorableWhenUp;
  const Icon = value < 0 ? TrendingDown : TrendingUp;
  const text = unit === "pts"
    ? `${value > 0 ? "+" : ""}${value.toFixed(1).replace(/\.0$/, "")} pts vs ${previousMonth}`
    : `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatMinutes(Math.abs(value))} vs ${previousMonth}`;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${improved ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>
      {value === 0 ? <ArrowDown size={14} /> : <Icon size={14} />}
      {text}
    </span>
  );
}

function MetricCard({ label, value, icon: Icon, trend, tone = "violet" }) {
  const colors = {
    violet: "bg-violet-100 text-violet-800",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-red-50 text-red-700",
    emerald: "bg-green-50 text-green-700",
  };
  return (
    <article className="flex min-h-[116px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,.045)] sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-600">{label}</p>
        <span className={`grid size-9 place-items-center rounded-lg ${colors[tone]}`}><Icon size={17} /></span>
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <strong className="font-['Poppins',sans-serif] text-2xl font-semibold leading-none tracking-[-.4px] text-slate-900">{value}</strong>
        {trend}
      </div>
    </article>
  );
}

export default function AdminReportsPage() {
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
  useToastMessage(error, "error");
  useToastMessage(comparisonError, "warning");
  useToastMessage(detailError, "error");
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
  return (
    <main className="w-full min-w-0 font-['Inter',sans-serif] text-slate-800">
      <header className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div className="min-w-0">
          <h1 className="font-['Poppins',sans-serif] text-[30px] font-semibold leading-[1.25] tracking-[-.6px] text-slate-900">Reports</h1>
          <p className="mt-1 text-[14px] leading-[1.5] text-slate-600 sm:text-[15px]">Monthly attendance summaries and trends.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 items-center rounded-xl border border-slate-300 bg-white p-1 shadow-sm">
            <button type="button" onClick={() => setMonthByOffset(-1)} aria-label="Previous month" className="grid size-8 place-items-center rounded-lg text-slate-600 transition hover:bg-violet-50 hover:text-violet-800 max-[250px]:hidden"><ChevronLeft size={17} /></button>
            <label className="relative flex h-8 min-w-[140px] cursor-pointer items-center justify-center px-2 text-[13px] font-semibold text-slate-800 sm:min-w-[155px]">
              <span>{monthLabel}</span>
              <input aria-label="Report month" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" type="month" max={maxMonth} value={month} onChange={(event) => { setMonth(event.target.value); setPage(1); }} />
            </label>
            <button type="button" onClick={() => setMonthByOffset(1)} aria-label="Next month" disabled={month >= maxMonth} className="grid size-8 place-items-center rounded-lg text-slate-600 transition hover:bg-violet-50 hover:text-violet-800 disabled:cursor-not-allowed disabled:opacity-35 max-[250px]:hidden"><ChevronRight size={17} /></button>
          </div>
          <button type="button" onClick={download} disabled={exporting || loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#6A0DAD_0%,#7C3AED_100%)] px-4 font-['Poppins',sans-serif] text-[15px] font-semibold text-white shadow-[0_6px_16px_rgba(106,13,173,.2)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-60">
            {exporting ? <LoaderCircle className="animate-spin" size={16} /> : <Download size={16} />}
            {exporting ? "Exporting..." : "Export report"}
          </button>
        </div>
      </header>

      <section className="mb-4 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)] xl:gap-4">
        <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,.045)]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-['Poppins',sans-serif] text-[18px] font-semibold text-slate-900">Daily attendance</h2>
              <p className="mt-1 text-xs text-slate-600">{loading ? "Updating daily totals…" : `Working days ${chartRangeLabel} · weekends skipped`}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-800"><Users size={15} />{reports.length} employees</span>
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
                      <span className="text-xs text-slate-600">{total}</span>
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
                      <span className="text-xs font-medium text-slate-600">{formatDate(day.date, "D")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="grid h-[145px] place-items-center text-center">
              <p className="text-[13px] text-slate-600">Attendance totals will appear after the first working day.</p>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2">
            {barSegments.map((segment) => <span className="inline-flex items-center gap-1.5 text-xs text-slate-600" key={segment.key}><span className={`size-2 rounded-sm ${segment.color}`} />{segment.label}</span>)}
            {chartDays.length > 0 && <span className="ml-auto text-xs text-slate-600">{formatDate(chartDays[chartDays.length - 1].date, "D MMM")} to date</span>}
          </div>
        </article>

        <div className="grid min-w-0 grid-cols-2 gap-3 max-[250px]:grid-cols-1">
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

      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,.045)]">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-lg bg-violet-100 text-violet-800"><FileBarChart size={18} /></span>
            <div>
              <h2 className="font-['Poppins',sans-serif] text-[18px] font-semibold text-slate-900">Employee summary</h2>
              <p className="mt-0.5 text-xs text-slate-600">{loading ? "Loading employee data…" : `${filteredReports.length} of ${reports.length} employees`}</p>
            </div>
          </div>
          <div className="grid gap-2 min-[520px]:grid-cols-[minmax(180px,1.4fr)_minmax(135px,1fr)_minmax(125px,1fr)] lg:w-auto lg:min-w-[480px]">
            <label className="relative block min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-violet-800" size={16} />
              <input className="h-11 w-full rounded-xl border border-slate-400 bg-[#FBFAFF] pl-10 pr-3 text-[16px] text-slate-800 outline-none transition placeholder:text-slate-500 focus:border-violet-600 focus:bg-white focus:ring-4 focus:ring-violet-500/15 sm:text-[14px]" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search employee" aria-label="Search employee" />
            </label>
            <label className="sr-only" htmlFor="report-department">Department</label>
            <select id="report-department" className="h-11 min-w-0 rounded-xl border border-slate-400 bg-[#FBFAFF] px-3 text-[16px] text-slate-800 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-500/15 sm:text-[14px]" value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1); }}>
              <option value="">Department: All</option>
              {departments.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <label className="sr-only" htmlFor="report-status">Status</label>
            <select id="report-status" className="h-11 min-w-0 rounded-xl border border-slate-400 bg-[#FBFAFF] px-3 text-[16px] text-slate-800 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-500/15 sm:text-[14px]" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
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
            <div><span className="mx-auto grid size-11 place-items-center rounded-2xl bg-violet-50 text-violet-800"><Users size={20} /></span><p className="mt-3 text-[14px] font-semibold text-slate-800">No employee reports for {monthLabel}</p><p className="mt-1 text-[13px] text-slate-600">Approved employee attendance will appear here.</p></div>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="grid min-h-[210px] place-items-center px-5 text-center"><p className="text-[13px] text-slate-600">No employees match the selected filters.</p></div>
        ) : (
          <>
            <div className="contain-[layout_paint] overflow-x-auto">
              <table className="w-full min-w-[960px] text-left">
                <thead className="bg-violet-50/60 text-xs font-semibold text-slate-700">
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
                <tbody className="divide-y divide-slate-100 text-[13px]">
                  {visibleReports.map((report) => {
                    const { employee, summary } = report;
                    const tone = summary.attendancePercent < 80 ? "bg-amber-700" : summary.attendancePercent < 95 ? "bg-violet-600" : "bg-green-700";
                    return (
                      <tr className="transition hover:bg-violet-50/35" key={employee.id}>
                        <td className="px-4 py-2 sm:px-5">
                          <button type="button" onClick={() => openDetail(report)} className="flex min-w-0 items-center gap-2.5 text-left">
                            <ProfileAvatar className="size-9 bg-violet-100 font-['Poppins',sans-serif] text-xs font-semibold text-violet-800" name={employee.name} src={employee.profilePic} />
                            <span className="min-w-0">
                              <span className="block max-w-[180px] truncate text-[13px] font-semibold text-slate-800 hover:text-violet-800">{employee.name}</span>
                              <span className="block max-w-[180px] truncate text-xs text-slate-600">{employee.email}</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{employee.department || "—"}</td>
                        <td className="px-3 py-2 text-center text-slate-600">{summary.workingDays}</td>
                        <td className="px-3 py-2 text-center font-semibold text-green-700">{summary.present}</td>
                        <td className="px-3 py-2 text-center font-semibold text-amber-800">{summary.late}</td>
                        <td className={`px-3 py-2 text-center font-semibold ${summary.absent ? "text-red-700" : "text-slate-500"}`}>{summary.absent}</td>
                        <td className="px-3 py-2 text-center font-semibold text-violet-800">{summary.leave}</td>
                        <td className={`px-3 py-2 text-center ${summary.missingCheckOuts ? "font-semibold text-amber-800" : "text-slate-500"}`}>{summary.missingCheckOuts}</td>
                        <td className="px-3 py-2">
                          <div className="flex min-w-[86px] items-center gap-2">
                            <span className="h-2 min-w-10 flex-1 overflow-hidden rounded-full bg-slate-200"><span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, summary.attendancePercent)}%` }} /></span>
                            <span className="w-8 text-right font-semibold text-slate-700">{Math.round(summary.attendancePercent)}%</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatHours(summary.workedHours)}</td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => openDetail(report)} aria-label={`View ${employee.name} details`} className="grid size-9 place-items-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800"><ChevronRight size={16} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <footer className="flex flex-col justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
              <p className="text-xs text-slate-600">
                Showing {filteredReports.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredReports.length)} of {filteredReports.length} employees · {chartDays.length} working days so far
              </p>
              <nav className="flex items-center gap-1" aria-label="Report pages">
                <button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous page" className="grid size-9 place-items-center rounded-lg border border-slate-300 text-slate-600 hover:bg-violet-50 disabled:opacity-40"><ChevronLeft size={16} /></button>
                {pageNumbers.map((number, index) => (
                  <span className="contents" key={number}>
                    {index > 0 && number - pageNumbers[index - 1] > 1 && <span className="px-1 text-xs text-slate-600">…</span>}
                    <button type="button" aria-current={page === number ? "page" : undefined} onClick={() => setPage(number)} className={`grid size-9 place-items-center rounded-lg border text-xs font-semibold ${page === number ? "border-violet-300 bg-violet-100 text-violet-800 shadow-sm" : "border-slate-300 bg-white text-slate-700 hover:bg-violet-50"}`}>{number}</button>
                  </span>
                ))}
                <button type="button" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} aria-label="Next page" className="grid size-9 place-items-center rounded-lg border border-slate-300 text-slate-600 hover:bg-violet-50 disabled:opacity-40"><ChevronRight size={16} /></button>
              </nav>
            </footer>
          </>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-3 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetail(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="report-detail-title" className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]">
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <ProfileAvatar className="size-10 bg-violet-100 font-['Poppins',sans-serif] text-xs font-semibold text-violet-800" name={selected.employee?.name} src={selected.employee?.profilePic} />
                <div className="min-w-0">
                  <h2 id="report-detail-title" className="truncate font-['Poppins',sans-serif] text-xl font-semibold text-slate-900">{selected.employee?.name || "Employee detail"}</h2>
                  <p className="truncate text-[13px] text-slate-600">{selected.employee?.email} · {dayjs(`${selected.month}-01`).format("MMMM YYYY")}</p>
                </div>
              </div>
              <button type="button" onClick={closeDetail} aria-label="Close employee details" className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-violet-50 hover:text-violet-800"><X size={18} /></button>
            </header>
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
                    <h3 className="text-[14px] font-semibold text-slate-800">Daily attendance</h3>
                    <span className="text-xs text-slate-600">{selected.daily?.length || 0} dates</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(selected.daily || []).map((day) => (
                      <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3" key={day.date}>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-800">{formatDate(day.date, "ddd, D MMM")}</p>
                          <p className="mt-1 truncate text-xs text-slate-600">
                            {day.checkIn ? `${formatTime(day.checkIn)}${day.checkOut ? ` – ${formatTime(day.checkOut)}` : " – No checkout"}` : "No check-in record"}
                            {day.workedMinutes ? ` · ${formatMinutes(day.workedMinutes)}` : ""}
                            {day.lateByMinutes ? ` · ${day.lateByMinutes}m late` : ""}
                            {day.missingCheckOut ? " · Missing checkout" : ""}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[day.status] || statusStyles.pending}`}>
                          {day.status === "notEligible" ? "Not eligible" : day.status}
                          {day.leaveDays ? ` · ${day.leaveDays}d${day.leavePeriod ? ` ${day.leavePeriod}` : ""}` : ""}
                        </span>
                      </div>
                    ))}
                    {!selected.daily?.length && <p className="col-span-full rounded-xl bg-slate-50 px-3 py-8 text-center text-[13px] text-slate-600">No daily attendance records for this month.</p>}
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
  return <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"><p className="text-xs text-slate-600">{label}</p><strong className="mt-1 block truncate font-['Poppins',sans-serif] text-[15px] font-semibold text-slate-900">{value}</strong></div>;
}
