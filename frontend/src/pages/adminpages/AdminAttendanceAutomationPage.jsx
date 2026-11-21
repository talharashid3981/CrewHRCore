import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  History,
  LoaderCircle,
  MapPin,
  Play,
  RefreshCw,
  Search,
  Shield,
  SlidersHorizontal,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import {
  correctMissingCheckOut,
  exportAdminAttendanceDay,
  getAdminAttendanceDay,
  runAttendanceAutomation,
} from "../../api/auth.api";
import useToastMessage from "../../hooks/useToastMessage";

const statusStyles = {
  present: "bg-green-50 text-green-700 ring-green-200",
  late: "bg-amber-50 text-amber-800 ring-amber-200",
  absent: "bg-red-50 text-red-700 ring-red-200",
  leave: "bg-violet-50 text-violet-800 ring-violet-200",
  holiday: "bg-violet-50 text-violet-800 ring-violet-200",
  weekend: "bg-slate-100 text-slate-600 ring-slate-200",
  pending: "bg-slate-100 text-slate-600 ring-slate-200",
};

const correctionReasons = [
  ["employee_forgot", "Employee forgot to check out"],
  ["technical_issue", "Technical issue"],
  ["manual_adjustment", "Manual adjustment"],
];

export default function AdminAttendanceAutomationPage({ user, onNavigate }) {
  const [today] = useState(getKarachiToday);
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useToastMessage(error, "error");
  useToastMessage(
    notice,
    notice.toLowerCase().includes("up to date") || notice.toLowerCase().includes("already running") ? "info" : "success",
  );
  const [exporting, setExporting] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [correction, setCorrection] = useState(null);
  const [checkoutTime, setCheckoutTime] = useState("");
  const [correctionReason, setCorrectionReason] = useState(correctionReasons[0][0]);
  const [correctionNote, setCorrectionNote] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [missingTab, setMissingTab] = useState("yesterday");

  useEffect(() => {
    let active = true;
    getAdminAttendanceDay({ date, search, status, department, page, limit: 8 })
      .then((result) => {
        if (active) {
          setData(result);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "Unable to load attendance for this date.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, search, status, department, page, refreshKey]);

  const setFilter = (setter) => (value) => {
    setLoading(true);
    setter(value);
    setPage(1);
  };

  const selectDate = (nextDate) => {
    if (!nextDate || nextDate > today) return;
    setLoading(true);
    setDate(nextDate);
    setPage(1);
  };

  const moveDate = (offset) => selectDate(shiftDate(date, offset));

  const downloadCsv = async () => {
    setError("");
    setExporting(true);
    try {
      const response = await exportAdminAttendanceDay({ date, search, status, department });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance-${date}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to export attendance.");
    } finally {
      setExporting(false);
    }
  };

  const runAutomation = async () => {
    setRunning(true);
    setError("");
    setNotice("");
    try {
      const result = await runAttendanceAutomation();
      const run = result.result || {};
      if (run.reason === "up_to_date" || run.message === "No closed days to process") {
        setNotice(`Attendance is up to date through ${formatShortDate(run.throughDate || shiftDate(today, -1))}. No records were changed.`);
      } else if (run.reason === "already_running") {
        setNotice("Attendance automation is already running. Wait for it to finish before starting another run.");
      } else if (run.skipped) {
        setNotice(run.message || "Attendance automation did not run. No records were changed.");
      } else {
        setNotice(`Attendance close completed for ${formatShortDate(run.from)}${run.to && run.to !== run.from ? `–${formatShortDate(run.to)}` : ""}.`);
      }
      setRunOpen(false);
      setLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to run attendance automation.");
    } finally {
      setRunning(false);
    }
  };

  const openCorrection = (row) => {
    setCorrection(row);
    setCheckoutTime("");
    setCorrectionReason(correctionReasons[0][0]);
    setCorrectionNote("");
  };

  const saveCorrection = async (event) => {
    event.preventDefault();
    if (!correction?.attendanceId) return;
    setSavingCorrection(true);
    setError("");
    setNotice("");
    try {
      await correctMissingCheckOut(correction.attendanceId, {
        checkOutTime: checkoutTime,
        reason: correctionReason,
        note: correctionNote,
      });
      setCorrection(null);
      setNotice("Checkout correction saved to the audit trail.");
      setLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to save the checkout correction.");
    } finally {
      setSavingCorrection(false);
    }
  };

  const allMissing = data?.missingCheckOuts || [];
  const yesterday = shiftDate(date, -1);
  const yesterdayMissing = allMissing.filter((item) => item.date === yesterday);
  const olderMissing = allMissing.filter((item) => item.date < yesterday);
  const missingRows = missingTab === "yesterday" ? yesterdayMissing : olderMissing;
  const summary = data?.summary;
  const stats = [
    { key: "present", label: "Present", value: summary?.present || 0, color: "bg-green-700" },
    { key: "late", label: "Late", value: summary?.late || 0, color: "bg-amber-700" },
    { key: "absent", label: "Absent", value: summary?.absent || 0, color: "bg-red-700" },
    { key: "notCheckedIn", label: "Not checked in", value: summary?.pending || 0, color: "bg-slate-400" },
    { key: "leave", label: "On leave", value: summary?.leave || 0, color: "bg-violet-600" },
  ];
  const totalStatCount = stats.reduce((total, item) => total + item.value, 0);
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Admin";
  const automation = data?.automation;
  const AutomationStatusIcon = automation?.isHealthy ? CheckCircle2 : AlertCircle;

  return <main className="w-full min-w-0 font-['Inter',sans-serif] text-slate-800">
    <header className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
      <div className="min-w-0">
        <h1 className="font-['Poppins',sans-serif] text-[30px] font-semibold leading-[1.25] tracking-[-.6px] text-slate-900">Attendance</h1>
        <p className="mt-1 text-[14px] leading-[1.5] text-slate-600 sm:text-[15px]">Monitor the day, fix missing check-outs and run automation.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-10 items-center rounded-xl border border-slate-300 bg-white p-1 shadow-sm">
          <button type="button" onClick={() => moveDate(-1)} aria-label="Previous day" className="grid size-8 place-items-center rounded-lg text-slate-600 transition hover:bg-violet-50 hover:text-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600 max-[250px]:hidden"><ChevronLeft size={16} /></button>
          <label className="flex min-w-0 items-center gap-1.5 px-1">
            <CalendarDays size={16} className="shrink-0 text-violet-800" />
            <input aria-label="Attendance date" className="w-[132px] border-0 bg-transparent p-0 text-[16px] font-medium text-slate-800 outline-none sm:text-[14px]" type="date" max={today} value={date} onChange={(event) => selectDate(event.target.value)} />
          </label>
          <button type="button" onClick={() => moveDate(1)} disabled={date >= today} aria-label="Next day" className="grid size-8 place-items-center rounded-lg text-slate-600 transition hover:bg-violet-50 hover:text-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-30 max-[250px]:hidden"><ChevronRight size={16} /></button>
        </div>
        <button type="button" onClick={downloadCsv} disabled={exporting || loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50/60 hover:text-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:opacity-60">
          {exporting ? <LoaderCircle size={16} className="animate-spin text-violet-800" /> : <Download size={16} className="text-violet-800" />}
          Export
        </button>
        <div className="flex h-10 items-center gap-2 rounded-full border border-slate-300 bg-white py-1 pl-1 pr-3 shadow-sm">
          <span className="grid size-8 place-items-center rounded-full bg-violet-100 font-['Poppins',sans-serif] text-xs font-semibold text-violet-800">{initials(user?.name)}</span>
          <span className="max-w-20 truncate text-[13px] font-medium text-slate-700">{firstName}</span>
        </div>
      </div>
    </header>

    <div className="mb-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.98fr)]">
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[0_8px_24px_rgba(15,23,42,.045)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="min-w-0 font-['Poppins',sans-serif] text-[18px] font-semibold tracking-[-.2px] text-slate-900">{date === today ? "Today" : formatShortDate(date)}</h2>
          <p className="min-w-0 text-right text-xs text-slate-600">{summary?.totalEmployees ?? "—"} active employees <span className="text-slate-500">·</span> {summary?.updatedAt ? `updated ${formatClock(summary.updatedAt)}` : "no attendance updates"}</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 sm:gap-2">
          {stats.map((item) => <div key={item.key} className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-[13px] leading-4 text-slate-600"><i className={`size-2 shrink-0 rounded-full ${item.color}`} />{item.label}</p>
            <p className="mt-1 font-['Poppins',sans-serif] text-2xl font-semibold leading-none tracking-[-.4px] text-slate-900">{(loading || error) && !summary ? "—" : item.value}</p>
          </div>)}
        </div>
        <div className="mt-3 flex h-[7px] overflow-hidden rounded-full bg-slate-100" aria-label="Daily attendance distribution">
          {stats.filter((item) => item.value > 0).map((item) => <span key={item.key} title={`${item.label}: ${item.value}`} className={`${item.color} h-full transition-all`} style={{ width: `${Math.max((item.value / Math.max(totalStatCount, summary?.totalEmployees || 1)) * 100, 1)}%` }} />)}
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[0_8px_24px_rgba(15,23,42,.045)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="min-w-0 font-['Poppins',sans-serif] text-[18px] font-semibold tracking-[-.2px] text-slate-900">Attendance automation</h2>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${automation?.isHealthy ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            <AutomationStatusIcon size={14} />{automation?.isHealthy ? "Healthy" : automation ? "Needs attention" : "Not run"}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-600">Last run {automation?.lastRunAt ? formatRelativeRun(automation.lastRunAt, today) : "not recorded"} <span className="text-slate-500">·</span> Next run {getNextRunLabel()}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <RulePill icon={Clock3}>Grace {data?.settings?.graceMinutes ?? 15} min</RulePill>
          <RulePill icon={CalendarDays}>Weekend {formatWeekends(data?.settings?.weekendDays)}</RulePill>
          <RulePill icon={MapPin}>Radius {data?.settings?.radiusMeters ?? 100} m</RulePill>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setRunOpen(true)} disabled={running || loading} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(90deg,#6A0DAD_0%,#7C3AED_100%)] px-4 font-['Poppins',sans-serif] text-[15px] font-semibold text-white shadow-[0_6px_16px_rgba(106,13,173,.2)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:opacity-60">
            {running ? <LoaderCircle size={16} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
            Run now
          </button>
          <button type="button" onClick={() => setLogOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600"><History size={16} />View log</button>
          <button type="button" onClick={() => onNavigate?.("Office settings")} className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold text-violet-800 transition hover:bg-violet-50 hover:text-violet-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600"><SlidersHorizontal size={16} />Edit rules</button>
        </div>
      </section>
    </div>

    <div className="grid min-w-0 gap-4 min-[1366px]:grid-cols-[minmax(0,1.78fr)_minmax(270px,.82fr)]">
      <section className="@container/attendance-log min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,.045)]">
        <div className="flex flex-col gap-2.5 border-b border-slate-100 px-4 py-3 @min-[820px]/attendance-log:flex-row @min-[820px]/attendance-log:items-center @min-[820px]/attendance-log:justify-between sm:px-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-['Poppins',sans-serif] text-[18px] font-semibold tracking-[-.2px] text-slate-900">Daily log</h2>
            <p className="text-right text-xs text-slate-600 sm:text-left">Open a row for times and record source</p>
          </div>
          <div className="grid min-w-0 gap-1.5 @min-[460px]/attendance-log:grid-cols-2 @min-[820px]/attendance-log:grid-cols-3 @min-[820px]/attendance-log:flex-1">
            <label className="relative min-w-0 @min-[460px]/attendance-log:col-span-2 @min-[820px]/attendance-log:col-span-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-violet-800" />
              <input value={search} onChange={(event) => setFilter(setSearch)(event.target.value)} placeholder="Search employee" className="h-11 w-full rounded-xl border border-slate-400 bg-[#FBFAFF] pl-9 pr-3 text-[16px] text-slate-800 outline-none transition placeholder:text-slate-500 focus:border-violet-600 focus:bg-white focus:ring-4 focus:ring-violet-500/15 sm:text-[14px]" />
            </label>
            <select aria-label="Filter by department" value={department} onChange={(event) => setFilter(setDepartment)(event.target.value)} className="h-11 min-w-0 w-full rounded-xl border border-slate-400 bg-[#FBFAFF] px-3 text-[16px] text-slate-800 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-500/15 sm:text-[14px]">
              <option value="">Department: All</option>
              {(data?.departments || []).map((item) => <option key={item} value={item}>Department: {item}</option>)}
            </select>
            <select aria-label="Filter by attendance status" value={status} onChange={(event) => setFilter(setStatus)(event.target.value)} className="h-11 min-w-0 w-full rounded-xl border border-slate-400 bg-[#FBFAFF] px-3 text-[16px] text-slate-800 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-500/15 sm:text-[14px]">
              <option value="">Status: All</option>
              {Object.keys(statusStyles).map((item) => <option key={item} value={item}>Status: {statusLabel(item)}</option>)}
            </select>
          </div>
        </div>

        <div className="px-3 pb-2 sm:px-4">
          {loading && !data ? <LoadingRows /> : data?.rows?.length ? <>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 @min-[820px]/attendance-log:hidden">
              {data.rows.map((row) => <AttendanceMobileCard key={row.employee.id} row={row} onCorrect={() => openCorrection(row)} />)}
            </div>
            <div className="hidden overflow-x-auto @min-[820px]/attendance-log:block">
              <table className="w-full min-w-[700px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="whitespace-nowrap border-b border-slate-200 bg-violet-50/60 text-xs font-semibold text-slate-700">
                    <th className="px-1.5 py-2.5">Employee</th>
                    <th className="px-1.5 py-2.5">Check in</th>
                    <th className="px-1.5 py-2.5">Check out</th>
                    <th className="px-1.5 py-2.5">Worked</th>
                    <th className="px-1.5 py-2.5">Status</th>
                    <th className="px-1.5 py-2.5">Recorded by</th>
                    <th className="w-16 px-1.5 py-2.5 text-right" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => <tr key={row.employee.id} className="group border-t border-slate-100 hover:bg-violet-50/30">
                    <td className="border-t border-slate-100 px-2 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-100 font-['Poppins',sans-serif] text-xs font-semibold text-violet-800">{initials(row.employee.name)}</span>
                        <div className="min-w-0"><p className="truncate text-[13px] font-semibold text-slate-800">{row.employee.name}</p><p className="truncate text-xs text-slate-600">{row.department}</p></div>
                      </div>
                    </td>
                    <td className="border-t border-slate-100 px-2 py-2.5 text-[13px] text-slate-700">{formatTime(row.checkIn)}</td>
                    <td className="border-t border-slate-100 px-2 py-2.5 text-[13px] text-slate-700">{row.missingCheckOut ? <span className="text-amber-700">Missing</span> : formatTime(row.checkOut)}</td>
                    <td className="border-t border-slate-100 px-2 py-2.5 text-[13px] text-slate-700">{row.status === "leave" ? row.leaveType || "Approved leave" : <>{formatDuration(row.workedMinutes)}{row.leaveDays > 0 && <span className="block text-violet-800">{row.leaveDays} leave day{row.leaveDays === 1 ? "" : "s"}{row.leavePeriod ? ` · ${row.leavePeriod}` : ""}</span>}</>}</td>
                    <td className="border-t border-slate-100 px-1.5 py-[7px]"><StatusBadge status={row.status} /></td>
                    <td className="border-t border-slate-100 px-1.5 py-[7px]"><RecordedBy source={row.source} /></td>
                    <td className="border-t border-slate-100 px-2 py-2.5 text-right">{row.missingCheckOut && row.attendanceId && <button type="button" onClick={() => openCorrection(row)} className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-800 transition hover:bg-violet-100">Fix</button>}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </> : error && !data ? <div className="grid min-h-32 place-items-center px-4 text-center" role="alert">
            <div>
              <p className="text-[13px] font-semibold text-slate-800">Attendance could not be loaded</p>
              <p className="mt-1 text-xs text-slate-600">{error}</p>
              <button type="button" onClick={() => { setLoading(true); setRefreshKey((key) => key + 1); }} className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 transition hover:bg-violet-100">Try again</button>
            </div>
          </div> : data?.summary?.totalEmployees === 0 ? <EmptyState title="No eligible employees for this date" description="An active employee account with approved onboarding is required to show attendance." /> : <EmptyState title="No attendance records found" description="Try a different date or clear the selected filters." />}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 py-2.5">
            <p className="text-xs text-slate-600">{showingRows(data?.pagination)}</p>
            {data?.pagination?.pages > 1 && <div className="flex items-center gap-1">
              <button type="button" disabled={page <= 1 || loading} onClick={() => changePage(setLoading, setPage, page - 1)} className="grid size-9 place-items-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-violet-50 hover:text-violet-800 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={16} /></button>
              {Array.from({ length: Math.min(3, data.pagination.pages) }, (_, index) => {
                const pageNumber = Math.max(1, Math.min(page - 1, data.pagination.pages - 2)) + index;
                return <button type="button" key={pageNumber} onClick={() => changePage(setLoading, setPage, pageNumber)} className={`grid size-9 place-items-center rounded-lg border text-xs font-semibold transition ${pageNumber === page ? "border-violet-300 bg-violet-100 text-violet-800" : "border-slate-300 text-slate-700 hover:bg-violet-50 hover:text-violet-800"}`}>{pageNumber}</button>;
              })}
              <button type="button" disabled={page >= data.pagination.pages || loading} onClick={() => changePage(setLoading, setPage, page + 1)} className="grid size-9 place-items-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-violet-50 hover:text-violet-800 disabled:opacity-40" aria-label="Next page"><ChevronRight size={16} /></button>
            </div>}
          </div>
        </div>
      </section>

      <aside className="grid min-w-0 content-start gap-3.5 lg:grid-cols-2 min-[1366px]:!grid-cols-1">
        <section className="min-w-0 rounded-[18px] border border-slate-200/80 bg-white p-3.5 shadow-[0_5px_18px_rgba(15,23,42,.035)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700"><Clock3 size={17} /></span><h2 className="min-w-0 font-['Poppins',sans-serif] text-[18px] font-semibold tracking-[-.2px] text-slate-900">Missing check-outs</h2></div>
            <span className="shrink-0 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{summary?.openMissingCheckOutCount ?? 0} to review</span>
          </div>
          <div className="mt-3 flex rounded-[10px] border border-slate-100 bg-slate-50 p-1">
            <button type="button" onClick={() => setMissingTab("yesterday")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${missingTab === "yesterday" ? "bg-white text-violet-800 shadow-sm" : "text-slate-600 hover:text-violet-800"}`}>Yesterday · {summary?.yesterdayMissingCheckOutCount ?? 0}</button>
            <button type="button" onClick={() => setMissingTab("older")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${missingTab === "older" ? "bg-white text-violet-800 shadow-sm" : "text-slate-600 hover:text-violet-800"}`}>Older · {summary?.olderMissingCheckOutCount ?? 0}</button>
          </div>
          <div className="mt-1.5">
            {missingRows.length ? missingRows.slice(0, 5).map((item) => <div key={item.attendanceId} className="flex items-center gap-2 border-b border-slate-100 py-2 last:border-0">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-100 font-['Poppins',sans-serif] text-xs font-semibold text-violet-800">{initials(item.employee?.name)}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-slate-800">{item.employee?.name || "Employee"}</p><p className="truncate text-xs text-slate-600">{formatShortDate(item.date)} · In {formatTime(item.checkIn)} · No check-out</p></div>
              <button type="button" onClick={() => openCorrection({ attendanceId: item.attendanceId, employee: item.employee, date: item.date, checkIn: item.checkIn })} disabled={item.date >= today} className="shrink-0 rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 transition hover:bg-violet-100 disabled:opacity-40">Fix</button>
            </div>) : <p className="px-2 py-5 text-center text-[13px] text-slate-600">No missing check-outs in this group.</p>}
          </div>
        </section>

        <section className="min-w-0 rounded-[18px] border border-slate-200/80 bg-white p-3.5 shadow-[0_5px_18px_rgba(15,23,42,.035)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-800"><Shield size={17} /></span><h2 className="min-w-0 font-['Poppins',sans-serif] text-[18px] font-semibold tracking-[-.2px] text-slate-900">Automation &amp; corrections</h2></div>
            <button type="button" onClick={() => setLogOpen(true)} className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold text-violet-800 transition hover:bg-violet-50 hover:text-violet-950">View audit trail</button>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {data?.activities?.length ? activityPreview(data.activities).map((activity) => <ActivityRow key={activity.id} activity={activity} />) : <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-[13px] text-slate-600">No corrections or automation runs recorded for this period.</p>}
          </div>
        </section>
      </aside>
    </div>

    {runOpen && <Modal title="Run attendance automation" icon={<RefreshCw size={16} />} onClose={() => !running && setRunOpen(false)}>
      <p className="text-[14px] leading-[1.5] text-slate-600">Run now closes attendance for eligible employees on completed dates the system has not processed yet. It only works through <b className="text-slate-800">{formatShortDate(shiftDate(today, -1))}</b>—never today or future dates.</p>
      <p className="mt-3 rounded-xl bg-violet-50 px-3 py-3 text-[13px] leading-[1.5] text-violet-800">For a weekday without an attendance record, it creates a system status such as Absent, Leave, or Holiday. Existing check-ins, check-outs, and admin corrections are kept. If everything through yesterday is already closed, nothing changes and you will see an “up to date” message. Backlogs are processed up to 31 calendar days per run; run it again to continue.</p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => setRunOpen(false)} className="h-10 rounded-lg border border-slate-300 px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button>
        <button type="button" onClick={runAutomation} disabled={running} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[linear-gradient(90deg,#6A0DAD_0%,#7C3AED_100%)] px-4 font-['Poppins',sans-serif] text-[15px] font-semibold text-white transition hover:brightness-105 disabled:opacity-60">{running ? <LoaderCircle size={16} className="animate-spin" /> : <Play size={14} fill="currentColor" />}{running ? "Running..." : "Run now"}</button>
      </div>
    </Modal>}

    {correction && <Modal title="Fix missing check-out" icon={<Clock3 size={16} />} onClose={() => !savingCorrection && setCorrection(null)}>
      <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2.5">
        <p className="text-[14px] font-semibold text-slate-800">{correction.employee?.name || correction.employee?.email || "Employee"}</p>
        <p className="mt-0.5 text-[13px] text-slate-600">{formatShortDate(correction.date || date)} · checked in {formatTime(correction.checkIn)}</p>
      </div>
      <form onSubmit={saveCorrection} className="space-y-3">
        <label className="block text-[14px] font-semibold text-slate-700">Correct check-out time<input required type="time" value={checkoutTime} onChange={(event) => setCheckoutTime(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-400 bg-[#FBFAFF] px-3 text-[16px] font-normal text-slate-800 outline-none transition focus:border-violet-600 focus:bg-white focus:ring-4 focus:ring-violet-500/15 sm:text-[14px]" /></label>
        <label className="block text-[14px] font-semibold text-slate-700">Reason<select value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-400 bg-[#FBFAFF] px-3 text-[16px] font-normal text-slate-800 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-500/15 sm:text-[14px]">{correctionReasons.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="block text-[14px] font-semibold text-slate-700">Admin note <span className="font-normal text-slate-500">(optional)</span><textarea maxLength={500} rows={3} value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} placeholder="Add context for the audit record" className="mt-1.5 w-full resize-y rounded-lg border border-slate-400 bg-[#FBFAFF] px-3 py-2 text-[16px] font-normal text-slate-800 outline-none placeholder:text-slate-500 focus:border-violet-600 focus:bg-white focus:ring-4 focus:ring-violet-500/15 sm:text-[14px]" /></label>
        <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] leading-[1.5] text-amber-800">The original record, reason, note, administrator, and correction time are saved to the audit trail. The employee is not notified automatically.</p>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><button type="button" onClick={() => setCorrection(null)} disabled={savingCorrection} className="h-10 rounded-lg border border-slate-300 px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={savingCorrection || !checkoutTime} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[linear-gradient(90deg,#6A0DAD_0%,#7C3AED_100%)] px-4 font-['Poppins',sans-serif] text-[15px] font-semibold text-white transition hover:brightness-105 disabled:opacity-60">{savingCorrection ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}{savingCorrection ? "Saving..." : "Save correction"}</button></div>
      </form>
    </Modal>}

    {logOpen && <Modal title="Attendance activity log" icon={<History size={16} />} onClose={() => setLogOpen(false)}>
      <p className="mb-3 text-[13px] text-slate-600">Recorded attendance corrections and daily automation activity.</p>
      <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
        {data?.activities?.length ? data.activities.map((activity) => <ActivityRow key={activity.id} activity={activity} detailed />) : <EmptyState title="No activity yet" description="Attendance corrections and automation runs will appear here." />}
      </div>
      <div className="mt-4 flex justify-end"><button type="button" onClick={() => setLogOpen(false)} className="h-10 rounded-lg border border-slate-300 px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50">Close</button></div>
    </Modal>}
  </main>;
}

function RulePill({ icon: Icon, children }) {
  return <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700"><Icon size={14} className="text-violet-800" />{children}</span>;
}

function AttendanceMobileCard({ row, onCorrect }) {
  const [expanded, setExpanded] = useState(false);
  const hasAttendanceDetails = Boolean(row.checkIn || row.checkOut || row.missingCheckOut || row.status === "leave" || row.leaveDays > 0 || (row.workedMinutes !== null && row.workedMinutes !== undefined));
  const hasFooterContent = row.source || (row.missingCheckOut && row.attendanceId);
  const detailsId = `attendance-row-${row.employee.id}`;
  const compactSummary = row.missingCheckOut
    ? "Checkout missing"
    : row.checkIn
      ? `In ${formatTime(row.checkIn)}`
      : row.status === "leave"
        ? row.leaveType
        : "";

  return <article className="px-2">
    <button type="button" aria-expanded={expanded} aria-controls={detailsId} aria-label={`${expanded ? "Hide" : "Show"} attendance details for ${row.employee.name}`} onClick={() => setExpanded((value) => !value)} className="flex min-h-12 w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-violet-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-100 font-['Poppins',sans-serif] text-xs font-semibold text-violet-800">{initials(row.employee.name)}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-slate-800">{row.employee.name}</span><span className="block truncate text-xs text-slate-600">{row.department}</span></span>
      {compactSummary && <span className="hidden max-w-24 shrink-0 truncate text-xs text-slate-600 @min-[540px]/attendance-log:inline">{compactSummary}</span>}
      <StatusBadge status={row.status} />
      <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
    </button>
    <div id={detailsId} hidden={!expanded} className="border-t border-slate-100 px-1 pb-2 pt-2">
      {hasAttendanceDetails ? <div className="grid grid-cols-3 gap-2">
        <MiniField label="Check in" value={formatTime(row.checkIn)} />
        <MiniField label="Check out" value={row.missingCheckOut ? "Missing" : formatTime(row.checkOut)} />
        <MiniField label={row.leaveDays > 0 ? `${row.leaveDays}d leave` : "Worked"} value={row.status === "leave" ? row.leaveType || "Leave" : formatDuration(row.workedMinutes)} />
      </div> : <p className="text-xs text-slate-600">No time entry recorded for this date.</p>}
      {hasFooterContent && <div className="mt-2 flex items-center justify-between"><RecordedBy source={row.source} />{row.missingCheckOut && row.attendanceId && <button type="button" onClick={onCorrect} className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 transition hover:bg-violet-100">Fix check-out</button>}</div>}
    </div>
  </article>;
}

function MiniField({ label, value }) {
  return <div><p className="text-xs text-slate-600">{label}</p><p className="mt-0.5 truncate text-[13px] font-medium text-slate-800">{value}</p></div>;
}

function StatusBadge({ status }) {
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[status] || statusStyles.pending}`}>{statusLabel(status)}</span>;
}

function RecordedBy({ source }) {
  const item = {
    self: { label: "Employee", icon: UserRound, color: "text-slate-500" },
    admin: { label: "Admin", icon: Shield, color: "text-violet-700" },
    system: { label: "Automation", icon: Zap, color: "text-green-700" },
  }[source];
  if (!item) return <span className="text-xs text-slate-500">—</span>;
  const Icon = item.icon;
  return <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${item.color}`}><Icon size={14} />{item.label}</span>;
}

function activityPreview(activities) {
  let hasUpToDateRun = false;
  return activities.filter((activity) => {
    const message = activity.message?.toLowerCase() || "";
    const isUpToDateRun = activity.type === "automation"
      && activity.status === "no_op"
      && (message.includes("already closed through") || message === "no closed days to process");
    if (!isUpToDateRun) return true;
    if (hasUpToDateRun) return false;
    hasUpToDateRun = true;
    return true;
  }).slice(0, 3);
}

function ActivityRow({ activity, detailed = false }) {
  const isAutomation = activity.type === "automation";
  const failed = isAutomation && activity.status === "failed";
  const noOpMessage = activity.message?.toLowerCase() || "";
  const title = isAutomation
    ? failed
      ? "Attendance automation failed"
      : activity.status === "no_op"
        ? noOpMessage.includes("running")
          ? "Another attendance close is already running"
          : noOpMessage.includes("closed through") || noOpMessage === "no closed days to process"
            ? "Attendance is already up to date; no records changed"
            : "Attendance automation did not run; no records changed"
        : `Automation processed ${activity.processedRows || 0} attendance records`
    : `${activity.actor} set ${activity.employee}’s check-out to ${formatTime(activity.correctedCheckOut)}`;
  const subtitle = isAutomation
    ? `${activity.fromDate && activity.fromDate !== activity.date ? `${formatShortDate(activity.fromDate)}–` : ""}${formatShortDate(activity.date)} · ${activity.actor}`
    : `${formatShortDate(activity.date)} · ${capitalize(activity.reason.replaceAll("_", " "))}${activity.note ? ` · ${activity.note}` : ""}`;
  return <div className={`flex items-start gap-2 border-b border-slate-100 py-2 last:border-0 ${detailed ? "px-1" : ""}`}>
    <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${isAutomation ? "bg-green-50 text-green-700" : "bg-violet-100 text-violet-800"}`}>{isAutomation ? <Zap size={15} /> : <Shield size={15} />}</span>
    <div className="min-w-0 flex-1"><p className="text-[13px] font-medium leading-[1.4] text-slate-800">{title}</p><p className="mt-0.5 text-xs leading-[1.4] text-slate-600">{subtitle}</p></div>
    <time className="shrink-0 pt-0.5 text-xs text-slate-600">{formatClock(activity.createdAt)}</time>
  </div>;
}

function Modal({ title, icon, onClose, children }) {
  return <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/40 p-3 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="my-auto w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,.22)] sm:p-6">
      <div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-100 text-violet-800">{icon}</span><h2 className="flex-1 font-['Poppins',sans-serif] text-xl font-semibold text-slate-900">{title}</h2><button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-lg text-slate-600 transition hover:bg-violet-50 hover:text-violet-800" aria-label="Close dialog"><X size={18} /></button></div>
      {children}
    </section>
  </div>;
}

function LoadingRows() {
  return <div className="space-y-2 py-2">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-100" />)}</div>;
}

function EmptyState({ title, description }) {
  return <div className="grid min-h-32 place-items-center px-4 text-center"><div><span className="mx-auto grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-800"><CalendarDays size={18} /></span><p className="mt-2.5 text-[13px] font-semibold text-slate-800">{title}</p><p className="mt-1 text-xs text-slate-600">{description}</p></div></div>;
}

function getKarachiToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function shiftDate(value, days) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatShortDate(value) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Karachi" }).format(new Date(value));
}

function formatClock(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Karachi" }).format(new Date(value));
}

function formatRelativeRun(value, today) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  const time = formatClock(value);
  return date === today ? `today ${time}` : `${formatShortDate(date)} ${time}`;
}

function getNextRunLabel() {
  const now = new Date();
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  const date = getKarachiToday();
  const nextDate = time >= "00:10" ? shiftDate(date, 1) : date;
  return `${formatShortDate(nextDate)} · 00:10`;
}

function formatWeekends(days = [0, 6]) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
  return [...days].sort((first, second) => weekdayOrder.indexOf(first) - weekdayOrder.indexOf(second)).map((day) => names[day]).join(", ") || "None";
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return "—";
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours ? `${hours}h ${String(remaining).padStart(2, "0")}m` : `${remaining}m`;
}

function statusLabel(status) {
  if (status === "pending") return "Not checked in";
  if (status === "weekend") return "Weekend";
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Not checked in";
}

function showingRows(pagination) {
  if (!pagination?.total) return "Showing 0 employees";
  const start = (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(start + pagination.limit - 1, pagination.total);
  return `Showing ${start}–${end} of ${pagination.total} employees`;
}

function changePage(setLoading, setPage, nextPage) {
  setLoading(true);
  setPage(nextPage);
}

function initials(name = "") {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "E";
}

function capitalize(value = "") {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}
