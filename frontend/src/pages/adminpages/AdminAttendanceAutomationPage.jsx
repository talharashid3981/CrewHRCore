import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  CalendarDays,
  CheckCircle2,
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
  present: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  late: "bg-amber-50 text-amber-800 ring-amber-200",
  absent: "bg-rose-50 text-rose-700 ring-rose-200",
  leave: "bg-violet-50 text-violet-700 ring-violet-200",
  holiday: "bg-sky-50 text-sky-700 ring-sky-200",
  weekend: "bg-slate-100 text-slate-600 ring-slate-200",
  pending: "bg-slate-100 text-slate-600 ring-slate-200",
};

const correctionReasons = [
  ["employee_forgot", "Employee forgot to check out"],
  ["technical_issue", "Technical issue"],
  ["manual_adjustment", "Manual adjustment"],
];

export default function AdminAttendanceAutomationPage({ user, pendingCount = 0, onNavigate }) {
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
    notice.toLowerCase().includes("up to date") ? "info" : "success",
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
      setNotice(run.skipped
        ? run.message || "Automation is already up to date."
        : `Daily close completed for ${formatShortDate(run.from)}${run.to && run.to !== run.from ? `–${formatShortDate(run.to)}` : ""}.`);
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
    { key: "present", label: "Present", value: summary?.present || 0, color: "bg-emerald-500" },
    { key: "late", label: "Late", value: summary?.late || 0, color: "bg-amber-500" },
    { key: "notCheckedIn", label: "Not checked in", value: summary?.notCheckedIn || 0, color: "bg-slate-300" },
    { key: "leave", label: "On leave", value: summary?.leave || 0, color: "bg-violet-500" },
  ];
  const totalStatCount = stats.reduce((total, item) => total + item.value, 0);
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Admin";
  const automation = data?.automation;
  const AutomationStatusIcon = automation?.isHealthy ? CheckCircle2 : AlertCircle;

  return <main className="w-full min-w-0 font-sans text-slate-800">
    <header className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
      <div className="min-w-0">
        <h1 className="font-['Poppins',sans-serif] text-[24px] font-semibold leading-tight tracking-[-.45px] text-slate-900">Attendance</h1>
        <p className="mt-1 text-[11px] text-slate-500">Monitor the day, fix missing check-outs and run automation.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 items-center rounded-xl border border-slate-200 bg-white p-1 shadow-[0_2px_8px_rgba(15,23,42,.035)]">
          <button type="button" onClick={() => moveDate(-1)} aria-label="Previous day" className="grid size-7 place-items-center rounded-lg text-slate-500 transition hover:bg-violet-50 hover:text-violet-700"><ChevronLeft size={15} /></button>
          <label className="flex min-w-0 items-center gap-1.5 px-1">
            <CalendarDays size={13} className="shrink-0 text-violet-600" />
            <input aria-label="Attendance date" className="w-[116px] border-0 bg-transparent p-0 text-[10px] font-semibold text-slate-700 outline-none" type="date" max={today} value={date} onChange={(event) => selectDate(event.target.value)} />
          </label>
          <button type="button" onClick={() => moveDate(1)} disabled={date >= today} aria-label="Next day" className="grid size-7 place-items-center rounded-lg text-slate-500 transition hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight size={15} /></button>
        </div>
        <button type="button" onClick={downloadCsv} disabled={exporting || loading} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,.035)] transition hover:border-violet-200 hover:text-violet-700 disabled:opacity-60">
          {exporting ? <LoaderCircle size={13} className="animate-spin text-violet-600" /> : <Download size={13} className="text-violet-600" />}
          Export
        </button>
        <button type="button" onClick={() => onNavigate?.(pendingCount ? "Leaves" : "Overview")} aria-label={pendingCount ? `View ${pendingCount} pending notifications` : "View notifications and alerts"} className="relative grid size-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-[0_2px_8px_rgba(15,23,42,.035)] hover:text-violet-700">
          <Bell size={14} />
          {pendingCount > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-white" />}
        </button>
        <div className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 shadow-[0_2px_8px_rgba(15,23,42,.035)]">
          <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 font-['Poppins',sans-serif] text-[9px] font-semibold text-white">{initials(user?.name)}</span>
          <span className="max-w-20 truncate text-[10px] font-semibold text-slate-700">{firstName}</span>
        </div>
      </div>
    </header>

    <div className="mb-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.98fr)]">
      <section className="min-w-0 rounded-[18px] border border-slate-200/80 bg-white px-4 py-3.5 shadow-[0_5px_18px_rgba(15,23,42,.035)] sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-['Poppins',sans-serif] text-[13px] font-semibold text-slate-900">{date === today ? "Today" : formatShortDate(date)}</h2>
          <p className="text-right text-[9px] text-slate-500">{summary?.totalEmployees ?? "—"} active employees <span className="text-slate-300">·</span> {summary?.updatedAt ? `updated ${formatClock(summary.updatedAt)}` : "no attendance updates"}</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-2">
          {stats.map((item) => <div key={item.key} className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[9px] text-slate-500"><i className={`size-1.5 shrink-0 rounded-full ${item.color}`} />{item.label}</p>
            <p className="mt-1 font-['Poppins',sans-serif] text-[23px] font-semibold leading-none tracking-[-.7px] text-slate-900">{loading && !summary ? "—" : item.value}</p>
          </div>)}
        </div>
        <div className="mt-3 flex h-[7px] overflow-hidden rounded-full bg-slate-100" aria-label="Daily attendance distribution">
          {stats.filter((item) => item.value > 0).map((item) => <span key={item.key} title={`${item.label}: ${item.value}`} className={`${item.color} h-full transition-all`} style={{ width: `${Math.max((item.value / Math.max(totalStatCount, summary?.totalEmployees || 1)) * 100, 1)}%` }} />)}
        </div>
      </section>

      <section className="min-w-0 rounded-[18px] border border-slate-200/80 bg-white px-4 py-3.5 shadow-[0_5px_18px_rgba(15,23,42,.035)] sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-['Poppins',sans-serif] text-[13px] font-semibold text-slate-900">Attendance automation</h2>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold ${automation?.isHealthy ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            <AutomationStatusIcon size={10} />{automation?.isHealthy ? "Healthy" : automation ? "Needs attention" : "Not run"}
          </span>
        </div>
        <p className="mt-1.5 text-[9px] text-slate-500">Last run {automation?.lastRunAt ? formatRelativeRun(automation.lastRunAt, today) : "not recorded"} <span className="text-slate-300">·</span> Next run {getNextRunLabel()}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <RulePill icon={Clock3}>Grace {data?.settings?.graceMinutes ?? 15} min</RulePill>
          <RulePill icon={CalendarDays}>Weekend {formatWeekends(data?.settings?.weekendDays)}</RulePill>
          <RulePill icon={MapPin}>Radius {data?.settings?.radiusMeters ?? 100} m</RulePill>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setRunOpen(true)} disabled={running || loading} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#7315bd] to-[#8439ec] px-3 text-[10px] font-semibold text-white shadow-[0_5px_12px_rgba(112,22,185,.2)] transition hover:brightness-105 disabled:opacity-60">
            {running ? <LoaderCircle size={12} className="animate-spin" /> : <Play size={11} fill="currentColor" />}
            Run now
          </button>
          <button type="button" onClick={() => setLogOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700"><History size={12} />View log</button>
          <button type="button" onClick={() => onNavigate?.("Office settings")} className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-1.5 text-[9px] font-semibold text-violet-700 hover:bg-violet-50"><SlidersHorizontal size={12} />Edit rules</button>
        </div>
      </section>
    </div>

    <div className="grid min-w-0 gap-4 min-[1200px]:grid-cols-[minmax(0,1.78fr)_minmax(270px,.82fr)]">
      <section className="min-w-0 overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_5px_18px_rgba(15,23,42,.035)]">
        <div className="flex flex-col gap-2.5 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-['Poppins',sans-serif] text-[13px] font-semibold text-slate-900">Daily log</h2>
            <p className="text-right text-[9px] text-slate-500 sm:text-left">Recorded by shows who created each record</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <label className="relative min-w-[145px] flex-1 sm:w-[170px] sm:flex-none">
              <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-violet-500" />
              <input value={search} onChange={(event) => setFilter(setSearch)(event.target.value)} placeholder="Search employee" className="h-[32px] w-full rounded-[10px] border border-slate-200 bg-white pl-7 pr-2 text-[10px] outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
            </label>
            <select aria-label="Filter by department" value={department} onChange={(event) => setFilter(setDepartment)(event.target.value)} className="h-[32px] max-w-[130px] rounded-[10px] border border-slate-200 bg-white px-2 text-[10px] text-slate-600 outline-none focus:border-violet-400">
              <option value="">Department: All</option>
              {(data?.departments || []).map((item) => <option key={item} value={item}>Department: {item}</option>)}
            </select>
            <select aria-label="Filter by attendance status" value={status} onChange={(event) => setFilter(setStatus)(event.target.value)} className="h-[32px] rounded-[10px] border border-slate-200 bg-white px-2 text-[10px] text-slate-600 outline-none focus:border-violet-400">
              <option value="">Status: All</option>
              {Object.keys(statusStyles).map((item) => <option key={item} value={item}>Status: {statusLabel(item)}</option>)}
            </select>
          </div>
        </div>

        <div className="px-3 pb-2 sm:px-4">
          {loading && !data ? <LoadingRows /> : data?.rows?.length ? <>
            <div className="space-y-2 py-2 min-[1200px]:hidden">
              {data.rows.map((row) => <AttendanceMobileCard key={row.employee.id} row={row} onCorrect={() => openCorrection(row)} />)}
            </div>
            <div className="hidden overflow-x-auto min-[1200px]:block">
              <table className="w-full min-w-[630px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-[9px] font-semibold text-slate-400">
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
                    <td className="border-t border-slate-100 px-1.5 py-[7px]">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white ${avatarColor(row.employee.name)}`}>{initials(row.employee.name)}</span>
                        <div className="min-w-0"><p className="truncate text-[10px] font-semibold text-slate-800">{row.employee.name}</p><p className="truncate text-[9px] text-slate-400">{row.department}</p></div>
                      </div>
                    </td>
                    <td className="border-t border-slate-100 px-1.5 py-[7px] text-[10px] text-slate-600">{formatTime(row.checkIn)}</td>
                    <td className="border-t border-slate-100 px-1.5 py-[7px] text-[10px] text-slate-600">{row.missingCheckOut ? <span className="text-amber-700">Missing</span> : formatTime(row.checkOut)}</td>
                    <td className="border-t border-slate-100 px-1.5 py-[7px] text-[10px] text-slate-600">{row.status === "leave" ? row.leaveType || "Approved leave" : <>{formatDuration(row.workedMinutes)}{row.leaveDays > 0 && <span className="block text-violet-700">{row.leaveDays} leave day{row.leaveDays === 1 ? "" : "s"}{row.leavePeriod ? ` · ${row.leavePeriod}` : ""}</span>}</>}</td>
                    <td className="border-t border-slate-100 px-1.5 py-[7px]"><StatusBadge status={row.status} /></td>
                    <td className="border-t border-slate-100 px-1.5 py-[7px]"><RecordedBy source={row.source} /></td>
                    <td className="border-t border-slate-100 px-1.5 py-[7px] text-right">{row.missingCheckOut && row.attendanceId && <button type="button" onClick={() => openCorrection(row)} className="rounded-lg bg-violet-50 px-2 py-1 text-[9px] font-semibold text-violet-700 transition hover:bg-violet-100">Fix</button>}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </> : <EmptyState title="No attendance records found" description="Try a different date or clear the selected filters." />}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 py-2.5">
            <p className="text-[9px] text-slate-500">{showingRows(data?.pagination)}</p>
            {data?.pagination?.pages > 1 && <div className="flex items-center gap-1">
              <button type="button" disabled={page <= 1 || loading} onClick={() => changePage(setLoading, setPage, page - 1)} className="grid size-7 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={13} /></button>
              {Array.from({ length: Math.min(3, data.pagination.pages) }, (_, index) => {
                const pageNumber = Math.max(1, Math.min(page - 1, data.pagination.pages - 2)) + index;
                return <button type="button" key={pageNumber} onClick={() => changePage(setLoading, setPage, pageNumber)} className={`grid size-7 place-items-center rounded-lg text-[9px] font-semibold ${pageNumber === page ? "bg-gradient-to-r from-[#7315bd] to-[#8439ec] text-white shadow-sm" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{pageNumber}</button>;
              })}
              <button type="button" disabled={page >= data.pagination.pages || loading} onClick={() => changePage(setLoading, setPage, page + 1)} className="grid size-7 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40" aria-label="Next page"><ChevronRight size={13} /></button>
            </div>}
          </div>
        </div>
      </section>

      <aside className="grid min-w-0 content-start gap-3.5 lg:grid-cols-2 min-[1200px]:grid-cols-1">
        <section className="min-w-0 rounded-[18px] border border-slate-200/80 bg-white p-3.5 shadow-[0_5px_18px_rgba(15,23,42,.035)] lg:col-span-2 min-[1200px]:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5"><span className="grid size-7 place-items-center rounded-lg bg-rose-50 text-rose-600"><Clock3 size={14} /></span><h2 className="font-['Poppins',sans-serif] text-[12px] font-semibold text-slate-900">Missing check-outs</h2></div>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[9px] font-semibold text-rose-700">{summary?.openMissingCheckOutCount ?? 0} to review</span>
          </div>
          <div className="mt-3 flex rounded-[10px] border border-slate-100 bg-slate-50 p-1">
            <button type="button" onClick={() => setMissingTab("yesterday")} className={`flex-1 rounded-lg px-2 py-1.5 text-[9px] font-semibold transition ${missingTab === "yesterday" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>Yesterday · {summary?.yesterdayMissingCheckOutCount ?? 0}</button>
            <button type="button" onClick={() => setMissingTab("older")} className={`flex-1 rounded-lg px-2 py-1.5 text-[9px] font-semibold transition ${missingTab === "older" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>Older · {summary?.olderMissingCheckOutCount ?? 0}</button>
          </div>
          <div className="mt-1.5">
            {missingRows.length ? missingRows.slice(0, 5).map((item) => <div key={item.attendanceId} className="flex items-center gap-2 border-b border-slate-100 py-2 last:border-0">
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white ${avatarColor(item.employee?.name)}`}>{initials(item.employee?.name)}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-slate-800">{item.employee?.name || "Employee"}</p><p className="truncate text-[9px] text-slate-400">{formatShortDate(item.date)} · In {formatTime(item.checkIn)} · No check-out</p></div>
              <button type="button" onClick={() => openCorrection({ attendanceId: item.attendanceId, employee: item.employee, date: item.date, checkIn: item.checkIn })} disabled={item.date >= today} className="shrink-0 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[9px] font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-40">Fix</button>
            </div>) : <p className="px-2 py-5 text-center text-[10px] text-slate-500">No missing check-outs in this group.</p>}
          </div>
        </section>

        <section className="min-w-0 rounded-[18px] border border-slate-200/80 bg-white p-3.5 shadow-[0_5px_18px_rgba(15,23,42,.035)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5"><span className="grid size-7 place-items-center rounded-lg bg-violet-50 text-violet-700"><Shield size={14} /></span><h2 className="font-['Poppins',sans-serif] text-[12px] font-semibold text-slate-900">Recent corrections</h2></div>
            <button type="button" onClick={() => setLogOpen(true)} className="text-[9px] font-medium text-slate-500 hover:text-violet-700">Audit trail</button>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {data?.activities?.length ? data.activities.slice(0, 3).map((activity) => <ActivityRow key={activity.id} activity={activity} />) : <p className="rounded-lg bg-slate-50 px-2 py-4 text-center text-[10px] text-slate-500">No corrections or automation runs recorded for this period.</p>}
          </div>
        </section>
      </aside>
    </div>

    {runOpen && <Modal title="Run attendance automation" icon={<RefreshCw size={16} />} onClose={() => !running && setRunOpen(false)}>
      <p className="text-[11px] leading-5 text-slate-600">Run the daily close for unprocessed completed days through <b className="text-slate-800">{formatShortDate(shiftDate(today, -1))}</b>. It will not create records for today or future dates.</p>
      <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2.5 text-[10px] leading-4 text-violet-800">Existing employee check-ins, check-outs, and administrator corrections are preserved. Backlogs are processed in ranges of up to 31 days.</p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => setRunOpen(false)} className="h-8 rounded-lg border border-slate-200 px-4 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button type="button" onClick={runAutomation} disabled={running} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-violet-700 px-4 text-[10px] font-semibold text-white hover:bg-violet-800 disabled:opacity-60">{running ? <LoaderCircle size={13} className="animate-spin" /> : <Play size={11} fill="currentColor" />}{running ? "Running..." : "Run now"}</button>
      </div>
    </Modal>}

    {correction && <Modal title="Fix missing check-out" icon={<Clock3 size={16} />} onClose={() => !savingCorrection && setCorrection(null)}>
      <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2.5">
        <p className="text-[11px] font-semibold text-slate-800">{correction.employee?.name || correction.employee?.email || "Employee"}</p>
        <p className="mt-0.5 text-[10px] text-slate-500">{formatShortDate(correction.date || date)} · checked in {formatTime(correction.checkIn)}</p>
      </div>
      <form onSubmit={saveCorrection} className="space-y-3">
        <label className="block text-[10px] font-semibold text-slate-700">Correct check-out time<input required type="time" value={checkoutTime} onChange={(event) => setCheckoutTime(event.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-normal outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label>
        <label className="block text-[10px] font-semibold text-slate-700">Reason<select value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-normal outline-none focus:border-violet-400">{correctionReasons.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="block text-[10px] font-semibold text-slate-700">Admin note <span className="font-normal text-slate-400">(optional)</span><textarea maxLength={500} rows={2} value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} placeholder="Add context for the audit record" className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-normal outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[9px] leading-4 text-amber-900">The original record, reason, note, administrator, and correction time are saved to the audit trail. The employee is not notified automatically.</p>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><button type="button" onClick={() => setCorrection(null)} disabled={savingCorrection} className="h-8 rounded-lg border border-slate-200 px-4 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={savingCorrection || !checkoutTime} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-violet-700 px-4 text-[10px] font-semibold text-white hover:bg-violet-800 disabled:opacity-60">{savingCorrection ? <LoaderCircle size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}{savingCorrection ? "Saving..." : "Save correction"}</button></div>
      </form>
    </Modal>}

    {logOpen && <Modal title="Attendance activity log" icon={<History size={16} />} onClose={() => setLogOpen(false)}>
      <p className="mb-3 text-[10px] text-slate-500">Recorded attendance corrections and daily automation activity.</p>
      <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
        {data?.activities?.length ? data.activities.map((activity) => <ActivityRow key={activity.id} activity={activity} detailed />) : <EmptyState title="No activity yet" description="Attendance corrections and automation runs will appear here." />}
      </div>
      <div className="mt-4 flex justify-end"><button type="button" onClick={() => setLogOpen(false)} className="h-8 rounded-lg border border-slate-200 px-4 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Close</button></div>
    </Modal>}
  </main>;
}

function RulePill({ icon: Icon, children }) {
  return <span className="inline-flex h-[23px] items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2 text-[9px] text-slate-500"><Icon size={10} className="text-slate-500" />{children}</span>;
}

function AttendanceMobileCard({ row, onCorrect }) {
  return <article className="rounded-xl border border-slate-100 bg-white p-3">
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2"><span className={`grid size-7 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white ${avatarColor(row.employee.name)}`}>{initials(row.employee.name)}</span><div className="min-w-0"><p className="truncate text-[10px] font-semibold text-slate-800">{row.employee.name}</p><p className="truncate text-[9px] text-slate-400">{row.department}</p></div></div>
      <StatusBadge status={row.status} />
    </div>
    <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-slate-50 pt-2">
      <MiniField label="Check in" value={formatTime(row.checkIn)} />
      <MiniField label="Check out" value={row.missingCheckOut ? "Missing" : formatTime(row.checkOut)} />
      <MiniField label={row.leaveDays > 0 ? `${row.leaveDays}d leave` : "Worked"} value={row.status === "leave" ? row.leaveType || "Leave" : formatDuration(row.workedMinutes)} />
    </div>
    <div className="mt-2 flex items-center justify-between"><RecordedBy source={row.source} />{row.missingCheckOut && row.attendanceId && <button type="button" onClick={onCorrect} className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-[9px] font-semibold text-violet-700">Fix</button>}</div>
  </article>;
}

function MiniField({ label, value }) {
  return <div><p className="text-[8px] uppercase tracking-wide text-slate-400">{label}</p><p className="mt-0.5 truncate text-[9px] font-medium text-slate-700">{value}</p></div>;
}

function StatusBadge({ status }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-1 text-[9px] font-semibold ring-1 ring-inset ${statusStyles[status] || statusStyles.pending}`}>{statusLabel(status)}</span>;
}

function RecordedBy({ source }) {
  const item = {
    self: { label: "Employee", icon: UserRound, color: "text-slate-500" },
    admin: { label: "Admin", icon: Shield, color: "text-violet-700" },
    system: { label: "Automation", icon: Zap, color: "text-emerald-700" },
  }[source];
  if (!item) return <span className="text-[9px] text-slate-400">—</span>;
  const Icon = item.icon;
  return <span className={`inline-flex items-center gap-1 text-[9px] font-medium ${item.color}`}><Icon size={11} />{item.label}</span>;
}

function ActivityRow({ activity, detailed = false }) {
  const isAutomation = activity.type === "automation";
  const failed = isAutomation && activity.status === "failed";
  const title = isAutomation
    ? failed
      ? "Attendance automation failed"
      : activity.status === "no_op"
        ? "Automation found no completed days to process"
        : `Automation processed ${activity.processedRows || 0} attendance records`
    : `${activity.actor} set ${activity.employee}’s check-out to ${formatTime(activity.correctedCheckOut)}`;
  const subtitle = isAutomation
    ? `${activity.fromDate && activity.fromDate !== activity.date ? `${formatShortDate(activity.fromDate)}–` : ""}${formatShortDate(activity.date)} · ${activity.actor}`
    : `${formatShortDate(activity.date)} · ${capitalize(activity.reason.replaceAll("_", " "))}${activity.note ? ` · ${activity.note}` : ""}`;
  return <div className={`flex items-start gap-2 border-b border-slate-100 py-2 last:border-0 ${detailed ? "px-1" : ""}`}>
    <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg ${isAutomation ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700"}`}>{isAutomation ? <Zap size={12} /> : <Shield size={12} />}</span>
    <div className="min-w-0 flex-1"><p className="text-[9px] font-medium leading-4 text-slate-700">{title}</p><p className="mt-0.5 text-[8px] leading-3.5 text-slate-400">{subtitle}</p></div>
    <time className="shrink-0 pt-0.5 text-[8px] text-slate-400">{formatClock(activity.createdAt)}</time>
  </div>;
}

function Modal({ title, icon, onClose, children }) {
  return <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/40 p-3 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="my-auto w-full max-w-[440px] rounded-2xl border border-white/60 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,.22)] sm:p-6">
      <div className="mb-4 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-violet-50 text-violet-700">{icon}</span><h2 className="flex-1 font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">{title}</h2><button type="button" onClick={onClose} className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close dialog"><X size={15} /></button></div>
      {children}
    </section>
  </div>;
}

function LoadingRows() {
  return <div className="space-y-2 py-2">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-100" />)}</div>;
}

function EmptyState({ title, description }) {
  return <div className="grid min-h-32 place-items-center px-4 text-center"><div><span className="mx-auto grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-400"><CalendarDays size={16} /></span><p className="mt-2.5 text-[11px] font-semibold text-slate-700">{title}</p><p className="mt-1 text-[9px] text-slate-500">{description}</p></div></div>;
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

function avatarColor(value = "") {
  const colors = ["bg-emerald-600", "bg-sky-500", "bg-amber-500", "bg-pink-500", "bg-cyan-600", "bg-rose-600", "bg-violet-500"];
  const seed = value.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
  return colors[seed % colors.length];
}

function initials(name = "") {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "E";
}

function capitalize(value = "") {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}
