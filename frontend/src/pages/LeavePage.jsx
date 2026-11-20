import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Clock3,
  FileText,
  LoaderCircle,
  MinusCircle,
  RotateCcw,
  Smile,
  Sun,
  XCircle,
} from "lucide-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  applyLeave,
  cancelLeave,
  getLeavePolicy,
  getMyLeaveBalance,
  getMyLeaves,
  listLeaveTypes,
  previewLeave,
} from "../api/auth.api";

dayjs.extend(utc);
dayjs.extend(timezone);

const zone = "Asia/Karachi";
const pageSize = 6;
const today = () => dayjs().tz(zone).format("YYYY-MM-DD");
const calendarYear = () => Number(dayjs().tz(zone).format("YYYY"));
const formatDate = (value, format = "DD MMM YYYY") =>
  value ? dayjs(`${value}T12:00:00Z`).tz(zone).format(format) : "—";
const submittedDate = (value) =>
  value ? dayjs(value).tz(zone).format("D MMM") : "—";
const leaveYearStartDate = (year, policy) => {
  const [month, day] = (policy?.leaveYearStart || "01-01").split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
};
const leaveYearEndDate = (year, policy) => {
  const [month, day] = (policy?.leaveYearStart || "01-01").split("-").map(Number);
  const maxDay = new Date(Date.UTC(year + 1, month, 0)).getUTCDate();
  return new Date(Date.UTC(year + 1, month - 1, Math.min(day, maxDay) - 1))
    .toISOString()
    .slice(0, 10);
};
const leaveYearForDate = (date, policy) => {
  const year = Number(date.slice(0, 4));
  return date >= leaveYearStartDate(year, policy) ? year : year - 1;
};
const currentLeaveYear = (policy) => leaveYearForDate(today(), policy);

const statusStyles = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
};

const balanceThemes = [
  {
    icon: Sun,
    iconClass: "bg-violet-50 text-violet-600",
    barClass: "from-violet-700 to-violet-500",
  },
  {
    icon: CirclePlus,
    iconClass: "bg-emerald-50 text-emerald-600",
    barClass: "from-emerald-600 to-emerald-400",
  },
  {
    icon: Smile,
    iconClass: "bg-amber-50 text-amber-600",
    barClass: "from-amber-500 to-amber-400",
  },
  {
    icon: MinusCircle,
    iconClass: "bg-slate-100 text-slate-500",
    barClass: "from-slate-400 to-slate-300",
  },
];

export default function LeavePage() {
  const [selectedYear, setSelectedYear] = useState(calendarYear);
  const [policy, setPolicy] = useState({
    allowHalfDay: true,
    requireReason: true,
    allowPastDatedRequests: false,
    pastDatedLimitDays: 7,
    leaveYearStart: "01-01",
  });
  const [types, setTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    leaveType: "",
    from: today(),
    to: today(),
    reason: "",
    duration: "full",
    halfDayPeriod: "morning",
    documentReference: "",
  });
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeLeaveYear = currentLeaveYear(policy);
  const historicalYear = selectedYear < activeLeaveYear;
  const pastDateLimit = policy.allowPastDatedRequests
    ? dayjs(`${today()}T12:00:00Z`).subtract(policy.pastDatedLimitDays || 7, "day").format("YYYY-MM-DD")
    : today();
  const leaveYearStart = leaveYearStartDate(selectedYear, policy);
  const formStartDate = selectedYear === activeLeaveYear
    ? (pastDateLimit > leaveYearStart ? pastDateLimit : leaveYearStart)
    : leaveYearStart;
  const formEndDate = leaveYearEndDate(selectedYear, policy);
  const selectedType = useMemo(
    () => types.find((type) => String(type._id) === String(form.leaveType)),
    [types, form.leaveType],
  );
  const requiresDocument = selectedType?.documentRequiredAfterDays !== null
    && selectedType?.documentRequiredAfterDays !== undefined
    && (preview?.workingDates?.length || 0) > selectedType.documentRequiredAfterDays;
  const selectedBalance = useMemo(
    () =>
      balances.find(
        (item) => String(item.leaveType) === String(form.leaveType),
      ),
    [balances, form.leaveType],
  );
  const filteredLeaves = useMemo(
    () =>
      filter === "all"
        ? leaves
        : leaves.filter((leave) => leave.status === filter),
    [filter, leaves],
  );
  const pageCount = Math.max(1, Math.ceil(filteredLeaves.length / pageSize));
  const pageLeaves = filteredLeaves.slice((page - 1) * pageSize, page * pageSize);
  const statusCounts = useMemo(
    () =>
      leaves.reduce(
        (counts, leave) => {
          counts[leave.status] = (counts[leave.status] || 0) + 1;
          return counts;
        },
        { all: leaves.length },
      ),
    [leaves],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [typeData, balanceData, leaveData, policyData] = await Promise.all([
        listLeaveTypes(),
        getMyLeaveBalance(selectedYear),
        getMyLeaves({ year: selectedYear }),
        getLeavePolicy(),
      ]);
      const nextTypes = typeData.leaveTypes || [];
      const nextPolicy = policyData.policy || {
        allowHalfDay: true,
        requireReason: true,
        allowPastDatedRequests: false,
        pastDatedLimitDays: 7,
        leaveYearStart: "01-01",
      };
      setPolicy(nextPolicy);
      if (selectedYear === calendarYear()) {
        const nextYear = currentLeaveYear(nextPolicy);
        if (nextYear !== selectedYear) setSelectedYear(nextYear);
      }
      setTypes(nextTypes);
      setBalances(balanceData.balances || []);
      setLeaves(leaveData.leaves || []);
      setForm((current) => ({
        ...current,
        leaveType: current.leaveType || nextTypes[0]?._id || "",
      }));
      setPage(1);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to load leave data.",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (historicalYear) return undefined;
    const timer = setTimeout(() => {
      setForm((current) => {
        if (
          current.from.startsWith(String(selectedYear)) &&
          current.from >= formStartDate
        ) {
          return current;
        }
        return { ...current, from: formStartDate, to: formStartDate };
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [formStartDate, historicalYear, selectedYear]);

  useEffect(() => {
    let active = true;
    const validRange = form.from && form.to && form.from <= form.to;
    const timer = setTimeout(() => {
      setPreview(null);
      setPreviewError("");
      if (!validRange) {
        setPreviewLoading(false);
        return;
      }

      setPreviewLoading(true);
      previewLeave({
        from: form.from,
        to: form.to,
        duration: form.duration,
        ...(form.leaveType ? { leaveType: form.leaveType } : {}),
      })
        .then((result) => {
          if (active) setPreview(result);
        })
        .catch((requestError) => {
          if (active) {
            setPreviewError(
              requestError.response?.data?.message ||
                "Unable to preview these dates.",
            );
          }
        })
        .finally(() => active && setPreviewLoading(false));
    }, validRange ? 250 : 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form.from, form.to, form.duration, form.leaveType]);

  const update = (event) => {
    const { name, value } = event.target;
    if (name === "from" || name === "to" || name === "duration") {
      setPreview(null);
      setPreviewError("");
      setPreviewLoading(true);
    }
    setForm((current) => {
      if (name === "duration") {
        return {
          ...current,
          duration: value,
          to: value === "half" ? current.from : current.to,
        };
      }
      if (name === "from" && current.duration === "half") {
        return { ...current, from: value, to: value };
      }
      return { ...current, [name]: value };
    });
  };

  const resetForm = () => {
    setForm((current) => ({
      ...current,
      from: formStartDate,
      to: formStartDate,
      reason: "",
      duration: "full",
      halfDayPeriod: "morning",
      documentReference: "",
    }));
    setMessage("");
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await applyLeave(form);
      setMessage(result.message || "Leave request submitted.");
      setForm((current) => ({
        ...current,
        reason: "",
        duration: "full",
        halfDayPeriod: "morning",
        documentReference: "",
      }));
      await load();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to submit leave request.",
      );
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id) => {
    if (!window.confirm("Cancel this leave request?")) return;
    setError("");
    setMessage("");
    try {
      const result = await cancelLeave(id);
      setMessage(result.message || "Leave request cancelled.");
      await load();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to cancel this request.",
      );
    }
  };

  const baseCard =
    "min-w-0 rounded-lg border border-[#EDF0F6] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.04)]";
  const statuses = ["all", "pending", "approved", "rejected", "cancelled"];

  return (
    <section
      aria-label="My leave workspace"
      className="mx-auto w-full min-w-0 max-w-[1440px] @container/leave font-['Inter',sans-serif] text-slate-800"
    >
      <div className="mb-4 flex justify-end">
        <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 shadow-sm">
          <CalendarDays className="text-violet-600" size={15} />
          <span>Leave year</span>
          <select
            aria-label="Leave year"
            className="max-w-[108px] bg-transparent font-semibold text-slate-800 outline-none"
            value={selectedYear}
            onChange={(event) => {
              setLoading(true);
              setSelectedYear(Number(event.target.value));
            }}
          >
            {[activeLeaveYear - 1, activeLeaveYear, activeLeaveYear + 1].map(
              (yearOption) => (
                <option key={yearOption} value={yearOption}>
                  {yearOption}
                </option>
              ),
            )}
          </select>
        </label>
      </div>

      {error && (
        <p
          className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-[13px] text-rose-700"
          role="alert"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700"
          role="status"
        >
          {message}
        </p>
      )}

      <section
        aria-label={`${selectedYear} leave balances`}
        className="mb-4 grid min-w-0 grid-cols-1 gap-3 @min-[440px]/leave:grid-cols-2 @min-[820px]/leave:grid-cols-4"
      >
        {balances.map((balance, index) => {
          const theme = balanceThemes[index % balanceThemes.length];
          const Icon = theme.icon;
          const used = Math.max(0, balance.approved || 0);
          const isUnlimited = Boolean(balance.isUnlimited);
          const quota = Math.max(0, balance.effectiveQuota ?? balance.yearlyQuota ?? 0);
          const progress =
            !isUnlimited && quota
              ? Math.min(100, (used / quota) * 100)
              : 0;

          return (
            <article
              className={`${baseCard} flex min-h-[96px] min-w-0 flex-col justify-between p-3`}
              key={balance.leaveType}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${theme.iconClass}`}
                >
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center justify-between gap-1">
                    <p className="truncate text-[10px] font-medium leading-4 text-slate-500">
                      {balance.name}
                    </p>
                    {balance.pending > 0 && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[8px] font-semibold leading-3 text-amber-700 ring-1 ring-amber-200">
                        {balance.pending} pending
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 items-baseline gap-1">
                    <strong className="font-['Poppins',sans-serif] text-[17px] font-semibold leading-5 text-slate-900">
                      {isUnlimited ? used : Math.max(0, balance.available || 0)}
                    </strong>
                    <span className="truncate text-[9px] leading-4 text-slate-500">
                      {isUnlimited ? "days taken" : "days left"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-slate-100"
                  aria-label={
                    isUnlimited
                      ? `${balance.name}: no fixed limit`
                      : `${balance.name}: ${Math.round(progress)}% used`
                  }
                  role={isUnlimited ? "img" : "progressbar"}
                  aria-valuenow={isUnlimited ? undefined : Math.round(progress)}
                  aria-valuemin={isUnlimited ? undefined : 0}
                  aria-valuemax={isUnlimited ? undefined : 100}
                >
                  {!isUnlimited && (
                    <span
                      className={`block h-full rounded-full bg-gradient-to-r ${theme.barClass}`}
                      style={{ width: `${progress}%` }}
                    />
                  )}
                </div>
                <div className="mt-1 flex justify-between gap-2 text-[9px] leading-3 text-slate-500">
                  {isUnlimited ? (
                    <>
                      <span>No fixed limit</span>
                      <span>Needs approval</span>
                    </>
                  ) : (
                    <>
                      <span>{used} used</span>
                      <span>{quota} total</span>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
        {!loading && balances.length === 0 && (
          <p className={`${baseCard} p-4 text-[12px] text-slate-500`}>
            No leave balances are available for {selectedYear}.
          </p>
        )}
        {loading &&
          balances.length === 0 &&
          Array.from({ length: 4 }, (_, index) => (
            <div
              aria-hidden="true"
              className={`${baseCard} h-[158px] animate-pulse bg-white p-4`}
              key={index}
            >
              <div className="h-9 w-9 rounded-lg bg-slate-100" />
              <div className="mt-4 h-3 w-24 rounded bg-slate-100" />
              <div className="mt-2 h-6 w-20 rounded bg-slate-100" />
              <div className="mt-4 h-1.5 rounded-full bg-slate-100" />
            </div>
          ))}
      </section>

      <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-4">
        <form
          className={`${baseCard} min-w-0 p-4 sm:p-5`}
          onSubmit={submit}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-700">
                <FileText size={17} />
              </span>
              <div className="min-w-0">
                <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">
                  New leave request
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Requests are reviewed by an administrator.
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-100">
              Draft
            </span>
          </div>

          {historicalYear && (
            <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              Past leave years are read-only. Select the current or a future
              year to submit a request.
            </p>
          )}

          <div className="space-y-3.5">
            <label className="block min-w-0 text-[12px] font-semibold text-slate-700">
              Leave type
              <span className="relative mt-1.5 block">
                <select
                  className="h-11 w-full min-w-0 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-[13px] font-normal text-slate-800 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  name="leaveType"
                  value={form.leaveType}
                  onChange={update}
                  disabled={historicalYear}
                  required
                >
                  <option value="">Select leave type</option>
                  {types.map((type) => (
                    <option value={type._id} key={type._id}>
                      {type.name} ·{" "}
                      {type.isUnlimited
                        ? "No fixed limit"
                        : `${type.yearlyQuota} days`}
                    </option>
                  ))}
                </select>
                <ArrowRight
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400"
                  size={15}
                />
              </span>
            </label>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-slate-700">
                  Date range
                </span>
                {previewLoading ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-violet-600">
                    <LoaderCircle className="animate-spin" size={12} />
                    Checking dates
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">
                    {selectedBalance
                      ? selectedBalance.isUnlimited
                        ? "No fixed limit"
                        : `${selectedBalance.available} days left`
                      : "Select leave type"}
                  </span>
                )}
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5">
                  <CalendarDays className="shrink-0 text-violet-600" size={14} />
                  <span className="sr-only">From date</span>
                  <input
                    aria-label="From date"
                    className="h-10 w-full min-w-0 bg-transparent text-[11px] text-slate-700 outline-none"
                    name="from"
                    type="date"
                    min={formStartDate}
                    max={formEndDate}
                    value={form.from}
                    onChange={update}
                    disabled={historicalYear}
                    required
                  />
                </label>
                <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5">
                  <CalendarDays className="shrink-0 text-violet-600" size={14} />
                  <span className="sr-only">To date</span>
                  <input
                    aria-label="To date"
                    className="h-10 w-full min-w-0 bg-transparent text-[11px] text-slate-700 outline-none"
                    name="to"
                    type="date"
                    min={form.from || formStartDate}
                    max={formEndDate}
                    value={form.to}
                    onChange={update}
                    disabled={historicalYear || form.duration === "half"}
                    required
                  />
                </label>
              </div>
            </div>

            {preview && (
              <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-baseline gap-1.5">
                    <strong className="font-['Poppins',sans-serif] text-[16px] font-semibold text-slate-900">
                      {preview.days}
                    </strong>
                    <span className="text-[11px] text-slate-600">
                      working {preview.days <= 1 ? "day" : "days"}
                    </span>
                  </div>
                  {selectedBalance?.isUnlimited ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                      Needs approval
                    </span>
                  ) : selectedBalance && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        selectedBalance.available >= preview.days
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {selectedBalance.available >= preview.days
                        ? `${selectedBalance.available - preview.days} days left after request`
                        : `${preview.days - selectedBalance.available} days over balance`}
                    </span>
                  )}
                </div>
                {preview.workingDates?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {preview.workingDates.slice(0, 7).map((date) => (
                      <span
                        className="rounded-md border border-violet-200 bg-white px-2 py-1 text-center"
                        key={date}
                      >
                        <span className="block text-[9px] font-semibold uppercase text-violet-600">
                          {formatDate(date, "ddd")}
                        </span>
                        <span className="block text-[11px] font-semibold text-slate-800">
                          {formatDate(date, "DD")}
                        </span>
                      </span>
                    ))}
                    {preview.workingDates.length > 7 && (
                      <span className="self-center text-[10px] text-slate-500">
                        +{preview.workingDates.length - 7} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            {previewError && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                {previewError}
              </p>
            )}

            {policy.allowHalfDay && (
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
                <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-700">
                  <input
                    checked={form.duration === "half"}
                    className="size-4 accent-violet-600"
                    disabled={historicalYear}
                    onChange={(event) => update({
                      target: { name: "duration", value: event.target.checked ? "half" : "full" },
                    })}
                    type="checkbox"
                  />
                  Half-day request
                </label>
                {form.duration === "half" && (
                  <label className="relative flex items-center rounded-lg border border-slate-200 px-3">
                    <span className="sr-only">Half-day period</span>
                    <select
                      className="h-10 w-full appearance-none bg-transparent text-[12px] text-slate-700 outline-none"
                      name="halfDayPeriod"
                      value={form.halfDayPeriod}
                      onChange={update}
                      disabled={historicalYear}
                    >
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                    </select>
                    <ArrowRight
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400"
                      size={14}
                    />
                  </label>
                )}
              </div>
            )}

            {selectedType?.minimumNoticeDays > 0 && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
                This leave type requires {selectedType.minimumNoticeDays} days&apos; notice.
              </p>
            )}

            {requiresDocument && (
              <label className="block text-[12px] font-semibold text-slate-700">
                Supporting document link <span className="text-rose-500">*</span>
                <input
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-normal text-slate-800 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  name="documentReference"
                  type="url"
                  value={form.documentReference}
                  onChange={update}
                  disabled={historicalYear}
                  required
                  placeholder="https://..."
                />
              </label>
            )}

            <label className="block text-[12px] font-semibold text-slate-700">
              Reason {!policy.requireReason && <span className="font-normal text-slate-400">(optional)</span>}
              <span className="mt-1.5 block">
                <textarea
                  className="min-h-[88px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  name="reason"
                  value={form.reason}
                  onChange={update}
                  disabled={historicalYear}
                  minLength={policy.requireReason ? 3 : undefined}
                  maxLength={500}
                  placeholder="Briefly explain your request"
                  required={policy.requireReason}
                />
              </span>
              <span className="mt-1 flex justify-end text-[10px] font-normal text-slate-400">
                {form.reason.length} / 500
              </span>
            </label>

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 sm:min-w-[96px]"
                onClick={resetForm}
                disabled={historicalYear}
                type="button"
              >
                <RotateCcw size={14} />
                Reset
              </button>
              <button
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#6A0DAD] to-[#7C3AED] px-4 text-[12px] font-semibold text-white shadow-[0_8px_18px_rgba(106,13,173,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  saving ||
                  loading ||
                  historicalYear ||
                  !types.length ||
                  !preview?.days ||
                  (requiresDocument && !form.documentReference) ||
                  (selectedBalance &&
                    !selectedBalance.isUnlimited &&
                    selectedBalance.available < preview.days)
                }
                type="submit"
              >
                {saving && <LoaderCircle className="animate-spin" size={15} />}
                {saving ? "Submitting..." : "Submit request"}
                {!saving && <ArrowRight size={15} />}
              </button>
            </div>
          </div>
        </form>

        <section className={`${baseCard} @container min-w-0 overflow-hidden p-4 sm:p-5`}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-['Poppins',sans-serif] text-[14px] font-semibold text-slate-900">
                Request history
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {filteredLeaves.length
                  ? `${filteredLeaves.length} request${filteredLeaves.length === 1 ? "" : "s"} in ${selectedYear}`
                  : `Your leave requests for ${selectedYear}`}
              </p>
            </div>
            <p className="text-[10px] leading-4 text-slate-500">
              Review notes appear here once a decision is made.
            </p>
          </div>

          <div
            aria-label="Filter leave requests"
            className="mb-3 flex max-w-full gap-1 overflow-x-auto rounded-lg border border-slate-100 bg-slate-50 p-1"
            role="group"
          >
            {statuses.map((status) => (
              <button
                aria-pressed={filter === status}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold capitalize transition sm:text-[11px] ${
                  filter === status
                    ? "bg-white text-violet-700 shadow-sm"
                    : "text-slate-500 hover:text-violet-700"
                }`}
                key={status}
                onClick={() => {
                  setPage(1);
                  setFilter(status);
                }}
                type="button"
              >
                {status === "all" ? "All" : status}
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">
                  {statusCounts[status] || 0}
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid min-h-48 place-items-center text-[12px] text-slate-400">
              <span className="inline-flex items-center gap-2">
                <LoaderCircle className="animate-spin text-violet-600" size={16} />
                Loading requests...
              </span>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="grid min-h-48 place-items-center text-center text-[12px] text-slate-400">
              <div>
                <Clock3 className="mx-auto mb-2 text-violet-300" size={26} />
                <p>No {filter === "all" ? "" : `${filter} `}leave requests found.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2 @md:hidden">
                {pageLeaves.map((leave) => (
                  <LeaveRequestCard
                    key={leave.id}
                    leave={leave}
                    onCancel={cancel}
                  />
                ))}
              </div>

              <div className="hidden min-w-0 overflow-x-auto overscroll-x-contain @md:block">
                <table className="w-full min-w-[520px] border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      {["Leave type", "Dates", "Status", "Review note"].map(
                        (heading) => (
                          <th
                            className="px-2.5 py-2 font-medium first:pl-0 last:pr-0"
                            key={heading}
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {pageLeaves.map((leave) => (
                      <tr
                        className="border-b border-slate-100 last:border-0"
                        key={leave.id}
                      >
                        <td className="min-w-[110px] px-2.5 py-3 pl-0 align-top">
                          <strong className="block font-semibold text-slate-800">
                            {leave.leaveType?.name || "Leave"}
                          </strong>
                          <span className="mt-0.5 block text-[10px] text-slate-500">
                            Submitted {submittedDate(leave.createdAt)}
                          </span>
                        </td>
                        <td className="min-w-[105px] px-2.5 py-3 align-top">
                          <strong className="block font-semibold text-slate-800">
                            {leave.from === leave.to
                              ? formatDate(leave.from, "ddd D MMM")
                              : `${formatDate(leave.from, "D MMM")} – ${formatDate(leave.to, "D MMM")}`}
                          </strong>
                          <span className="mt-0.5 block text-[10px] text-slate-500">
                            {leave.days} working day{leave.days === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td className="px-2.5 py-3 align-top">
                          <StatusBadge status={leave.status} />
                        </td>
                        <td className="min-w-[145px] px-2.5 py-3 pr-0 align-top text-[10px] leading-4 text-slate-600">
                          {leave.reviewNote ||
                            (leave.status === "pending"
                              ? "Waiting for review."
                              :                               leave.status === "cancelled"
                                ? "Cancelled by you."
                                : leave.status === "approved"
                                  ? "Approved."
                                  : "Reviewed by admin.")}
                          {canCancel(leave) && (
                            <button
                              className="mt-1 block font-semibold text-rose-600 hover:text-rose-800"
                              onClick={() => cancel(leave.id)}
                              type="button"
                            >
                              Cancel request
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[10px] text-slate-500">
                <span>
                  Showing {(page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, filteredLeaves.length)} of{" "}
                  {filteredLeaves.length} requests
                </span>
                <div className="flex items-center gap-1">
                  <button
                    aria-label="Previous page"
                    className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-violet-50 disabled:opacity-40"
                    disabled={page === 1}
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
                    disabled={page === pageCount}
                    onClick={() =>
                      setPage((value) => Math.min(pageCount, value + 1))
                    }
                    type="button"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

function canCancel(leave) {
  return (
    leave.status === "pending" ||
    (leave.status === "approved" && leave.from > today())
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ring-1 ${
        statusStyles[status] || statusStyles.cancelled
      }`}
    >
      {status}
    </span>
  );
}

function LeaveRequestCard({ leave, onCancel }) {
  return (
    <article className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <strong className="block truncate text-[12px] font-semibold text-slate-800">
            {leave.leaveType?.name || "Leave"}
          </strong>
          <span className="mt-0.5 block text-[10px] text-slate-500">
            Submitted {submittedDate(leave.createdAt)}
          </span>
        </div>
        <StatusBadge status={leave.status} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <CalendarDays className="text-violet-600" size={13} />
        <span className="font-semibold text-slate-700">
          {leave.from === leave.to
            ? formatDate(leave.from, "ddd D MMM YYYY")
            : `${formatDate(leave.from)} – ${formatDate(leave.to)}`}
        </span>
        <span className="text-slate-500">
          · {leave.days} working day{leave.days === 1 ? "" : "s"}
        </span>
      </div>
      {leave.reason && (
        <p className="mt-2 break-words text-[11px] leading-4 text-slate-600">
          {leave.reason}
        </p>
      )}
      {leave.reviewNote && (
        <p className="mt-2 break-words rounded-md bg-white px-2.5 py-2 text-[10px] leading-4 text-slate-600">
          <strong className="text-slate-700">Review note: </strong>
          {leave.reviewNote}
        </p>
      )}
      {canCancel(leave) && (
        <button
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800"
          onClick={() => onCancel(leave.id)}
          type="button"
        >
          <XCircle size={13} />
          Cancel request
        </button>
      )}
    </article>
  );
}
