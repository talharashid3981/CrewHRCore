import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import useToastMessage from "../hooks/useToastMessage";

dayjs.extend(utc);
dayjs.extend(timezone);

const timeZone = "Asia/Karachi";
const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const filters = [
  { key: "holidays", label: "Public holidays", color: "bg-violet-800" },
  { key: "approved", label: "My approved leave", color: "bg-violet-600" },
  { key: "pending", label: "Pending requests", color: "border-violet-600" },
  { key: "company", label: "Company events", color: "bg-purple-300" },
  { key: "attendance", label: "My attendance", color: "attendance" },
];

const dateAtNoon = (date) => dayjs(`${date}T12:00:00`);
const currentDate = () => dayjs().tz(timeZone).format("YYYY-MM-DD");
const eventCoversDate = (event, date) =>
  event.start <= date && (event.to || event.start) >= date;
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

const isMultiDayLeave = (event) =>
  event.type === "leave" && event.to && event.to !== event.start;

const eventClassName = (event) => {
  if (event.type === "holiday") {
    return "bg-violet-100 text-violet-950";
  }
  if (event.type === "company") {
    return "bg-purple-100 text-violet-800";
  }
  if (event.status === "pending") {
    return "border border-dashed border-violet-600 bg-white text-violet-800";
  }
  return "bg-violet-50 text-violet-800";
};

const eventMarkerClass = (event) => {
  if (event.type === "holiday") return "bg-violet-800";
  if (event.type === "company") return "bg-purple-300";
  if (event.status === "pending") {
    return "border border-dashed border-violet-700";
  }
  return "bg-violet-600";
};

const dayStatusTone = (status) => {
  if (status === "present") return "bg-green-600";
  if (status === "late") return "bg-amber-500";
  if (status === "absent") return "bg-red-600";
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
  useToastMessage(error, "error");
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
      const periodStart = view === "week"
        ? visibleDates[0]
        : dateAtNoon(`${month}-01`).format("YYYY-MM-DD");
      const periodEnd = view === "week"
        ? visibleDates[6]
        : dateAtNoon(`${month}-01`).endOf("month").format("YYYY-MM-DD");
      const periodDates = [];
      for (
        let date = dateAtNoon(periodStart);
        date.format("YYYY-MM-DD") <= periodEnd;
        date = date.add(1, "day")
      ) {
        periodDates.push(date.format("YYYY-MM-DD"));
      }

      const eventsForExport = visibleEvents
        .filter((event) =>
          event.start <= periodEnd &&
          (event.to || event.start) >= periodStart,
        )
        .sort((first, second) =>
          first.start.localeCompare(second.start) ||
          first.title.localeCompare(second.title),
        );
      const attendanceForExport = selectedFilters.attendance
        ? periodDates.map((date) => {
            const day = dayMap.get(date);
            const rawStatus = day?.attendance?.status || day?.status;
            const attendanceStatus = !day
              ? "Data unavailable"
              : rawStatus === "present"
                ? "Present"
                : rawStatus === "late"
                  ? "Late"
                  : rawStatus === "absent"
                    ? "Absent"
                    : rawStatus === "leave"
                      ? "On leave"
                      : rawStatus === "pending"
                        ? "Pending"
                        : rawStatus === "holiday"
                          ? "Public holiday"
                          : rawStatus === "weekend"
                            ? "Weekend"
                            : rawStatus === "notEligible"
                              ? "Not eligible"
                              : "No attendance";
            return { date, day, attendanceStatus };
          })
        : [];
      const displayStatus = (status) =>
        status ? `${status[0].toUpperCase()}${status.slice(1)}` : "";
      const excelDate = (date) => dateAtNoon(date).toDate();
      const eventRows = eventsForExport.map((event) => {
        const eventEnd = event.to || event.start;
        const durationDays = event.type === "leave" &&
          Number.isFinite(event.days)
          ? event.days
          : dateAtNoon(eventEnd).diff(dateAtNoon(event.start), "day") + 1;
        const category = event.type === "holiday"
          ? "Public holiday"
          : event.type === "company"
            ? "Company event"
            : "Leave";
        const details = event.type !== "leave"
          ? ""
          : event.duration === "half" || durationDays === 0.5
            ? `Half day${event.halfDayPeriod ? ` · ${displayStatus(event.halfDayPeriod)}` : ""}`
            : "Full-day leave";

        return [
          excelDate(event.start),
          excelDate(eventEnd),
          durationDays,
          event.title,
          category,
          displayStatus(event.status) || "Scheduled",
          details,
        ];
      });
      const attendanceRows = attendanceForExport.map(
        ({ date, day, attendanceStatus }) => {
          const attendance = day?.attendance;
          return [
            excelDate(date),
            dateAtNoon(date).format("dddd"),
            day ? dayTypeLabel(day.status) : "Unavailable",
            attendanceStatus,
            formatTime(attendance?.checkIn),
            formatTime(attendance?.checkOut),
            Number.isFinite(attendance?.workedMinutes)
              ? attendance.workedMinutes / 60
              : null,
            attendance?.lateMinutes ?? null,
            attendance?.leaveDays ?? null,
            displayStatus(attendance?.leavePeriod),
          ];
        },
      );
      const rangeLabel = `${dateAtNoon(periodStart).format("DD MMM YYYY")} – ${dateAtNoon(periodEnd).format("DD MMM YYYY")}`;
      const selectedCategories = filters
        .filter((filter) => selectedFilters[filter.key])
        .map((filter) => filter.label);
      const attendanceCount = (status) =>
        attendanceForExport.filter((row) => row.attendanceStatus === status).length;
      const leaveDays = eventsForExport.reduce(
        (total, event) =>
          event.type === "leave" && Number.isFinite(event.days)
            ? total + event.days
            : total,
        0,
      );
      const summaryMetrics = [
        ["Calendar events", eventsForExport.length],
        ["Public holidays", eventsForExport.filter((event) => event.type === "holiday").length],
        ["Company events", eventsForExport.filter((event) => event.type === "company").length],
        ["Leave requests", eventsForExport.filter((event) => event.type === "leave").length],
        ["Approved leave requests", eventsForExport.filter((event) => event.type === "leave" && event.status === "approved").length],
        ["Pending leave requests", eventsForExport.filter((event) => event.type === "leave" && event.status === "pending").length],
        ["Leave days in exported requests", Number(leaveDays.toFixed(2))],
        ["Present days", selectedFilters.attendance ? attendanceCount("Present") : "Not included"],
        ["Late days", selectedFilters.attendance ? attendanceCount("Late") : "Not included"],
        ["Absent days", selectedFilters.attendance ? attendanceCount("Absent") : "Not included"],
      ];

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Crew HRCore";
      workbook.subject = "Employee calendar report";
      workbook.title = "Employee Calendar";
      workbook.created = new Date();

      const brandFill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF6A0DAD" },
      };
      const lightFill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8F5FC" },
      };
      const applyTitle = (sheet, title, subtitle, columnCount) => {
        sheet.mergeCells(1, 1, 1, columnCount);
        sheet.mergeCells(2, 1, 2, columnCount);
        const titleCell = sheet.getCell(1, 1);
        titleCell.value = title;
        titleCell.font = {
          name: "Aptos Display",
          size: 18,
          bold: true,
          color: { argb: "FFFFFFFF" },
        };
        titleCell.fill = brandFill;
        titleCell.alignment = { vertical: "middle" };
        sheet.getRow(1).height = 32;
        const subtitleCell = sheet.getCell(2, 1);
        subtitleCell.value = subtitle;
        subtitleCell.font = {
          name: "Aptos",
          size: 10,
          color: { argb: "FF475569" },
        };
        subtitleCell.alignment = { vertical: "middle", wrapText: true };
        sheet.getRow(2).height = 30;
        sheet.getRow(3).height = 8;
      };
      const createDetailSheet = (
        name,
        title,
        subtitle,
        columns,
        headers,
        rows,
        emptyMessage,
      ) => {
        const sheet = workbook.addWorksheet(name);
        sheet.columns = columns.map((width) => ({ width }));
        applyTitle(sheet, title, subtitle, columns.length);
        const headerRow = sheet.getRow(4);
        headers.forEach((header, index) => {
          const cell = headerRow.getCell(index + 1);
          cell.value = header;
          cell.font = {
            name: "Aptos",
            size: 10,
            bold: true,
            color: { argb: "FFFFFFFF" },
          };
          cell.fill = brandFill;
          cell.alignment = { vertical: "middle", wrapText: true };
        });
        headerRow.height = 28;
        rows.forEach((row) => sheet.addRow(row));
        if (!rows.length) {
          sheet.mergeCells(5, 1, 5, columns.length);
          sheet.getCell(5, 1).value = emptyMessage;
          sheet.getCell(5, 1).font = {
            name: "Aptos",
            italic: true,
            color: { argb: "FF64748B" },
          };
        }
        for (let rowNumber = 5; rowNumber <= sheet.rowCount; rowNumber += 1) {
          const row = sheet.getRow(rowNumber);
          row.height = 22;
          row.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = { name: "Aptos", size: 10, color: { argb: "FF1E293B" } };
            cell.alignment = { vertical: "middle", wrapText: true };
            cell.border = {
              bottom: { style: "hair", color: { argb: "FFE9E5F7" } },
            };
            if (rowNumber % 2 === 0) cell.fill = lightFill;
          });
        }
        sheet.autoFilter = {
          from: { row: 4, column: 1 },
          to: {
            row: rows.length ? rows.length + 4 : 4,
            column: columns.length,
          },
        };
        sheet.views = [{ state: "frozen", ySplit: 4 }];
        sheet.pageSetup = {
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        };
        return sheet;
      };

      const overview = workbook.addWorksheet("Overview");
      overview.columns = [
        { width: 28 },
        { width: 34 },
        { width: 28 },
        { width: 36 },
      ];
      applyTitle(
        overview,
        "Crew HRCore | Calendar Report",
        "Calendar events and attendance details for the selected period.",
        4,
      );
      [
        ["Employee", user?.name || "Employee", "Period", rangeLabel],
        ["Calendar view", displayStatus(view), "Generated", dayjs().tz(timeZone).format("DD MMM YYYY, HH:mm")],
        ["Included categories", selectedCategories.join(", ") || "None", "Attendance details", selectedFilters.attendance ? "Included" : "Not included"],
      ].forEach((values) => {
        const row = overview.addRow(values);
        row.height = 24;
        [1, 3].forEach((column) => {
          row.getCell(column).font = {
            name: "Aptos",
            bold: true,
            color: { argb: "FF4C1D95" },
          };
          row.getCell(column).fill = lightFill;
        });
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.alignment = { vertical: "middle", wrapText: true };
          cell.border = {
            bottom: { style: "hair", color: { argb: "FFE9E5F7" } },
          };
        });
      });
      overview.addRow([]);
      overview.mergeCells("A8:D8");
      overview.getCell("A8").value = "Summary";
      overview.getCell("A8").font = { bold: true, color: { argb: "FF4C1D95" } };
      overview.getCell("A8").fill = lightFill;
      const summaryHeader = overview.addRow(["Metric", "Count", "", ""]);
      summaryHeader.height = 24;
      summaryHeader.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = brandFill;
      });
      summaryMetrics.forEach((metric) => {
        const row = overview.addRow([...metric, "", ""]);
        row.height = 22;
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.alignment = { vertical: "middle" };
          cell.border = {
            bottom: { style: "hair", color: { argb: "FFE9E5F7" } },
          };
          if (row.number % 2 === 0) cell.fill = lightFill;
        });
      });
      overview.views = [{ state: "frozen", ySplit: 9 }];

      const eventsSheet = createDetailSheet(
        "Calendar Events",
        "Calendar Events",
        `Events intersecting ${rangeLabel}. Start and end dates show the full event range.`,
        [16, 16, 16, 30, 20, 16, 30],
        ["Start date", "End date", "Duration (days)", "Event / leave type", "Category", "Status", "Details"],
        eventRows,
        "No calendar events in this period.",
      );
      eventsSheet.getColumn(1).numFmt = "dd mmm yyyy";
      eventsSheet.getColumn(2).numFmt = "dd mmm yyyy";
      eventsSheet.getColumn(3).numFmt = "0.##";
      eventRows.forEach((row, index) => {
        const statusCell = eventsSheet.getRow(index + 5).getCell(6);
        const status = String(statusCell.value).toLowerCase();
        if (status === "approved") {
          statusCell.font = { bold: true, color: { argb: "FF166534" } };
        } else if (status === "pending") {
          statusCell.font = { bold: true, color: { argb: "FF92400E" } };
        }
      });

      const attendanceSheet = createDetailSheet(
        "Attendance",
        "Daily Attendance",
        selectedFilters.attendance
          ? `Daily attendance details for ${rangeLabel}.`
          : `Attendance was excluded because its calendar filter was turned off.`,
        [16, 14, 20, 20, 14, 14, 16, 15, 12, 16],
        ["Date", "Day", "Day type", "Attendance status", "Check-in", "Check-out", "Worked hours", "Late minutes", "Leave days", "Leave period"],
        attendanceRows,
        "Attendance was not included for this period.",
      );
      attendanceSheet.getColumn(1).numFmt = "dd mmm yyyy";
      attendanceSheet.getColumn(7).numFmt = "0.00";
      attendanceSheet.getColumn(8).numFmt = "0";
      attendanceSheet.getColumn(9).numFmt = "0.##";
      attendanceRows.forEach((row, index) => {
        const statusCell = attendanceSheet.getRow(index + 5).getCell(4);
        const status = String(statusCell.value).toLowerCase();
        const color = status === "present"
          ? "FF166534"
          : status === "late"
            ? "FF92400E"
            : status === "absent"
              ? "FFB91C1C"
              : "";
        if (color) statusCell.font = { bold: true, color: { argb: color } };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `crew-hrcore-calendar-${periodStart}-to-${periodEnd}.xlsx`;
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
    <div className="overflow-hidden rounded-lg border border-[#E9E5F7]">
      <div className="grid grid-cols-7 border-b border-[#E9E5F7] bg-white">
        {weekdayLabels.map((label, index) => (
          <div
            className={`py-2.5 text-center text-[12px] font-semibold ${
              index > 4 ? "text-slate-500" : "text-slate-700"
            }`}
            key={label}
          >
            {label}
          </div>
        ))}
      </div>
      <div>
        {Array.from({ length: visibleDates.length / 7 }, (_, weekIndex) => {
          const weekDates = visibleDates.slice(
            weekIndex * 7,
            weekIndex * 7 + 7,
          );
          const leaveSegments = visibleRangeEvents
            .filter(isMultiDayLeave)
            .flatMap((event) => {
              const coveredDates = weekDates.filter((date) =>
                eventCoversDate(event, date),
              );
              if (!coveredDates.length) return [];
              const firstDate = coveredDates[0];
              const lastDate = coveredDates[coveredDates.length - 1];
              return [{
                event,
                startColumn: weekDates.indexOf(firstDate) + 1,
                endColumn: weekDates.indexOf(lastDate) + 2,
                startsHere: event.start === firstDate,
                endsHere: event.to === lastDate,
              }];
            });

          return (
            <div className="relative grid grid-cols-7" key={weekDates[0]}>
              {weekDates.map((date) => {
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
                  .sort((first, second) =>
                    first.start.localeCompare(second.start),
                  );
                const hasMultiDayLeave = eventsForDate.some(isMultiDayLeave);
                const dayEvents = eventsForDate.filter(
                  (event) => !isMultiDayLeave(event),
                );
                const events = dayEvents.slice(0, 2);
                const eventCount = dayEvents.length;

                return (
                  <button
                    aria-label={`${dateObj.format("dddd, D MMMM YYYY")}${eventsForDate.length ? `, ${eventsForDate.map((event) => event.title).join(", ")}` : ""}${marker ? `, ${dayData?.attendance?.status || dayData?.status} attendance` : ""}`}
                    aria-pressed={isSelected}
                    className={`flex min-h-[64px] min-w-0 flex-col border-b border-r border-[#F3E8FF] p-1.5 text-left transition hover:bg-violet-50/60 focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600 sm:min-h-[72px] sm:p-2 lg:min-h-[80px] ${
                      (dayData
                        ? dayData.status === "weekend"
                        : dateObj.day() === 0 || dateObj.day() === 6)
                        ? "bg-[#FBFAFF]"
                        : "bg-white"
                    } ${!isCurrentMonth ? "text-slate-500" : "text-slate-700"} ${
                      isSelected
                        ? "relative z-10 outline outline-2 outline-violet-600"
                        : ""
                    }`}
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    type="button"
                  >
                    <span className="flex w-full items-center justify-between gap-1">
                      <span
                        className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-[12px] font-semibold ${
                          isCurrentDate
                            ? "bg-gradient-to-br from-[#6A0DAD] to-[#7C3AED] text-white shadow-sm"
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
                    {hasMultiDayLeave && (
                      <span
                        aria-hidden="true"
                        className="mt-1 h-6 w-full shrink-0"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className="mt-1 flex w-full flex-wrap items-center gap-1 @min-[700px]/calendar:hidden"
                    >
                      {events.map((event) => (
                        <span
                          className={`h-2 w-2 rounded-full ${eventMarkerClass(event)}`}
                          key={event.id}
                        />
                      ))}
                      {eventCount > events.length && (
                        <span className="text-[12px] font-medium text-slate-600">
                          +{eventCount - events.length}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 hidden w-full gap-1 @min-[700px]/calendar:grid">
                      {events.map((event) => (
                        <span
                          className={`block truncate rounded-md px-1 py-0.5 text-[12px] font-semibold leading-4 sm:px-1.5 ${eventClassName(event)}`}
                          key={event.id}
                          title={event.title}
                        >
                          {event.title}
                        </span>
                      ))}
                      {eventCount > events.length && (
                        <span className="px-1 text-[12px] font-medium text-slate-600">
                          +{eventCount - events.length} more
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
              {leaveSegments.length > 0 && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-9 z-20 grid grid-cols-7"
                >
                  {leaveSegments.map((segment) => (
                    <span
                      className="h-6 min-w-0 overflow-hidden px-1"
                      key={`${segment.event.id}-${weekDates[0]}`}
                      style={{
                        gridColumn: `${segment.startColumn} / ${segment.endColumn}`,
                      }}
                    >
                      <span
                        className="block h-4 truncate text-[12px] font-semibold leading-4 text-violet-900"
                        title={segment.startsHere ? segment.event.title : undefined}
                      >
                        {segment.startsHere ? segment.event.title : ""}
                      </span>
                      <span
                        className={`block h-1.5 ${
                          segment.event.status === "pending"
                            ? "border-b-2 border-dashed border-violet-600"
                            : "bg-[#6A0DAD]"
                        } ${segment.startsHere ? "rounded-l-full" : ""} ${
                          segment.endsHere ? "rounded-r-full" : ""
                        }`}
                      />
                    </span>
                  ))}
                </div>
              )}
            </div>
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
            <h1 className="font-['Poppins',sans-serif] text-[28px] font-semibold leading-[1.2] tracking-[-0.6px] text-slate-900 xl:text-[30px]">
              Calendar
            </h1>
            <p className="mt-1 text-[14px] leading-[1.5] text-slate-600 sm:text-[15px]">
              See your attendance, leave, and company events by date.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-violet-100 px-3 text-[12px] font-semibold text-violet-800">
              <LockKeyhole size={13} />
              Read-only view
            </span>
          </div>
        </header>

        {error && (
          <div className="mb-4 flex justify-end">
            <button
              className="rounded-lg px-3 py-2 text-[13px] font-semibold text-violet-800 hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
              onClick={() => void load()}
              type="button"
            >
              Retry calendar
            </button>
          </div>
        )}

        <div className="grid min-w-0 items-start gap-4 @min-[700px]/calendar:grid-cols-[minmax(0,1fr)_290px]">
          <section className="min-w-0 rounded-lg border border-[#E9E5F7] bg-white p-3 shadow-[0_8px_24px_rgba(106,13,173,0.06)] sm:p-4 lg:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="min-w-0 truncate font-['Poppins',sans-serif] text-[18px] font-semibold tracking-[-0.3px] text-slate-900 sm:text-[20px]">
                  {view === "week"
                    ? `${dateAtNoon(visibleDates[0]).format("D MMM")} – ${dateAtNoon(visibleDates[6]).format("D MMM YYYY")}`
                    : dateAtNoon(`${month}-01`).format("MMMM YYYY")}
                </h2>
                <button
                  aria-label={view === "week" ? "Previous week" : "Previous month"}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#E9E5F7] text-slate-600 transition hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                  onClick={() => changeDate(-1)}
                  type="button"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  aria-label={view === "week" ? "Next week" : "Next month"}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#E9E5F7] text-slate-600 transition hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                  onClick={() => changeDate(1)}
                  type="button"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  className="h-9 shrink-0 rounded-lg bg-violet-100 px-3 text-[13px] font-semibold text-violet-800 transition hover:bg-violet-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                  onClick={() => setSelectedDate(today)}
                  type="button"
                >
                  Today
                </button>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div
                  aria-label="Calendar views"
                  className="inline-flex rounded-lg border border-[#E9E5F7] bg-[#FBFAFF] p-1"
                  role="group"
                >
                  {["month", "week", "agenda"].map((item) => (
                    <button
                      aria-pressed={view === item}
                      className={`min-h-8 rounded-md px-2.5 py-1.5 text-[12px] font-medium capitalize transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 sm:px-3 ${
                        view === item
                          ? "bg-white text-violet-800 shadow-sm"
                          : "text-slate-600 hover:text-violet-800"
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
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E9E5F7] px-2.5 text-[12px] font-semibold text-slate-700 transition hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:opacity-50"
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
                className="grid grid-cols-7 overflow-hidden rounded-lg border border-[#E9E5F7]"
              >
                {Array.from({ length: 42 }, (_, index) => (
                  <span
                    className="min-h-[64px] animate-pulse border-b border-r border-[#F3E8FF] bg-[#FBFAFF] sm:min-h-[72px] lg:min-h-[80px]"
                    key={index}
                  />
                ))}
              </div>
            ) : view === "agenda" ? (
              <div className="max-h-[690px] min-h-[280px] overflow-y-auto rounded-lg border border-[#E9E5F7]">
                {agendaRows.length ? (
                  agendaRows.map(({ date, event }) => (
                    <button
                      className="flex w-full items-center gap-3 border-b border-[#F3E8FF] px-3 py-3 text-left last:border-0 hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-600"
                      key={event.id}
                      onClick={() => setSelectedDate(date)}
                      type="button"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-violet-100 font-semibold text-violet-800">
                        <span className="text-[12px]">
                          {dateAtNoon(date).format("MMM")}
                        </span>
                        <span className="text-[15px] leading-4">
                          {dateAtNoon(date).format("D")}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-slate-800">
                          {event.title}
                        </span>
                        <span className="text-[12px] capitalize text-slate-500">
                          {event.type === "attendance"
                            ? `${event.status} attendance`
                            : event.type === "holiday"
                              ? "Public holiday"
                              : `${event.status} leave`}
                        </span>
                      </span>
                      <span className="text-[12px] text-slate-500">
                        {dateAtNoon(date).format("ddd")}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-12 text-center text-[13px] text-slate-500">
                    No calendar items in this period.
                  </p>
                )}
              </div>
            ) : (
              calendarDays
            )}
          </section>

          <aside className="grid min-w-0 gap-4 sm:grid-cols-2 @min-[700px]/calendar:grid-cols-1">
            <section className="rounded-lg border border-[#E9E5F7] bg-white p-4 shadow-[0_8px_24px_rgba(106,13,173,0.06)]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-['Poppins',sans-serif] text-[15px] font-semibold text-slate-900">
                  {dateAtNoon(selectedDate).format("dddd, D MMMM")}
                </h2>
                {selectedDate === today && (
                  <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[12px] font-semibold text-violet-800">
                    Today
                  </span>
                )}
              </div>
              <div className="mt-3 divide-y divide-purple-100 text-[13px]">
                <div className="flex items-start justify-between gap-2 py-2 first:pt-0">
                  <span className="text-slate-500">Attendance</span>
                  <span
                    className={`text-right font-semibold ${
                      attendanceStatus === "present"
                        ? "text-green-700"
                        : attendanceStatus === "late"
                          ? "text-amber-600"
                          : attendanceStatus === "absent"
                            ? "text-red-700"
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

            <section className="rounded-lg border border-[#E9E5F7] bg-white p-4 shadow-[0_8px_24px_rgba(106,13,173,0.06)]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="font-['Poppins',sans-serif] text-[15px] font-semibold text-slate-900">
                  Upcoming
                </h2>
                <button
                  className="text-[12px] font-semibold text-violet-800 hover:text-violet-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
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
                      className="flex w-full items-center gap-2.5 py-2 text-left first:pt-1 last:pb-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                      key={event.id}
                      onClick={() => setSelectedDate(event.upcomingDate)}
                      type="button"
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                          event.type === "holiday"
                            ? "bg-violet-100 text-violet-800"
                            : event.status === "pending"
                              ? "bg-violet-50 text-violet-800"
                              : "bg-purple-100 text-violet-800"
                        }`}
                      >
                        <span className="text-[12px] font-bold leading-3">
                          {dateAtNoon(event.upcomingDate).format("D")}
                        </span>
                        <span className="text-[12px] font-semibold">
                          {dateAtNoon(event.upcomingDate).format("MMM")}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-slate-800">
                          {event.title}
                        </span>
                        <span className="block truncate text-[12px] text-slate-500">
                          {eventSubtitle(event)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-[13px] text-slate-500">
                  No upcoming items.
                </p>
              )}
            </section>

            <section className="rounded-lg border border-[#E9E5F7] bg-white p-4 shadow-[0_8px_24px_rgba(106,13,173,0.06)] sm:col-span-2 @min-[700px]/calendar:col-span-1">
              <h2 className="font-['Poppins',sans-serif] text-[15px] font-semibold text-slate-900">
                Show on calendar
              </h2>
              <div className="mt-2 grid gap-2">
                {filters.map((filter) => (
                  <label
                    className="flex min-h-8 cursor-pointer items-center gap-2.5 text-[13px] text-slate-700"
                    key={filter.key}
                  >
                    <input
                      checked={selectedFilters[filter.key]}
                      className="h-4 w-4 accent-violet-700"
                      onChange={() => toggleFilter(filter.key)}
                      type="checkbox"
                    />
                    {filter.key === "attendance" ? (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="h-2 w-2 rounded-full bg-green-600" />
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="h-2 w-2 rounded-full bg-red-600" />
                      </span>
                    ) : filter.key === "pending" ? (
                      <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-violet-700" />
                    ) : (
                      <span className={`h-2.5 w-2.5 rounded-sm ${filter.color}`} />
                    )}
                    {filter.label}
                  </label>
                ))}
              </div>
              {loading && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-slate-500">
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
