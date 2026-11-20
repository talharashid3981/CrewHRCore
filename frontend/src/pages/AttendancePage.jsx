import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  MapPin,
  RefreshCw,
} from "lucide-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  getAttendanceHistory,
  getAttendanceToday,
  getOfficeSettings,
} from "../api/auth.api";
import { useAuth } from "../context/AuthContext";
import TodayAttendanceCard from "../components/TodayAttendanceCard";
import { submitAttendanceAction } from "./attendanceAction";

dayjs.extend(utc);
dayjs.extend(timezone);

const zone = "Asia/Karachi";
const pageSize = 6;
const cardClass =
  "rounded-lg border border-[#EDF0F6] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.04)]";
const statusClass = {
  present: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  late: "bg-amber-50 text-amber-700 ring-amber-200",
  leave: "bg-violet-50 text-violet-700 ring-violet-200",
  absent: "bg-slate-100 text-slate-600 ring-slate-200",
  holiday: "bg-sky-50 text-sky-700 ring-sky-200",
  "missing-check-out": "bg-rose-50 text-rose-700 ring-rose-200",
};

const dateInput = (date) => dayjs(date).tz(zone).format("YYYY-MM-DD");
const timeValue = (value) => (value ? dayjs(value).tz(zone).format("HH:mm") : "--:--");
const minutesValue = (value) => {
  const minutes = Math.max(0, Math.floor(value || 0));
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
};
const dateValue = (value, format = "DD MMM YYYY") =>
  value ? dayjs(`${value}T12:00:00Z`).tz(zone).format(format) : "—";

export default function AttendancePage({ embedded = false }) {
  const { user, logout } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const currentDate = dateInput(now);
  const [today, setToday] = useState(null);
  const [office, setOffice] = useState(null);
  const [history, setHistory] = useState([]);
  const historyRequestId = useRef(0);
  const [from, setFrom] = useState(
    dayjs().tz(zone).startOf("month").format("YYYY-MM-DD"),
  );
  const [to, setTo] = useState(currentDate);
  const [preset, setPreset] = useState("thisMonth");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [permission, setPermission] = useState("checking");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [notice, setNotice] = useState("");

  const loadHistory = useCallback(async () => {
    const requestId = ++historyRequestId.current;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const data = await getAttendanceHistory({ from, to });
      if (requestId === historyRequestId.current) {
        setHistory(data.attendance || []);
      }
    } catch (requestError) {
      if (requestId === historyRequestId.current) {
        setHistoryError(
          requestError.response?.data?.message ||
            "Unable to load attendance history.",
        );
      }
    } finally {
      if (requestId === historyRequestId.current) setHistoryLoading(false);
    }
  }, [from, to]);

  const loadToday = useCallback(async () => {
    const data = await getAttendanceToday();
    setToday(data);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getAttendanceToday(), getOfficeSettings()])
      .then(([todayData, officeData]) => {
        if (!active) return;
        setToday(todayData);
        setOffice(officeData.settings || null);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load today's attendance.",
          );
        }
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadHistory();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadHistory]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!navigator.permissions?.query) {
      return undefined;
    }

    let active = true;
    let permissionStatus;
    const updatePermission = () => {
      if (active && permissionStatus) setPermission(permissionStatus.state);
    };

    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        permissionStatus = status;
        updatePermission();
        permissionStatus.addEventListener("change", updatePermission);
      })
      .catch(() => {
        if (active) setPermission("unavailable");
      });

    return () => {
      active = false;
      permissionStatus?.removeEventListener("change", updatePermission);
    };
  }, []);

  const filteredHistory = useMemo(
    () =>
      history.filter((record) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "missing-check-out") return record.missingCheckOut;
        return record.status === statusFilter;
      }),
    [history, statusFilter],
  );

  const counts = useMemo(() => {
    const present = history.filter((record) => record.status === "present").length;
    const late = history.filter((record) => record.status === "late").length;
    const leave = history.filter((record) => record.status === "leave").length;
    const halfDayLeaveDays = history.reduce(
      (total, record) => total + (record.leaveDays || 0),
      0,
    );
    const missingCheckOut = history.filter(
      (record) => record.missingCheckOut,
    ).length;
    const workingDays = history.filter((record) =>
      ["present", "late", "absent"].includes(record.status),
    ).length;
    const denominator =
      present + late + history.filter((record) => record.status === "absent").length;

    return {
      present,
      late,
      leave,
      halfDayLeaveDays,
      missingCheckOut,
      workingDays,
      attendancePercent: denominator
        ? Math.round(((present + late) / denominator) * 100)
        : 0,
    };
  }, [history]);

  const pageCount = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const pageRecords = filteredHistory.slice((page - 1) * pageSize, page * pageSize);
  const locationRecord = today?.record;
  const location =
    locationRecord?.checkOutLocation || locationRecord?.checkInLocation;
  const radiusMeters = office?.radiusMeters ?? 100;
  const distanceMeters = location?.distance;
  const locationVerified =
    Number.isFinite(distanceMeters) && distanceMeters <= radiusMeters;
  const workingDay = dayjs(now).tz(zone).day();
  const isWeekend = (office?.weekendDays || [0, 6]).includes(workingDay);
  const locationTitle = locationVerified
    ? "You are inside the office radius"
    : distanceMeters !== undefined
      ? "You are outside the office radius"
      : "Check in to verify your location";
  const permissionLabel =
    permission === "granted"
      ? "Allowed"
      : permission === "denied"
        ? "Blocked"
        : permission === "prompt"
          ? "Ask first"
          : permission === "checking" && navigator.permissions?.query
            ? "Checking"
            : "Unavailable";

  const setThisMonth = () => {
    setPage(1);
    setPreset("thisMonth");
    setFrom(dayjs().tz(zone).startOf("month").format("YYYY-MM-DD"));
    setTo(currentDate);
  };

  const setLastMonth = () => {
    const lastMonth = dayjs().tz(zone).subtract(1, "month");
    setPage(1);
    setPreset("lastMonth");
    setFrom(lastMonth.startOf("month").format("YYYY-MM-DD"));
    setTo(lastMonth.endOf("month").format("YYYY-MM-DD"));
  };

  const setCustomRange = (nextFrom, nextTo) => {
    setPage(1);
    setPreset("custom");
    if (nextFrom) setFrom(nextFrom);
    if (nextTo) setTo(nextTo);
  };

  const locateAndSubmit = async (action) => {
    if (!navigator.geolocation) {
      setError("Your browser does not support GPS location.");
      return;
    }

    setWorking(true);
    setError("");
    setHistoryError("");
    setNotice("");

    try {
      const result = await submitAttendanceAction(action);
      setNotice(result.message);
      await Promise.all([loadToday(), loadHistory()]);
    } catch (actionError) {
      setError(actionError.message || "Attendance action could not be completed.");
    } finally {
      setWorking(false);
    }
  };

  const signOut = async () => {
    await logout();
  };

  if (user?.role !== "employee") return <Navigate to="/admin/dashboard" replace />;

  const content = (
    <>
      {error && (
        <p
          className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700"
          role="status"
        >
          {notice}
        </p>
      )}

      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(280px,.9fr)] xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
        <TodayAttendanceCard
          attendance={today?.record}
          leave={today?.leave}
          date={today?.date}
          status={today?.record?.status || today?.status || "pending"}
          workedMinutes={
            today?.record?.date === currentDate &&
            today?.record?.checkIn &&
            !today?.record?.checkOut
              ? Math.max(
                  today?.record?.workedMinutes || 0,
                  dayjs(now).diff(dayjs(today.record.checkIn), "minute"),
                )
              : today?.record?.workedMinutes || 0
          }
          canCheckIn={Boolean(today?.state?.canCheckIn)}
          canCheckOut={Boolean(today?.state?.canCheckOut)}
          working={working}
          reason={today?.state?.reason || ""}
          onAction={(action) => {
            if (action === "in" || action === "out") void locateAndSubmit(action);
          }}
        />

        <section className={`${cardClass} min-w-0 p-4 sm:p-5`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">
              Location check
            </h2>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${
                locationVerified
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-slate-50 text-slate-500 ring-slate-200"
              }`}
            >
              {loading ? "Checking" : locationVerified ? "Verified" : "Pending"}
            </span>
          </div>

          <div
            className={`relative mt-3 flex min-h-[72px] items-center gap-3 overflow-hidden rounded-lg border px-3 py-3 ${
              locationVerified
                ? "border-emerald-200 bg-emerald-50"
                : "border-violet-100 bg-violet-50"
            }`}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-6 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full border border-violet-300/50"
            >
              <span className="absolute inset-3 rounded-full border border-violet-300/45" />
              <span className="absolute inset-6 rounded-full border border-violet-300/40" />
              <span className="absolute inset-9 rounded-full border border-dashed border-violet-400/45" />
              <span
                className={`absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_5px_rgba(124,58,237,0.12)] ${
                  locationVerified ? "bg-emerald-500" : "bg-violet-500"
                }`}
              />
            </div>
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-white shadow-sm ${
                locationVerified ? "bg-emerald-500" : "bg-violet-500"
              }`}
            >
              {locationVerified ? <Check size={18} /> : <Crosshair size={17} />}
            </span>
            <span className="relative z-10 min-w-0 pr-12">
              <strong
                className={`block text-[12px] font-semibold ${
                  locationVerified ? "text-emerald-800" : "text-violet-900"
                }`}
              >
                {locationTitle}
              </strong>
              <span className="mt-0.5 block text-[10px] text-slate-600">
                {distanceMeters !== undefined
                  ? `${Math.round(distanceMeters)} m from the office · ${radiusMeters} m allowed`
                  : office?.isConfigured
                    ? `${radiusMeters} m office radius · verified at check-in`
                    : "Office location has not been configured"}
              </span>
            </span>
          </div>

          <div className="mt-2">
            {[
              [
                "Location permission",
                permissionLabel,
                <CheckCircle2 size={13} />,
              ],
              [
                "GPS accuracy",
                location?.accuracy !== undefined
                  ? `±${Math.round(location.accuracy)} m · ${
                      location.accuracy <= 20
                        ? "Good"
                        : location.accuracy <= 50
                          ? "Fair"
                          : "Limited"
                    }`
                  : "Not recorded",
                <Crosshair size={13} />,
              ],
              [
                "Distance from office",
                distanceMeters !== undefined
                  ? `${Math.round(distanceMeters)} m`
                  : "Not recorded",
                <MapPin size={13} />,
              ],
              [
                "Working day",
                today?.state?.reason === "Today is a holiday"
                  ? "Holiday"
                  : isWeekend
                    ? "Weekend"
                    : dayjs(now).tz(zone).format("dddd"),
                <CalendarDays size={13} />,
              ],
            ].map(([label, value, Icon]) => (
              <div
                className="flex items-center gap-2 border-b border-slate-100 py-2 last:border-b-0"
                key={label}
              >
                <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-purple-100 text-violet-700">
                  {Icon}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">
                  {label}
                </span>
                <strong className="shrink-0 text-right text-[11px] font-semibold text-slate-700">
                  {value}
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={`${cardClass} mt-4 min-w-0 overflow-hidden`}>
        <div className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <h2 className="font-['Poppins',sans-serif] text-[15px] font-semibold text-slate-900">
              Attendance history
            </h2>

            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[auto_minmax(0,1fr)] xl:flex xl:flex-wrap xl:items-center">
              <div
                aria-label="Attendance period"
                className="flex min-w-0 max-w-full items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 p-1"
                role="group"
              >
                {[
                  ["thisMonth", "This month", setThisMonth],
                  ["lastMonth", "Last month", setLastMonth],
                  [
                    "custom",
                    "Custom",
                    () => {
                      setPage(1);
                      setPreset("custom");
                    },
                  ],
                ].map(([id, label, action]) => (
                  <button
                    aria-pressed={preset === id}
                    className={`min-w-0 flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-[10px] font-semibold transition sm:px-2.5 sm:text-[11px] ${
                      preset === id
                        ? "bg-white text-violet-700 shadow-sm"
                        : "text-slate-500 hover:text-violet-700"
                    }`}
                    key={id}
                    onClick={action}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-2 min-[480px]:grid-cols-2 sm:col-span-2 xl:col-span-1 xl:flex">
                <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-slate-500">
                  <CalendarDays size={14} className="shrink-0 text-violet-600" />
                  <span className="shrink-0 text-[10px]">From</span>
                  <input
                    aria-label="From date"
                    className="w-full min-w-0 bg-transparent text-[11px] text-slate-600 outline-none"
                    type="date"
                    value={from}
                    onChange={(event) => setCustomRange(event.target.value, to)}
                  />
                </label>
                <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-slate-500">
                  <CalendarDays size={14} className="shrink-0 text-violet-600" />
                  <span className="shrink-0 text-[10px]">To</span>
                  <input
                    aria-label="To date"
                    className="w-full min-w-0 bg-transparent text-[11px] text-slate-600 outline-none"
                    type="date"
                    value={to}
                    onChange={(event) => setCustomRange(from, event.target.value)}
                  />
                </label>
              </div>

              <label className="flex h-9 min-w-0 items-center justify-between gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] text-slate-600 sm:col-span-2 xl:col-span-1 xl:w-auto">
                <span className="sr-only">Filter by attendance status</span>
                <select
                  aria-label="Filter by attendance status"
                  className="w-full min-w-0 bg-transparent outline-none xl:max-w-[140px]"
                  value={statusFilter}
                  onChange={(event) => {
                    setPage(1);
                    setStatusFilter(event.target.value);
                  }}
                >
                  <option value="all">All statuses</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="leave">Leave</option>
                  <option value="absent">Absent</option>
                  <option value="holiday">Holiday</option>
                  <option value="missing-check-out">Missing check-out</option>
                </select>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {[
                ["Present", counts.present, "emerald"],
                ["Late", counts.late, "amber"],
                ["Leave", counts.leave, "violet"],
                ["Half-day leave · days", counts.halfDayLeaveDays, "violet"],
                ["Missing check-out", counts.missingCheckOut, "rose"],
              ].map(([label, count, color]) => (
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    color === "emerald"
                      ? "bg-emerald-50 text-emerald-700"
                      : color === "amber"
                        ? "bg-amber-50 text-amber-700"
                        : color === "violet"
                          ? "bg-violet-50 text-violet-700"
                          : "bg-rose-50 text-rose-700"
                  }`}
                  key={label}
                >
                  {label} · {count}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">
              Attendance{" "}
              <strong className="font-semibold text-slate-800">
                {counts.attendancePercent}%
              </strong>
              {" · "}
              {counts.workingDays} working days
            </p>
          </div>

          {historyError && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700" role="alert">
              {historyError}
            </p>
          )}
        </div>

        <div className="min-w-0 overflow-x-auto overscroll-x-contain border-t border-slate-100">
          <table className="w-full min-w-[790px] border-collapse text-left text-[11px]">
            <thead className="text-slate-500">
              <tr>
                {["Date", "Check in", "Check out", "Worked", "Location", "Status"].map(
                  (heading) => (
                    <th className="px-4 py-2 font-medium sm:px-5" key={heading}>
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr>
                  <td
                    className="px-5 py-8 text-center text-slate-400"
                    colSpan={6}
                  >
                    <RefreshCw className="mr-2 inline animate-spin" size={14} />
                    Loading attendance history…
                  </td>
                </tr>
              ) : pageRecords.length === 0 ? (
                <tr>
                  <td
                    className="px-5 py-8 text-center text-slate-400"
                    colSpan={6}
                  >
                    No attendance records for this period and status.
                  </td>
                </tr>
              ) : (
                pageRecords.map((record) => {
                  const recordStatus = record.missingCheckOut
                    ? "missing-check-out"
                    : record.status;
                  const recordStatusLabel = record.leaveDays
                    ? `${recordStatus.replaceAll("-", " ")} · ${record.leaveDays} leave day${record.leaveDays === 1 ? "" : "s"}${record.leavePeriod ? ` (${record.leavePeriod})` : ""}`
                    : recordStatus.replaceAll("-", " ");
                  const recordLocation =
                    record.checkOutLocation || record.checkInLocation;
                  const recordMinutes =
                    record.checkIn && !record.checkOut && record.date === currentDate
                      ? Math.max(
                          record.workedMinutes || 0,
                          dayjs(now).diff(dayjs(record.checkIn), "minute"),
                        )
                      : record.workedMinutes;
                  const workedLabel =
                    record.missingCheckOut || record.status === "absent"
                      ? "Not recorded"
                      : record.status === "leave"
                        ? "Leave"
                        : recordMinutes === undefined
                          ? "—"
                          : minutesValue(recordMinutes);

                  return (
                    <tr
                      className="border-t border-slate-100 text-slate-700"
                      key={record.id}
                    >
                      <td className="whitespace-nowrap px-4 py-2 font-semibold sm:px-5">
                        {dateValue(record.date, "ddd DD MMM")}
                        {record.date === currentDate && (
                          <span className="font-normal text-slate-500">
                            {" "}
                            (today)
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {timeValue(record.checkIn)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {record.checkOut
                          ? timeValue(record.checkOut)
                          : record.checkIn && record.date === currentDate
                            ? "In progress"
                            : "--:--"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {workedLabel}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {recordLocation ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <Check size={13} />
                            Verified · {Math.round(recordLocation.distance)} m
                          </span>
                        ) : ["leave", "holiday"].includes(record.status) ? (
                          "Not required"
                        ) : (
                          "Not recorded"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ring-1 ${
                            statusClass[recordStatus] ||
                            "bg-slate-100 text-slate-600 ring-slate-200"
                          }`}
                        >
                          {recordStatusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[10px] text-slate-500 sm:px-5">
          <span>
            Showing{" "}
            {filteredHistory.length ? (page - 1) * pageSize + 1 : 0}–
            {Math.min(page * pageSize, filteredHistory.length)} of{" "}
            {filteredHistory.length} records
          </span>
          <div className="flex items-center gap-1">
            <button
              aria-label="Previous page"
              className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-violet-50 disabled:opacity-40"
              disabled={page <= 1 || historyLoading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              type="button"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1)
              .slice(Math.max(0, page - 2), Math.max(0, page - 2) + 3)
              .map((pageNumber) => (
                <button
                  aria-current={pageNumber === page ? "page" : undefined}
                  className={`grid h-7 min-w-7 place-items-center rounded-lg px-2 text-[10px] font-semibold ${
                    pageNumber === page
                      ? "bg-gradient-to-r from-[#6A0DAD] to-[#7C3AED] text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-violet-50"
                  }`}
                  key={pageNumber}
                  onClick={() => setPage(pageNumber)}
                  type="button"
                >
                  {pageNumber}
                </button>
              ))}
            <button
              aria-label="Next page"
              className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-violet-50 disabled:opacity-40"
              disabled={page >= pageCount || historyLoading}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              type="button"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>
    </>
  );

  if (embedded) {
    return (
      <section className="mx-auto w-full min-w-0 max-w-[1440px]">
        {content}
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] p-4 font-['Inter',sans-serif] text-slate-800 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Link
              className="mb-3 inline-flex items-center gap-2 text-[12px] font-semibold text-violet-700 no-underline"
              to="/dashboard"
            >
              <ChevronLeft size={15} />
              Back to workspace
            </Link>
            <h1 className="font-['Poppins',sans-serif] text-[24px] font-semibold tracking-[-0.5px] text-slate-900">
              My attendance
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Check in, check out and review your attendance history.
            </p>
          </div>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 self-start text-[12px] font-semibold text-slate-500 hover:text-slate-900"
            type="button"
          >
            Sign out
          </button>
        </header>
        {content}
      </div>
    </main>
  );
}
