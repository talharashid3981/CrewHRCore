import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  LoaderCircle,
} from "lucide-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  getAttendanceHistory,
  getAttendanceToday,
  getDashboardMe,
} from "../api/auth.api";
import TodayAttendanceCard from "../components/TodayAttendanceCard";
import { submitAttendanceAction } from "./attendanceAction";

dayjs.extend(utc);
dayjs.extend(timezone);

const zone = "Asia/Karachi";
const cardClass =
  "rounded-lg border border-[#EDF0F6] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.04)]";
const statusStyles = {
  present: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  late: "bg-amber-50 text-amber-700 ring-amber-200",
  absent: "bg-rose-50 text-rose-700 ring-rose-200",
  leave: "bg-violet-50 text-violet-700 ring-violet-200",
  holiday: "bg-sky-50 text-sky-700 ring-sky-200",
  weekend: "bg-slate-100 text-slate-600 ring-slate-200",
  notEligible: "bg-slate-100 text-slate-600 ring-slate-200",
  pending: "bg-slate-100 text-slate-600 ring-slate-200",
};

function dateAtNoon(date) {
  return new Date(`${date}T12:00:00Z`);
}

function dateLabel(date, format = "DD MMM") {
  return date ? dayjs(dateAtNoon(date)).tz(zone).format(format) : "—";
}

function timeLabel(value) {
  return value ? dayjs(value).tz(zone).format("HH:mm") : "--:--";
}

function durationLabel(minutes = 0) {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  return `${Math.floor(safeMinutes / 60)}h ${String(safeMinutes % 60).padStart(2, "0")}m`;
}

function workedMinutes(attendance, date, today, now) {
  if (!attendance) return 0;
  if (attendance.checkIn && !attendance.checkOut && date === today) {
    return Math.max(0, dayjs(now).diff(dayjs(attendance.checkIn), "minute"));
  }
  return attendance.workedMinutes || 0;
}

function weekDateKeys(date) {
  const [year, month, day] = date.split("-").map(Number);
  const current = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (current.getUTCDay() + 6) % 7;
  current.setUTCDate(current.getUTCDate() - mondayOffset);

  return Array.from({ length: 5 }, (_, index) => {
    const weekday = new Date(current);
    weekday.setUTCDate(current.getUTCDate() + index);
    return weekday.toISOString().slice(0, 10);
  });
}

export default function EmployeeOverview({ onNavigate = () => {} }) {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [attendanceState, setAttendanceState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [attendanceActionError, setAttendanceActionError] = useState("");
  const [attendanceNotice, setAttendanceNotice] = useState("");
  const [attendanceWorking, setAttendanceWorking] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const currentDate = dayjs(now).tz(zone).format("YYYY-MM-DD");

  const loadDashboard = useCallback(async () => {
    try {
      setError("");
      setData(await getDashboardMe());
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load your dashboard summary.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setHistoryError("");
      const result = await getAttendanceHistory();
      setHistory(result.attendance || []);
    } catch (requestError) {
      setHistoryError(
        requestError.response?.data?.message ||
          "Unable to load recent attendance.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadAttendanceState = useCallback(async () => {
    try {
      setAttendanceState(await getAttendanceToday());
      setAttendanceActionError("");
    } catch (requestError) {
      setAttendanceState(null);
      setAttendanceActionError(
        requestError.response?.data?.message ||
          "Unable to load today's attendance availability.",
      );
    }
  }, []);

  const handleAttendanceAction = useCallback(
    async (action) => {
      if (action !== "in" && action !== "out") return;
      setAttendanceWorking(true);
      setAttendanceActionError("");
      setAttendanceNotice("");
      try {
        const result = await submitAttendanceAction(action);
        setAttendanceNotice(result.message || "Attendance updated.");
        await Promise.all([
          loadDashboard(),
          loadHistory(),
          loadAttendanceState(),
        ]);
      } catch (actionError) {
        setAttendanceActionError(
          actionError.message || "Attendance action could not be completed.",
        );
      } finally {
        setAttendanceWorking(false);
      }
    },
    [loadAttendanceState, loadDashboard, loadHistory],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDashboard();
      void loadHistory();
      void loadAttendanceState();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadAttendanceState, loadDashboard, loadHistory]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const recentRecords = useMemo(
    () => [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3),
    [history],
  );
  const weekData = useMemo(() => {
    if (!data?.date) return { days: [], totalMinutes: 0 };
    const recordsByDate = new Map(history.map((record) => [record.date, record]));
    const dates = weekDateKeys(data.date);
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const days = dates.map((date, index) => {
      const attendance =
        date === data.date
          ? data.today?.attendance || recordsByDate.get(date)
          : recordsByDate.get(date);
      return {
        date,
        label: labels[index],
        minutes: workedMinutes(attendance, date, data.date, now),
      };
    });

    return {
      days,
      totalMinutes: days.reduce((total, item) => total + item.minutes, 0),
    };
  }, [data, history, now]);

  const monthLabel = data?.month
    ? new Intl.DateTimeFormat("en", {
        month: "long",
        timeZone: "UTC",
      }).format(new Date(`${data.month}-01T12:00:00Z`))
    : "This month";

  if (loading && !data) {
    return (
      <div className={`${cardClass} grid min-h-64 place-items-center`}>
        <LoaderCircle className="animate-spin text-violet-700" size={26} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`${cardClass} p-5`}>
        <p className="text-[14px] text-rose-700" role="alert">
          {error || "Unable to load your dashboard summary."}
        </p>
        <button
          className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-violet-700"
          onClick={() => {
            setLoading(true);
            void loadDashboard();
          }}
          type="button"
        >
          Try again <ArrowRight size={15} />
        </button>
      </div>
    );
  }

  const summary = data.summary || {};
  const today = attendanceState || {
    date: data.date,
    record: data.today?.attendance,
    status: data.today?.status,
    state: {},
  };
  const stats = [
    {
      label: "Present",
      value: `${summary.present || 0} ${summary.present === 1 ? "day" : "days"}`,
      icon: CheckCircle2,
      theme: "emerald",
    },
    {
      label: "Late",
      value: `${summary.late || 0} ${summary.late === 1 ? "day" : "days"}`,
      icon: Clock3,
      theme: "amber",
    },
    {
      label: "Leave",
      value: `${summary.leave || 0} ${summary.leave === 1 ? "day" : "days"}`,
      icon: CalendarDays,
      theme: "violet",
    },
    {
      label: "Attendance",
      value: `${summary.attendancePercent || 0}%`,
      icon: FileText,
      theme: "violet",
      progress: summary.attendancePercent || 0,
    },
  ];

  return (
    <section className="space-y-[18px]">
      {error && (
        <p
          className="rounded-xl bg-rose-50 px-4 py-3 text-[13px] text-rose-700"
          role="alert"
        >
          {error}
        </p>
      )}
      {attendanceActionError && (
        <p
          className="rounded-lg bg-rose-50 px-4 py-3 text-[12px] text-rose-700"
          role="alert"
        >
          {attendanceActionError}
        </p>
      )}
      {attendanceNotice && (
        <p
          className="rounded-lg bg-emerald-50 px-4 py-3 text-[12px] text-emerald-700"
          role="status"
        >
          {attendanceNotice}
        </p>
      )}

      <div className="grid min-w-0 gap-4 min-[580px]:grid-cols-[5fr_7fr] lg:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
        <TodayAttendanceCard
          dashboard
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
          working={attendanceWorking}
          reason={
            today?.state?.reason ||
            attendanceActionError ||
            "Checking attendance availability"
          }
          onAction={handleAttendanceAction}
        />
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4">
          {stats.map((stat) => (
            <SummaryCard key={stat.label} month={monthLabel} {...stat} />
          ))}
        </div>
      </div>

      <div className="grid min-w-0 gap-4 min-[580px]:grid-cols-2 lg:grid-cols-3">
        <LeaveBalanceCard
          balances={data.balances || []}
          pendingCount={(data.balances || []).reduce(
            (total, balance) => total + (balance.pending || 0),
            0,
          )}
        />
        <UpcomingCard
          holidays={data.upcomingHolidays || []}
          leaves={data.upcomingLeaves || []}
          today={data.date}
          onViewCalendar={() => onNavigate("calendar")}
        />
        <WeekCard
          days={weekData.days}
          today={data.date}
          totalMinutes={weekData.totalMinutes}
        />
      </div>

      <RecentAttendanceCard
        data={data}
        error={historyError}
        loading={historyLoading}
        onViewAll={() => onNavigate("attendance")}
        records={recentRecords}
        now={now}
      />
    </section>
  );
}

function SummaryCard({ label, value, month, icon: Icon, theme, progress }) {
  const iconTheme =
    theme === "emerald"
      ? "bg-emerald-50 text-emerald-600"
      : theme === "amber"
        ? "bg-amber-50 text-amber-600"
        : "bg-purple-100 text-violet-700";

  return (
    <article
      className={`${cardClass} flex min-w-0 items-center gap-2 p-2 min-[580px]:min-h-[80px] min-[580px]:gap-2.5 min-[580px]:px-3 lg:gap-4 lg:px-4`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg min-[768px]:h-10 min-[768px]:w-10 ${iconTheme}`}
      >
        <Icon size={18} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] text-slate-500 min-[768px]:text-[12px]">
            {label}
          </p>
          <span className="hidden text-[10px] text-slate-400 min-[768px]:inline">
            {month}
          </span>
        </div>
        <strong className="mt-0.5 block truncate font-['Poppins',sans-serif] text-[15px] font-semibold leading-tight text-slate-900 min-[768px]:text-[18px]">
          {value}
        </strong>
        {progress !== undefined && (
          <div
            aria-label={`Attendance ${progress}%`}
            className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-purple-100"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span
              className="block h-full rounded-full bg-gradient-to-r from-violet-700 to-violet-500"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>
    </article>
  );
}

function LeaveBalanceCard({ balances, pendingCount }) {
  const visibleBalances = balances.filter((item) => item.isActive !== false).slice(0, 3);

  return (
    <section className={`${cardClass} min-w-0 p-4 sm:p-5 lg:min-h-[252px]`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">
          Leave balance
        </h2>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
            {pendingCount} pending
          </span>
        )}
      </div>

      {visibleBalances.length ? (
        <div className="mt-4 space-y-4">
          {visibleBalances.map((balance) => {
            const isUnlimited = Boolean(balance.isUnlimited);
            const quota = Math.max(0, balance.yearlyQuota || 0);
            const available = Math.max(0, balance.available || 0);
            const percent =
              !isUnlimited && quota
                ? Math.min(100, (available / quota) * 100)
                : 0;

            return (
              <div key={String(balance.leaveType)}>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate font-semibold text-slate-700">
                    {balance.name}
                  </span>
                  <span className="shrink-0 text-slate-500">
                    {isUnlimited
                      ? `${Math.max(0, balance.approved || 0)} days taken`
                      : `${available} of ${quota} days`}
                  </span>
                </div>
                <div
                  aria-label={
                    isUnlimited
                      ? `${balance.name}: no fixed limit`
                      : `${balance.name}: ${available} of ${quota} days available`
                  }
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-purple-100"
                  role={isUnlimited ? "img" : "progressbar"}
                  aria-valuenow={isUnlimited ? undefined : Math.round(percent)}
                  aria-valuemin={isUnlimited ? undefined : 0}
                  aria-valuemax={isUnlimited ? undefined : 100}
                >
                  {!isUnlimited && (
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-violet-700 to-violet-500"
                      style={{ width: `${percent}%` }}
                    />
                  )}
                </div>
                {isUnlimited && (
                  <p className="mt-1 text-[10px] text-slate-500">
                    No fixed limit · Needs approval
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-[12px] text-slate-400">
          No leave balances available.
        </p>
      )}
    </section>
  );
}

function UpcomingCard({ holidays, leaves, today, onViewCalendar }) {
  const items = [
    ...holidays.map((holiday) => ({
      id: holiday._id,
      title: holiday.name,
      subtitle: holiday.to && holiday.to !== holiday.date
        ? `Public holiday · ${dateLabel(holiday.date, "D MMM")}–${dateLabel(holiday.to, "D MMM")}`
        : "Public holiday",
      date: holiday.date < today && (holiday.to || holiday.date) >= today ? today : holiday.date,
      type: "holiday",
    })),
    ...leaves.map((leave) => ({
      id: leave._id,
      title: leave.leaveType?.name || "Approved leave",
      subtitle: "Approved leave",
      date: leave.from,
      type: "leave",
    })),
  ]
    .filter((item) => item.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  return (
    <section className={`${cardClass} min-w-0 p-4 sm:p-5 lg:min-h-[252px]`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">
          Upcoming
        </h2>
        <button
          className="shrink-0 text-[11px] font-semibold text-violet-700 hover:text-violet-900"
          onClick={onViewCalendar}
          type="button"
        >
          View calendar
        </button>
      </div>

      {items.length ? (
        <div className="mt-3 divide-y divide-slate-100">
          {items.map((item) => (
            <div className="flex items-center gap-3 py-2 first:pt-0" key={item.id}>
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-center ${
                  item.type === "holiday"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-purple-100 text-violet-700"
                }`}
              >
                <span>
                  <span className="block font-['Poppins',sans-serif] text-[13px] font-semibold leading-none">
                    {dateLabel(item.date, "DD")}
                  </span>
                  <span className="mt-0.5 block text-[8px] font-semibold uppercase leading-none">
                    {dateLabel(item.date, "MMM")}
                  </span>
                </span>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold text-slate-800">
                  {item.title}
                </span>
                <span className="block truncate text-[10px] text-slate-500">
                  {item.subtitle}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-[12px] text-slate-400">
          Nothing scheduled.
        </p>
      )}
    </section>
  );
}

function WeekCard({ days, today, totalMinutes }) {
  return (
    <section className={`${cardClass} min-w-0 p-4 sm:p-5 min-[580px]:col-span-2 lg:col-span-1 lg:min-h-[252px]`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">
          This week
        </h2>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
          {durationLabel(totalMinutes)}
        </span>
      </div>

      <div className="relative mt-5 h-[120px]">
        <span className="absolute right-0 top-0 z-10 text-[9px] text-slate-400">
          8h goal
        </span>
        <div className="absolute inset-x-0 top-[22%] border-t border-dashed border-violet-200" />
        <div className="absolute inset-x-0 bottom-0 border-t border-slate-100" />
        <div className="absolute inset-x-0 bottom-0 top-5 grid grid-cols-5 gap-2">
          {days.map((day) => {
            const percent = Math.min(100, (day.minutes / (8 * 60)) * 100);
            return (
              <div
                className="flex min-w-0 items-end"
                key={day.date}
                title={`${day.label}: ${durationLabel(day.minutes)}`}
              >
                <div className="relative flex h-full w-full items-end rounded-t-md border-x border-t border-dashed border-purple-100">
                  <span
                    className={`block w-full rounded-t-md ${
                      day.date === today
                        ? ""
                        : day.minutes
                          ? "bg-gradient-to-t from-violet-700 to-violet-500"
                          : ""
                    }`}
                    style={{
                      height: `${percent}%`,
                      ...(day.date === today && day.minutes
                        ? {
                            backgroundImage:
                              "repeating-linear-gradient(-45deg, #c4b5fd 0 5px, #8b5cf6 5px 10px)",
                          }
                        : {}),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1 grid grid-cols-5 gap-2 text-center text-[9px] text-slate-500">
        {days.map((day) => (
          <span key={day.date}>{day.label}</span>
        ))}
      </div>
    </section>
  );
}

function RecentAttendanceCard({ data, error, loading, onViewAll, records, now }) {
  return (
    <section className={`${cardClass} min-w-0 overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">
          Recent attendance
        </h2>
        <button
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:text-violet-900"
          onClick={onViewAll}
          type="button"
        >
          View all in My attendance <ChevronRight size={14} />
        </button>
      </div>

      {error && (
        <p className="mx-4 mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700 sm:mx-5" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid min-h-28 place-items-center border-t border-slate-100">
          <LoaderCircle className="animate-spin text-violet-700" size={22} />
        </div>
      ) : records.length === 0 ? (
        <p className="border-t border-slate-100 px-5 py-8 text-center text-[12px] text-slate-400">
          No attendance records yet.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto border-t border-slate-100 pb-[11px] md:block">
            <table className="w-full min-w-[650px] border-collapse text-left text-[11px]">
              <thead className="text-slate-500">
                <tr>
                  {["Date", "Check in", "Check out", "Worked", "Status"].map(
                    (heading) => (
                      <th
                        className="px-4 py-2 font-medium sm:px-5"
                        key={heading}
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <AttendanceRow
                    data={data}
                    key={record.id || record._id || record.date}
                    now={now}
                    record={record}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid divide-y divide-slate-100 border-t border-slate-100 md:hidden">
            {records.map((record) => (
              <MobileAttendanceRow
                data={data}
                key={record.id || record._id || record.date}
                now={now}
                record={record}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function AttendanceRow({ data, record, now }) {
  const today = record.date === data.date;
  const minutes = workedMinutes(record, record.date, data.date, now);

  return (
    <tr className="border-t border-slate-100 text-slate-700 first:border-t-0">
      <td className="whitespace-nowrap px-4 py-1.5 font-semibold sm:px-5">
        {dateLabel(record.date, "ddd DD MMM")}
        {today && <span className="font-normal text-slate-500"> (today)</span>}
      </td>
      <td className="whitespace-nowrap px-4 py-1.5">
        {timeLabel(record.checkIn)}
      </td>
      <td className="whitespace-nowrap px-4 py-1.5">
        {record.checkOut
          ? timeLabel(record.checkOut)
          : record.checkIn
            ? "In progress"
            : "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-1.5">{durationLabel(minutes)}</td>
      <td className="px-4 py-1.5">
        <StatusBadge status={record.status} />
      </td>
    </tr>
  );
}

function MobileAttendanceRow({ data, record, now }) {
  const today = record.date === data.date;
  const minutes = workedMinutes(record, record.date, data.date, now);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-slate-800">
          {dateLabel(record.date, "ddd DD MMM")}
          {today && " · Today"}
        </p>
        <p className="mt-1 truncate text-[10px] text-slate-500">
          {timeLabel(record.checkIn)} –{" "}
          {record.checkOut
            ? timeLabel(record.checkOut)
            : record.checkIn
              ? "In progress"
              : "—"}
          {" · "}
          {durationLabel(minutes)}
        </p>
      </div>
      <StatusBadge status={record.status} />
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = status || "pending";
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ring-1 ${
        statusStyles[normalized] || statusStyles.pending
      }`}
    >
      {normalized}
    </span>
  );
}
