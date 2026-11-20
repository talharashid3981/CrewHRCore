import { useEffect, useState } from "react";
import { CheckCircle2, LogIn, LogOut, MapPin } from "lucide-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const zone = "Asia/Karachi";

function formatTime(value) {
  return value ? dayjs(value).tz(zone).format("HH:mm") : "--:--";
}

function formatDuration(minutes = 0) {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  return `${Math.floor(safeMinutes / 60)}h ${String(safeMinutes % 60).padStart(2, "0")}m`;
}

function formatStatus(status = "pending") {
  if (status === "notEligible") return "Not eligible";
  return status.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export default function TodayAttendanceCard({
  attendance,
  leave,
  date,
  status = "pending",
  workedMinutes = 0,
  dashboard = false,
  canCheckIn = true,
  canCheckOut = true,
  working = false,
  reason = "",
  onAction = () => {},
}) {
  const [now, setNow] = useState(() => Date.now());
  const checkedIn = Boolean(attendance?.checkIn);
  const checkedOut = Boolean(attendance?.checkOut);
  const isWorking = checkedIn && !checkedOut;
  const action = isWorking ? "out" : checkedOut ? "done" : "in";
  const actionLabel =
    action === "out"
      ? "Check out"
      : action === "done"
        ? "Attendance complete"
        : "Check in";
  const actionDisabled =
    working ||
    action === "done" ||
    (action === "in" && !canCheckIn) ||
    (action === "out" && !canCheckOut);
  const statusTone =
    status === "late"
      ? "bg-amber-300"
      : status === "present"
        ? "bg-green-300"
        : "bg-purple-200";

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const cardClass = dashboard
    ? "relative min-h-[280px] min-w-0 self-start overflow-hidden rounded-lg bg-[linear-gradient(155deg,#4C1D95_0%,#6A0DAD_55%,#7C3AED_100%)] px-5 pb-4 pt-5 text-white shadow-[0_14px_30px_rgba(106,13,173,0.22)] sm:px-6 sm:pb-5 sm:pt-6"
    : "relative h-fit min-w-0 self-start overflow-hidden rounded-lg bg-[linear-gradient(155deg,#4C1D95_0%,#6A0DAD_55%,#7C3AED_100%)] px-5 pb-4 pt-5 text-white shadow-[0_14px_30px_rgba(106,13,173,0.22)] sm:px-6 sm:pb-4 sm:pt-6";
  const contentClass = dashboard
    ? "relative z-10 mt-5 w-full max-w-[470px]"
    : "relative z-10 mt-5 w-full max-w-[520px]";

  return (
    <section className={cardClass}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 top-1/2 h-[310px] w-[310px] -translate-y-1/2 rounded-full border border-white/20"
      >
        <div className="absolute inset-8 rounded-full border border-white/15" />
        <div className="absolute inset-16 rounded-full border border-white/15" />
        <div className="absolute inset-24 rounded-full border border-dashed border-white/20" />
        <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_0_7px_rgba(255,255,255,0.14),0_0_26px_rgba(255,255,255,0.9)]" />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3">
        <h2 className="font-['Poppins',sans-serif] text-[15px] font-semibold">
          Today&apos;s attendance
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold capitalize ring-1 ring-white/25">
          <span className={`h-1.5 w-1.5 rounded-full ${statusTone}`} />
          {formatStatus(status)}
        </span>
      </div>

      <div className={contentClass}>
        <div className="flex items-end gap-2">
          <p className="font-['Poppins',sans-serif] text-[40px] font-semibold leading-none tracking-[-1.5px] sm:text-[44px]">
            {dayjs(now).tz(zone).format("hh:mm")}
          </p>
          <span className="pb-1 text-[14px] font-semibold text-purple-100">
            {dayjs(now).tz(zone).format("A")}
          </span>
        </div>
        <p className="mt-1 text-[13px] text-purple-100">
          {date
            ? dayjs(`${date}T12:00:00Z`).tz(zone).format("dddd, DD MMMM YYYY")
            : dayjs(now).tz(zone).format("dddd, DD MMMM YYYY")}
        </p>
        {leave?.duration === "half" && (
          <p className="mt-1 text-[12px] font-medium text-purple-100">
            Approved half-day · {leave.halfDayPeriod} leave (0.5 day)
          </p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric label="Check in" value={formatTime(attendance?.checkIn)} />
          <Metric label="Check out" value={formatTime(attendance?.checkOut)} />
          <Metric label="Worked" value={formatDuration(workedMinutes)} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            className="inline-flex h-10 min-w-[170px] items-center justify-center gap-2 rounded-lg bg-white px-4 text-[13px] font-semibold text-violet-800 transition hover:bg-purple-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onAction(action)}
            disabled={actionDisabled}
            type="button"
          >
            {action === "out" ? (
              <LogOut size={15} aria-hidden="true" />
            ) : action === "done" ? (
              <CheckCircle2 size={15} aria-hidden="true" />
            ) : (
              <LogIn size={15} aria-hidden="true" />
            )}
            {working ? "Reading location..." : actionLabel}
          </button>
          {actionDisabled && reason && (
            <span className="max-w-[220px] text-[12px] leading-4 text-purple-100" title={reason}>
              {reason}
            </span>
          )}
        </div>

        {checkedIn && attendance?.checkInLocation && (
          <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-purple-100">
            <MapPin size={12} aria-hidden="true" />
            Inside office radius
          </p>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/15 bg-white/15 px-2.5 py-2">
      <span className="block truncate text-[12px] text-purple-100">{label}</span>
      <strong className="mt-0.5 block truncate font-['Poppins',sans-serif] text-[16px] font-semibold leading-tight">
        {value}
      </strong>
    </div>
  );
}
