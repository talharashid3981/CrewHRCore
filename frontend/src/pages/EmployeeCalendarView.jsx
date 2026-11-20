import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  LockKeyhole,
} from "lucide-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import ExcelJS from "exceljs";
import { getDashboardCalendar } from "../api/auth.api";
import { useAuth } from "../context/AuthContext";

dayjs.extend(utc);
dayjs.extend(timezone);

const timeZone = "Asia/Karachi";
const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const filters = [
  { key: "holidays", label: "Public holidays", color: "bg-amber-400" },
  { key: "approved", label: "My approved leave", color: "bg-violet-500" },
  { key: "pending", label: "Pending requests", color: "border-violet-400" },
  { key: "company", label: "Company events", color: "bg-sky-400" },
  { key: "attendance", label: "My attendance", color: "attendance" },
];

const dateAtNoon = (date) => dayjs(`${date}T12:00:00`);
const currentDate = () => dayjs().tz(timeZone).format("YYYY-MM-DD");
const eventCoversDate = (event, date) =>
  event.start <= date && (event.to || event.start) >= date;
const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "U";

const formatTime = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }).format(new Date(value))
    : "";

const eventMatchesFilter = (event, selectedFilters) => {
  if (event.type === "holiday") return selectedFilters.holidays;
  if (event.type === "company") return selectedFilters.company;
  if (event.type === "leave" && event.status === "pending") {
    return selectedFilters.pending;
  }
  if (event.type === "leave") return selectedFilters.approved;
  return false;
};

const eventClassName = (event) => {
  if (event.type === "holiday") {
    return "bg-amber-50 text-amber-700";
  }
  if (event.type === "company") {
    return "bg-sky-100 text-sky-700";
  }
  if (event.status === "pending") {
    return "border border-dashed border-violet-400 bg-white text-violet-700";
  }
  return "bg-violet-100 text-violet-700";
};

const dayStatusTone = (status) => {
  if (status === "present") return "bg-emerald-500";
  if (status === "late") return "bg-amber-500";
  if (status === "absent") return "bg-rose-500";
  return "";
};

const dayTypeLabel = (status) => {
  if (status === "notEligible") return "Before start date";
  if (status === "holiday") return "Public holiday";
  if (status === "weekend") return "Weekend";
  if (status === "leave") return "On leave";
  return "Working day";
};

const eventSubtitle = (event) => {
  if (event.type === "holiday") {
    const end = event.to || event.start;
    return end === event.start
      ? "Public holiday"
      : `Public holiday · ${dateAtNoon(event.start).format("D MMM")}–${dateAtNoon(end).format("D MMM")}`;
  }
  if (event.type === "company") return "Company event";
  if (event.status === "pending") {
    const duration = event.days || 1;
    return `Pending review · ${duration} day${duration === 1 ? "" : "s"}`;
  }
  const start = dateAtNoon(event.start).format("D");
  const end = dateAtNoon(event.to || event.start).format("D MMM");
  return `Approved · ${start}${event.to && event.to !== event.start ? `–${end}` : ` ${dateAtNoon(event.start).format("MMM")}`}`;
};

export default function EmployeeCalendarView({ embedded = false }) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [view, setView] = useState("month");
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const [selectedFilters, setSelectedFilters] = useState({
    holidays: true,
    approved: true,
    pending: true,
    company: true,
    attendance: true,
  });

  const month = selectedDate.slice(0, 7);
  const load = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const currentMonth = dateAtNoon(`${month}-01`);
      const monthKeys = [-1, 0, 1].map((offset) =>
        currentMonth.add(offset, "month").format("YYYY-MM"),
      );
      const results = await Promise.all(
        monthKeys.map((monthKey) => getDashboardCalendar(monthKey)),
      );
      if (currentRequestId !== requestId.current) return;
      setCalendarEvents([
        ...new Map(
          results.flatMap((result) => result.events || []).map((event) => [event.id, event]),
        ).values(),
      ]);
      setDays([
        ...new Map(
          results.flatMap((result) => result.days || []).map((day) => [day.date, day]),
        ).values(),
      ]);
    } catch (requestError) {
      if (currentRequestId !== requestId.current) return;
      setError(
        requestError.response?.data?.message ||
          "Unable to load your calendar.",
      );
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => {
      clearTimeout(timer);
      requestId.current += 1;
    };
  }, [load]);

  const visibleEvents = useMemo(
    () => calendarEvents.filter((event) => eventMatchesFilter(event, selectedFilters)),
    [calendarEvents, selectedFilters],
  );
  const dayMap = useMemo(
    () => new Map(days.map((day) => [day.date, day])),
    [days],
  );
  const visibleDates = useMemo(() => {
    const selected = dateAtNoon(selectedDate);
    if (view === "week") {
      const monday = selected.subtract((selected.day() + 6) % 7, "day");
      return Array.from({ length: 7 }, (_, index) =>
        monday.add(index, "day").format("YYYY-MM-DD"),
      );
    }
    if (view === "agenda") {
      const first = dateAtNoon(`${month}-01`);
      return Array.from({ length: first.daysInMonth() }, (_, index) =>
        first.add(index, "day").format("YYYY-MM-DD"),
      );
    }
    const first = dateAtNoon(`${month}-01`);
    const gridStart = first.subtract((first.day() + 6) % 7, "day");
    return Array.from({ length: 42 }, (_, index) =>
      gridStart.add(index, "day").format("YYYY-MM-DD"),
    );
  }, [month, selectedDate, view]);

  const visibleRangeEvents = useMemo(
    () =>
      visibleEvents.filter((event) =>
        visibleDates.some(
          (date) =>
            event.start <= date &&
            (event.to || event.start) >= date,
        ),
      ),
    [visibleDates, visibleEvents],
  );
  const today = currentDate();
  const selectedDay = dayMap.get(selectedDate);
  const selectedEvents = visibleRangeEvents.filter(
    (event) =>
      event.start <= selectedDate &&
      (event.to || event.start) >= selectedDate,
  );
  const attendance = selectedDay?.attendance;
  const attendanceStatus = attendance?.status || selectedDay?.status;
  const attendanceText = attendance
    ? `${attendance.status[0].toUpperCase()}${attendance.status.slice(1)}${attendance.checkIn ? ` · ${formatTime(attendance.checkIn)}` : ""}${attendance.leaveDays ? ` · ${attendance.leaveDays} leave day${attendance.leaveDays === 1 ? "" : "s"}${attendance.leavePeriod ? ` (${attendance.leavePeriod})` : ""}` : ""}`
    : selectedDay?.status === "absent"
      ? "Absent"
      : selectedDay?.status === "leave"
        ? "On leave"
        : "No attendance";
  const upcomingEvents = visibleEvents
    .filter((event) => (event.to || event.start) >= today)
    .map((event) => ({
      ...event,
      upcomingDate: event.start < today ? today : event.start,
    }))
    .sort((left, right) => left.upcomingDate.localeCompare(right.upcomingDate))
    .slice(0, 5);

  const changeDate = (amount) => {
    const date = dateAtNoon(selectedDate);
    setSelectedDate(
      (view === "week" ? date.add(amount, "week") : date.add(amount, "month"))
        .format("YYYY-MM-DD"),
    );
  };

  const exportCalendar = async () => {
    setExporting(true);
    setError("");
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Calendar");
      sheet.columns = [
        { header: "Date", key: "date", width: 18 },
        { header: "Event", key: "title", width: 32 },
        { header: "Category", key: "category", width: 20 },
        { header: "Status", key: "status", width: 18 },
      ];
      visibleRangeEvents.forEach((event) => {
        sheet.addRow({
          date: event.type === "holiday" && event.to && event.to !== event.start
            ? `${dateAtNoon(event.start).format("DD MMM YYYY")} – ${dateAtNoon(event.to).format("DD MMM YYYY")}`
            : dateAtNoon(event.start).format("DD MMM YYYY"),
          title: event.title,
          category: event.type === "holiday" ? "Public holiday" : event.type === "company" ? "Company event" : "Leave",
          status: event.status || "",
        });
      });
      if (selectedFilters.attendance) {
        visibleDates.forEach((date) => {
          const day = dayMap.get(date);
          if (!day || !["present", "late", "absent"].includes(day.status)) return;
          sheet.addRow({
            date: dateAtNoon(date).format("DD MMM YYYY"),
            title: `Attendance · ${day.status}`,
            category: "Attendance",
            status: day.status,
          });
        });
      }
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF6A0DAD" },
      };
      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `crew-hrcore-calendar-${month}.xlsx`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (exportError) {
      setError(
        exportError.message || "Unable to export your calendar.",
      );
    } finally {
      setExporting(false);
    }
  };

  const toggleFilter = (key) =>
    setSelectedFilters((current) => ({ ...current, [key]: !current[key] }));

  const calendarDays = (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-white">
        {weekdayLabels.map((label, index) => (
          <div
            className={`py-2 text-center text-[10px] font-semibold uppercase tracking-wide sm:text-[11px] ${
              index > 4 ? "text-slate-400" : "text-slate-500"
            }`}
            key={label}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {visibleDates.map((date) => {
          const dateObj = dateAtNoon(date);
          const isCurrentMonth = date.startsWith(month);
          const isSelected = date === selectedDate;
          const isCurrentDate = date === today;
          const dayData = dayMap.get(date);
          const marker = selectedFilters.attendance &&
            dayData?.status !== "notEligible"
            ? dayStatusTone(dayData?.attendance?.status || dayData?.status)
            : "";
          const eventsForDate = visibleRangeEvents
            .filter((event) => eventCoversDate(event, date))
            .sort((first, second) => first.start.localeCompare(second.start));
          const events = eventsForDate.slice(0, 2);
          const eventCount = eventsForDate.length;

          return (
            <button
              aria-label={`${dateObj.format("dddd, D MMMM YYYY")}${events.length ? `, ${events.map((event) => event.title).join(", ")}` : ""}`}
              aria-pressed={isSelected}
              className={`flex min-h-[54px] min-w-0 flex-col border-b border-r border-slate-100 p-1 text-left transition hover:bg-violet-50/60 sm:min-h-[64px] sm:p-1.5 lg:min-h-[72px] lg:p-2 ${
                (dayData
                  ? dayData.status === "weekend"
                  : dateObj.day() === 0 || dateObj.day() === 6)
                  ? "bg-slate-50/70"
                  : "bg-white"
              } ${!isCurrentMonth ? "text-slate-300" : "text-slate-700"} ${
                isSelected ? "relative z-10 outline outline-1 outline-violet-500" : ""
              }`}
              key={date}
              onClick={() => setSelectedDate(date)}
              type="button"
            >
              <span className="flex w-full items-center justify-between gap-1">
                <span
                  className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-semibold sm:h-6 sm:min-w-6 sm:text-[11px] ${
                    isCurrentDate
                      ? "bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-sm"
                      : ""
                  }`}
                >
                  {dateObj.date()}
                </span>
                {marker && (
                  <span
                    aria-label={`${dayData?.attendance?.status || dayData?.status} attendance`}
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${marker}`}
                  />
                )}
              </span>
              <span className="mt-1 grid w-full gap-1">
                {events.map((event) => (
                  <span
                    className={`block truncate rounded-md px-1 py-0.5 text-[8px] font-semibold leading-3 sm:px-1.5 sm:text-[9px] ${eventClassName(event)}`}
                    key={event.id}
                    title={event.title}
                  >
                    {event.title}
                    {event.type === "leave" &&
                      event.days > 1 &&
                      ` · ${event.days}d`}
                    {event.start < date && " · continued"}
                  </span>
                ))}
                {eventCount > events.length && (
                  <span className="px-1 text-[8px] font-medium text-slate-500">
                    +{eventCount - events.length} more
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const agendaRows = visibleDates.flatMap((date) => {
    const eventRows = visibleRangeEvents
      .filter((event) => {
        if (event.type === "holiday") {
          const previousDate = dateAtNoon(date).subtract(1, "day").format("YYYY-MM-DD");
          return eventCoversDate(event, date)
            && (date === visibleDates[0] || !eventCoversDate(event, previousDate));
        }
        return event.start === date
          || (date === visibleDates[0] && eventCoversDate(event, date));
      })
      .map((event) => ({ date, event }));
    const day = dayMap.get(date);
    if (
      selectedFilters.attendance &&
      day &&
      ["present", "late", "absent"].includes(day.status)
    ) {
      eventRows.push({
        date,
        event: {
          id: `attendance-${date}`,
          title: `Attendance · ${day.status}`,
          type: "attendance",
          status: day.status,
        },
      });
    }
    return eventRows;
  });

  return (
    <main
      className={`@container/calendar w-full min-w-0 max-w-full overflow-x-clip bg-[#F8FAFC] text-slate-800 ${
        embedded ? "min-h-full p-4 sm:p-6 lg:p-7" : "min-h-screen p-4 sm:p-6"
      }`}
    >
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-['Poppins',sans-serif] text-[24px] font-semibold leading-tight tracking-[-0.5px] text-slate-900">
              Calendar
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Company holidays and important dates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-purple-100 px-3 text-[11px] font-semibold text-violet-700">
              <LockKeyhole size={13} />
              Read-only view
            </span>
            <span
              aria-label="Notifications"
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
              role="img"
            >
              <Bell size={16} />
            </span>
            <div className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 shadow-sm">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 text-[10px] font-semibold text-white">
                {getInitials(user?.name)}
              </span>
              <span className="max-w-24 truncate text-[11px] font-semibold text-slate-700">
                {user?.name?.split(" ")[0] || "Employee"}
              </span>
            </div>
          </div>
        </header>

        {error && (
          <div
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] text-rose-700"
            role="alert"
          >
            <span>{error}</span>
            <button
              className="font-semibold underline underline-offset-2"
              onClick={() => void load()}
              type="button"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid min-w-0 items-start gap-4 @min-[700px]/calendar:grid-cols-[minmax(0,1fr)_290px]">
          <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_6px_18px_rgba(15,23,42,0.04)] sm:p-4 lg:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="min-w-0 truncate font-['Poppins',sans-serif] text-[17px] font-semibold tracking-[-0.3px] text-slate-900 sm:text-[19px]">
                  {view === "week"
                    ? `${dateAtNoon(visibleDates[0]).format("D MMM")} – ${dateAtNoon(visibleDates[6]).format("D MMM YYYY")}`
                    : dateAtNoon(`${month}-01`).format("MMMM YYYY")}
                </h2>
                <button
                  aria-label={view === "week" ? "Previous week" : "Previous month"}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                  onClick={() => changeDate(-1)}
                  type="button"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  aria-label={view === "week" ? "Next week" : "Next month"}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                  onClick={() => changeDate(1)}
                  type="button"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  className="h-8 shrink-0 rounded-lg bg-purple-100 px-3 text-[10px] font-semibold text-violet-700 transition hover:bg-purple-200"
                  onClick={() => setSelectedDate(today)}
                  type="button"
                >
                  Today
                </button>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div
                  aria-label="Calendar views"
                  className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
                  role="group"
                >
                  {["month", "week", "agenda"].map((item) => (
                    <button
                      aria-pressed={view === item}
                      className={`rounded-md px-2.5 py-1.5 text-[10px] font-medium capitalize transition sm:px-3 ${
                        view === item
                          ? "bg-white text-violet-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                      key={item}
                      onClick={() => setView(item)}
                      type="button"
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <button
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  disabled={loading || exporting}
                  onClick={() => void exportCalendar()}
                  type="button"
                >
                  <Download size={13} />
                  {exporting ? "Exporting..." : "Export"}
                </button>
              </div>
            </div>

            {loading ? (
              <div
                aria-label="Loading calendar"
                className="grid grid-cols-7 overflow-hidden rounded-xl border border-slate-200"
              >
                {Array.from({ length: 42 }, (_, index) => (
                  <span
                    className="min-h-[54px] animate-pulse border-b border-r border-slate-100 bg-slate-50 sm:min-h-[64px] lg:min-h-[72px]"
                    key={index}
                  />
                ))}
              </div>
            ) : view === "agenda" ? (
              <div className="max-h-[690px] min-h-[280px] overflow-y-auto rounded-xl border border-slate-200">
                {agendaRows.length ? (
                  agendaRows.map(({ date, event }) => (
                    <button
                      className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-0 hover:bg-slate-50"
                      key={event.id}
                      onClick={() => setSelectedDate(date)}
                      type="button"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-purple-100 font-semibold text-violet-700">
                        <span className="text-[9px] uppercase">
                          {dateAtNoon(date).format("MMM")}
                        </span>
                        <span className="text-[14px] leading-4">
                          {dateAtNoon(date).format("D")}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold text-slate-800">
                          {event.title}
                        </span>
                        <span className="text-[10px] capitalize text-slate-500">
                          {event.type === "attendance"
                            ? `${event.status} attendance`
                            : event.type === "holiday"
                              ? "Public holiday"
                              : `${event.status} leave`}
                        </span>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {dateAtNoon(date).format("ddd")}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-12 text-center text-[12px] text-slate-400">
                    No calendar items in this period.
                  </p>
                )}
              </div>
            ) : (
              calendarDays
            )}
          </section>

          <aside className="grid min-w-0 gap-4 sm:grid-cols-2 @min-[700px]/calendar:grid-cols-1">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">
                  {dateAtNoon(selectedDate).format("ddd DD MMM")}
                </h2>
                {selectedDate === today && (
                  <span className="rounded-full bg-purple-100 px-2.5 py-1 text-[9px] font-semibold text-violet-700">
                    Today
                  </span>
                )}
              </div>
              <div className="mt-3 divide-y divide-slate-100 text-[11px]">
                <div className="flex items-start justify-between gap-2 py-2 first:pt-0">
                  <span className="text-slate-500">Attendance</span>
                  <span
                    className={`text-right font-semibold ${
                      attendanceStatus === "present"
                        ? "text-emerald-600"
                        : attendanceStatus === "late"
                          ? "text-amber-600"
                          : "text-slate-700"
                    }`}
                  >
                    {attendanceText}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 py-2">
                  <span className="text-slate-500">Day type</span>
                  <span className="font-semibold text-slate-700">
                    {dayTypeLabel(selectedDay?.status)}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2 py-2 last:pb-0">
                  <span className="text-slate-500">Events</span>
                  <span className="max-w-[65%] text-right text-slate-600">
                    {selectedEvents.length
                      ? selectedEvents.map((event) => event.title).join(", ")
                      : selectedDate === today
                        ? "None today"
                        : "None"}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">
                  Upcoming
                </h2>
                <button
                  className="text-[10px] font-semibold text-violet-700 hover:text-violet-900"
                  onClick={() => setView("agenda")}
                  type="button"
                >
                  View all
                </button>
              </div>
              {upcomingEvents.length ? (
                <div className="divide-y divide-slate-100">
                  {upcomingEvents.map((event) => (
                    <button
                      className="flex w-full items-center gap-2.5 py-2 text-left first:pt-1 last:pb-0"
                      key={event.id}
                      onClick={() => setSelectedDate(event.upcomingDate)}
                      type="button"
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                          event.type === "holiday"
                            ? "bg-amber-50 text-amber-700"
                            : event.status === "pending"
                              ? "bg-purple-100 text-violet-700"
                              : "bg-sky-50 text-sky-700"
                        }`}
                      >
                        <span className="text-[12px] font-bold leading-3">
                          {dateAtNoon(event.upcomingDate).format("D")}
                        </span>
                        <span className="text-[8px] font-semibold uppercase">
                          {dateAtNoon(event.upcomingDate).format("MMM")}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10px] font-semibold text-slate-800">
                          {event.title}
                        </span>
                        <span className="block truncate text-[9px] text-slate-500">
                          {eventSubtitle(event)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-[11px] text-slate-400">
                  No upcoming items.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] sm:col-span-2 @min-[700px]/calendar:col-span-1">
              <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">
                Show on calendar
              </h2>
              <div className="mt-2 grid gap-2">
                {filters.map((filter) => (
                  <label
                    className="flex cursor-pointer items-center gap-2.5 text-[10px] text-slate-700"
                    key={filter.key}
                  >
                    <input
                      checked={selectedFilters[filter.key]}
                      className="h-4 w-4 accent-violet-600"
                      onChange={() => toggleFilter(filter.key)}
                      type="checkbox"
                    />
                    {filter.key === "attendance" ? (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                      </span>
                    ) : filter.key === "pending" ? (
                      <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-violet-400" />
                    ) : (
                      <span className={`h-2.5 w-2.5 rounded-sm ${filter.color}`} />
                    )}
                    {filter.label}
                  </label>
                ))}
              </div>
              {loading && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] text-slate-400">
                  <Clock3 size={12} />
                  Updating calendar…
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
