import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  LockKeyhole,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import ExcelJS from "exceljs";
import {
  createHoliday,
  deleteHoliday,
  getDashboardCalendar,
  getOfficeSettings,
  listHolidays,
  updateHoliday,
} from "../../api/auth.api";
import { useAuth } from "../../context/AuthContext";

dayjs.extend(utc);
dayjs.extend(timezone);

const timeZone = "Asia/Karachi";
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const todayKey = () => dayjs().tz(timeZone).format("YYYY-MM-DD");
const keyForDate = (date) => date.format("YYYY-MM-DD");
const localDate = (key) => dayjs(`${key}T12:00:00`);
const emptyHoliday = (from = todayKey(), to = from) => ({ name: "", from, to, description: "" });
const holidayEnd = (holiday) => holiday.to || holiday.date;
const holidayRangeLabel = (holiday) => {
  const start = localDate(holiday.date);
  const end = localDate(holidayEnd(holiday));
  return start.isSame(end, "day")
    ? start.format("ddd · YYYY-MM-DD")
    : `${start.format("ddd, YYYY-MM-DD")} – ${end.format("ddd, YYYY-MM-DD")}`;
};

export default function AdminCalendarPage() {
  const { user } = useAuth();
  const initialDate = dayjs().tz(timeZone);
  const [month, setMonth] = useState(initialDate.startOf("month"));
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [view, setView] = useState("month");
  const [holidays, setHolidays] = useState([]);
  const [events, setEvents] = useState([]);
  const [office, setOffice] = useState(null);
  const [holidayForm, setHolidayForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestId = useRef(0);

  const monthKey = month.format("YYYY-MM");
  const year = month.year();
  const range = useMemo(() => ({
    from: `${year}-01-01`,
    to: `${year + 1}-12-31`,
  }), [year]);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const [officeData, holidayData, calendarData] = await Promise.all([
        getOfficeSettings(),
        listHolidays(range),
        getDashboardCalendar(monthKey),
      ]);
      if (request !== requestId.current) return;
      setOffice(officeData.settings || null);
      setHolidays(holidayData.holidays || []);
      setEvents(calendarData.events || []);
    } catch (requestError) {
      if (request === requestId.current) {
        setError(requestError.response?.data?.message || "Unable to load the organization calendar.");
      }
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [monthKey, range]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => {
      window.clearTimeout(timer);
      requestId.current += 1;
    };
  }, [load]);

  const holidayByDate = useMemo(() => {
    const byDate = new Map();
    holidays.forEach((holiday) => {
      const end = holidayEnd(holiday);
      for (let date = localDate(holiday.date); keyForDate(date) <= end; date = date.add(1, "day")) {
        byDate.set(keyForDate(date), holiday);
      }
    });
    return byDate;
  }, [holidays]);
  const eventsByDate = useMemo(() => {
    const byDate = new Map();
    events.forEach((event) => {
      const key = event.start;
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(event);
    });
    return byDate;
  }, [events]);
  const upcomingHolidays = holidays
    .filter((holiday) => holidayEnd(holiday) >= todayKey())
    .sort((first, second) => first.date.localeCompare(second.date));
  const pastHolidays = holidays.filter(
    (holiday) => holidayEnd(holiday) < todayKey()
      && holiday.date <= `${year}-12-31`
      && holidayEnd(holiday) >= `${year}-01-01`,
  ).sort((first, second) => second.date.localeCompare(first.date));
  const weekendDays = office?.weekendDays || [0, 6];
  const monthDays = month.daysInMonth();
  const firstOffset = (month.startOf("month").day() + 6) % 7;
  const calendarCells = Array.from({ length: Math.ceil((firstOffset + monthDays) / 7) * 7 }, (_, index) => {
    const date = month.startOf("month").subtract(firstOffset, "day").add(index, "day");
    const key = keyForDate(date);
    return {
      date,
      key,
      inMonth: date.month() === month.month(),
      isWeekend: weekendDays.includes(date.day()),
      holiday: holidayByDate.get(key),
      events: eventsByDate.get(key) || [],
    };
  });
  const monthHolidays = calendarCells.filter((cell) => cell.inMonth && cell.holiday).length;
  const weekendCount = calendarCells.filter((cell) => cell.inMonth && cell.isWeekend).length;
  const workingCount = calendarCells.filter(
    (cell) => cell.inMonth && !cell.isWeekend && !cell.holiday,
  ).length;

  const shiftMonth = (amount) => {
    setMonth((current) => current.add(amount, "month"));
    setSelectedDate((current) => {
      const base = localDate(current).add(amount, "month");
      return keyForDate(base.date(Math.min(localDate(current).date(), base.daysInMonth())));
    });
  };
  const goToToday = () => {
    const today = dayjs().tz(timeZone);
    setMonth(today.startOf("month"));
    setSelectedDate(todayKey());
  };
  const openNewHoliday = (date = selectedDate) => {
    setEditingId(null);
    setHolidayForm(emptyHoliday(date < todayKey() ? todayKey() : date));
    setError("");
    setNotice("");
  };
  const openEditHoliday = (holiday) => {
    setEditingId(holiday._id);
    setHolidayForm({
      name: holiday.name,
      from: holiday.date,
      to: holidayEnd(holiday),
      description: holiday.description || "",
    });
    setError("");
    setNotice("");
  };
  const saveHoliday = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (holidayForm.from > holidayForm.to) {
      setError("The end date cannot be before the start date.");
      return;
    }
    const originalHoliday = holidays.find((holiday) => holiday._id === editingId);
    const rangeChanged = !originalHoliday
      || holidayForm.from !== originalHoliday.date
      || holidayForm.to !== holidayEnd(originalHoliday);
    if (holidayForm.from < todayKey() && rangeChanged) {
      setError("New holidays must start today or later.");
      return;
    }
    setSaving(true);
    try {
      const result = editingId
        ? await updateHoliday(editingId, holidayForm)
        : await createHoliday(holidayForm);
      setNotice(result.message || "Holiday saved.");
      setSelectedDate(holidayForm.from);
      setMonth(localDate(holidayForm.from).startOf("month"));
      setHolidayForm(null);
      setEditingId(null);
      await load();
    } catch (requestError) {
      const response = requestError.response?.data;
      const conflicts = response?.conflictingDates?.length
        ? ` Conflicting dates: ${response.conflictingDates.join(", ")}.`
        : "";
      setError(`${response?.message || "Unable to save holiday."}${conflicts}`);
    } finally {
      setSaving(false);
    }
  };
  const removeHoliday = async (holiday) => {
    if (!window.confirm(`Delete "${holiday.name}" from the calendar?`)) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await deleteHoliday(holiday._id);
      setNotice(result.message || "Holiday deleted.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to delete holiday.");
    } finally {
      setSaving(false);
    }
  };
  const exportHolidays = async () => {
    setExporting(true);
    setError("");
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Organization holidays");
      sheet.columns = [
        { header: "Holiday", key: "name", width: 30 },
        { header: "From", key: "from", width: 18 },
        { header: "To", key: "to", width: 18 },
        { header: "Description", key: "description", width: 54 },
      ];
      holidays.forEach((holiday) => sheet.addRow({
        name: holiday.name,
        from: localDate(holiday.date).format("ddd, YYYY-MM-DD"),
        to: localDate(holidayEnd(holiday)).format("ddd, YYYY-MM-DD"),
        description: holiday.description || "",
      }));
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6A0DAD" } };
      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `crew-hrcore-holidays-${year}.xlsx`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      setError(exportError.message || "Unable to export holidays.");
    } finally {
      setExporting(false);
    }
  };

  return <main className="min-h-full bg-[#F8FAFC] px-4 py-5 text-slate-800 sm:px-6 lg:px-7 lg:py-4">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-['Poppins',sans-serif] text-[24px] font-semibold tracking-[-.5px] text-slate-900">Calendar</h1>
        <p className="mt-1 text-[12px] text-slate-500">Maintain the organization holiday calendar.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void exportHolidays()} disabled={!holidays.length || exporting} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-sm hover:border-violet-200 hover:text-violet-700 disabled:opacity-50">
          <Download size={13} />{exporting ? "Exporting..." : "Export"}
        </button>
        <button type="button" onClick={() => openNewHoliday()} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#7315bd] to-[#8439ec] px-3.5 text-[11px] font-semibold text-white shadow-[0_6px_14px_rgba(124,58,237,.25)] hover:brightness-105">
          <Plus size={14} />Add holiday
        </button>
        <span aria-label={`${upcomingHolidays.length} upcoming holidays`} title={`${upcomingHolidays.length} upcoming holidays`} className="relative grid size-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500">
        <Bell size={14} />
        {upcomingHolidays.length > 0 && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-rose-500" />}
        </span>
        <div className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3">
          <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 text-[9px] font-semibold text-white">{initials(user?.name)}</span>
          <span className="max-w-24 truncate text-[11px] font-medium text-slate-700">{user?.name?.split(" ")[0] || "Admin"}</span>
        </div>
      </div>
    </header>

    {error && <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700" role="alert">{error}</p>}
    {notice && <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700" role="status">{notice}</p>}

    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.95fr)]">
      <section className="min-w-0 rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_5px_18px_rgba(15,23,42,.035)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-['Poppins',sans-serif] text-[18px] font-semibold tracking-[-.3px] text-slate-900">{month.format("MMMM YYYY")}</h2>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-violet-50 hover:text-violet-700"><ChevronLeft size={15} /></button>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-violet-50 hover:text-violet-700"><ChevronRight size={15} /></button>
            <button type="button" onClick={goToToday} className="h-8 rounded-lg border border-violet-200 bg-violet-50 px-3 text-[10px] font-semibold text-violet-700 hover:bg-violet-100">Today</button>
            <div className="ml-1 flex rounded-xl border border-slate-100 bg-slate-50 p-1">
              {["month", "year"].map((item) => <button key={item} type="button" onClick={() => setView(item)} className={`rounded-lg px-3 py-1 text-[10px] font-semibold capitalize ${view === item ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{item}</button>)}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <SummaryPill color="violet" value={workingCount} label="working days" />
          <SummaryPill color="amber" value={monthHolidays} label="holiday" plural="holidays" />
          <SummaryPill color="slate" value={weekendCount} label="weekend days" />
        </div>

        {view === "month" ? <div className="mt-3">
          <div className="grid grid-cols-7">
            {weekdays.map((day) => <div key={day} className="px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-400">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 overflow-hidden rounded-xl border-l border-t border-slate-100">
            {calendarCells.map((cell) => <button
              type="button"
              key={cell.key}
              onClick={() => {
                setSelectedDate(cell.key);
                if (!cell.inMonth) setMonth(cell.date.startOf("month"));
                if (!cell.holiday && cell.key >= todayKey()) openNewHoliday(cell.key);
              }}
              aria-label={`${cell.date.format("dddd, D MMMM YYYY")}${cell.holiday ? `, public holiday: ${cell.holiday.name}` : ""}`}
              aria-pressed={selectedDate === cell.key}
              className={`group relative min-h-[76px] min-w-0 border-b border-r border-slate-100 p-1.5 text-left transition sm:min-h-[92px] sm:p-2 ${
                cell.isWeekend ? "bg-slate-50/70" : "bg-white"
              } ${!cell.inMonth ? "text-slate-300" : "text-slate-800"} ${
                cell.holiday ? "bg-amber-50/60" : ""
              } ${selectedDate === cell.key ? "z-10 outline outline-1 outline-violet-500" : "hover:bg-violet-50/50"}`}
            >
              <span className={`grid size-5 place-items-center rounded-full text-[10px] font-semibold sm:size-6 sm:text-[11px] ${cell.key === todayKey() ? "bg-violet-600 text-white" : ""}`}>{cell.date.date()}</span>
              {cell.inMonth && cell.key >= todayKey() && !cell.holiday && <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-md bg-violet-100 text-violet-700 opacity-0 transition group-hover:opacity-100"><Plus size={11} /></span>}
              <span className="mt-1 grid gap-1">
                {cell.holiday && <span title={`${cell.holiday.name} · ${holidayRangeLabel(cell.holiday)}`} className="block truncate rounded-md border-l-2 border-amber-500 bg-amber-100 px-1 py-1 text-[8px] font-semibold leading-tight text-amber-800">{cell.holiday.date === cell.key ? cell.holiday.name : "↳ Continued"}</span>}
                {cell.events.filter((event) => event.type === "leave").slice(0, cell.holiday ? 1 : 2).map((event) => <span key={event.id} title={event.title} className={`block truncate rounded-md px-1 py-1 text-[8px] font-medium leading-tight ${event.status === "pending" ? "border border-dashed border-violet-300 bg-white text-violet-700" : "bg-violet-50 text-violet-700"}`}>{event.title}</span>)}
              </span>
            </button>)}
          </div>
        </div> : <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 12 }, (_, index) => month.startOf("year").add(index, "month")).map((yearMonth) => <button type="button" key={yearMonth.format("YYYY-MM")} onClick={() => { setMonth(yearMonth); setView("month"); }} className={`rounded-xl border p-3 text-left transition hover:border-violet-300 hover:bg-violet-50/40 ${yearMonth.month() === month.month() ? "border-violet-300 bg-violet-50/50" : "border-slate-100 bg-white"}`}>
            <span className="text-[11px] font-semibold text-slate-800">{yearMonth.format("MMMM")}</span>
            <span className="mt-2 block text-[9px] text-slate-500">{holidays.filter((holiday) => holiday.date <= yearMonth.endOf("month").format("YYYY-MM-DD") && holidayEnd(holiday) >= yearMonth.startOf("month").format("YYYY-MM-DD")).length} holiday{holidays.filter((holiday) => holiday.date <= yearMonth.endOf("month").format("YYYY-MM-DD") && holidayEnd(holiday) >= yearMonth.startOf("month").format("YYYY-MM-DD")).length === 1 ? "" : "s"}</span>
          </button>)}
        </div>}
        {loading && <p className="mt-3 text-[10px] text-slate-400" role="status">Updating calendar…</p>}
      </section>

      <aside className="grid min-w-0 gap-3.5">
        <section className="min-w-0 rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_5px_18px_rgba(15,23,42,.035)] sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><CalendarDays size={16} className="text-violet-700" /><h2 className="font-['Poppins',sans-serif] text-[13px] font-semibold text-slate-900">Holidays</h2></div>
            <label className="relative">
              <span className="sr-only">Calendar year</span>
              <select value={year} onChange={(event) => { const nextMonth = month.year(Number(event.target.value)); setMonth(nextMonth); setSelectedDate(keyForDate(nextMonth.startOf("month"))); }} className="h-8 appearance-none rounded-lg border border-slate-200 bg-white py-1 pl-2.5 pr-7 text-[10px] font-semibold text-slate-700 outline-none focus:border-violet-400">
                {Array.from({ length: 9 }, (_, index) => dayjs().tz(timeZone).year() - 3 + index).map((optionYear) => <option key={optionYear} value={optionYear}>{optionYear}</option>)}
              </select><ChevronDown size={12} className="pointer-events-none absolute right-2 top-2.5 text-slate-500" />
            </label>
          </div>
          <div className="mt-4 max-h-[440px] space-y-4 overflow-y-auto pr-1">
            <HolidayGroup title="Upcoming" holidays={upcomingHolidays} saving={saving} onEdit={openEditHoliday} onDelete={removeHoliday} empty="No upcoming holidays in this calendar range." />
            <HolidayGroup title={`Past in ${year}`} holidays={pastHolidays} saving={saving} onEdit={openEditHoliday} onDelete={removeHoliday} empty={`No past holidays in ${year}.`} />
          </div>
        </section>
        <section className="rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_5px_18px_rgba(15,23,42,.035)] sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-['Poppins',sans-serif] text-[13px] font-semibold text-slate-900">Working-day rules</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[9px] font-semibold text-violet-700"><LockKeyhole size={10} />Office settings</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[9px] font-semibold text-slate-600">Weekends: {formatWeekends(weekendDays)}</span>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[9px] font-semibold text-slate-600">Grace {office?.graceMinutes ?? 15} min</span>
          </div>
          <p className="mt-2.5 flex items-start gap-1.5 text-[9px] leading-4 text-slate-500"><Info size={12} className="mt-0.5 shrink-0" />Holidays here are skipped in leave-day calculations and attendance automation.</p>
        </section>
      </aside>
    </div>

    {holidayForm && <HolidayDialog
      form={holidayForm}
      editing={Boolean(editingId)}
      saving={saving}
      error={error}
      onChange={setHolidayForm}
      onClose={() => { setHolidayForm(null); setEditingId(null); }}
      onSubmit={saveHoliday}
    />}
  </main>;
}

function SummaryPill({ color, value, label, plural }) {
  const tone = color === "amber" ? "bg-amber-500" : color === "slate" ? "bg-slate-400" : "bg-violet-500";
  return <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[9px] text-slate-600"><span className={`size-1.5 rounded-full ${tone}`} /><strong className="text-slate-800">{value}</strong>{value === 1 ? label : plural || label}</span>;
}

function HolidayGroup({ title, holidays, saving, onEdit, onDelete, empty }) {
  return <div>
    <h3 className="mb-1.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400">{title}</h3>
    {holidays.length ? <div className="divide-y divide-slate-100">
      {holidays.map((holiday) => <div key={holiday._id} className="flex items-center gap-2 py-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-center text-amber-700">
          <span><strong className="block font-['Poppins',sans-serif] text-[12px] leading-3">{localDate(holiday.date).format("DD")}</strong><small className="text-[7px] font-bold uppercase">{localDate(holiday.date).format("MMM")}</small></span>
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-[10px] font-semibold text-slate-800">{holiday.name}</strong>
          <span className="block truncate text-[9px] text-slate-400">{holidayRangeLabel(holiday)}</span>
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label={`Edit ${holiday.name}`} onClick={() => onEdit(holiday)} className="grid size-7 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"><Pencil size={12} /></button>
          <button type="button" aria-label={`Delete ${holiday.name}`} onClick={() => onDelete(holiday)} disabled={saving} className="grid size-7 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50"><Trash2 size={12} /></button>
        </div>
      </div>)}
    </div> : <p className="rounded-lg bg-slate-50 px-2.5 py-3 text-[9px] text-slate-400">{empty}</p>}
  </div>;
}

function HolidayDialog({ form, editing, saving, error, onChange, onClose, onSubmit }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  const updateHoliday = (key, value) => onChange({
    ...form,
    [key]: value,
    ...(key === "from" && value > form.to ? { to: value } : {}),
  });

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-3 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="holiday-dialog-title" className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/60 bg-white shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]">
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 id="holiday-dialog-title" className="font-['Poppins',sans-serif] text-[17px] font-semibold text-slate-900">{editing ? "Edit holiday" : "Add holiday"}</h2>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">{editing ? "Update this organization holiday." : "Choose the first and last day. The holiday will cover every date in this range."}</p>
        </div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Close dialog" className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X size={15} /></button>
      </header>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        {error && <p className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-700 sm:mx-6" role="alert">{error}</p>}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
          <fieldset className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
            <legend className="sr-only">Holiday details</legend>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[.08em] text-slate-400">Holiday details</div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-[10px] font-semibold text-slate-700 sm:col-span-2">Holiday name<input autoFocus required maxLength={150} value={form.name} onChange={(event) => updateHoliday("name", event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-normal outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" placeholder="e.g. Independence Day" /></label>
              <label className="min-w-0 text-[10px] font-semibold text-slate-700">From<input required type="date" min={editing && form.from < todayKey() ? form.from : todayKey()} value={form.from} onChange={(event) => updateHoliday("from", event.target.value)} className="mt-1.5 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-normal outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 sm:px-3" /></label>
              <label className="min-w-0 text-[10px] font-semibold text-slate-700">To<input required type="date" min={editing && form.from < todayKey() ? form.from : todayKey()} value={form.to} onChange={(event) => updateHoliday("to", event.target.value)} className="mt-1.5 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-normal outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 sm:px-3" /></label>
              <label className="min-w-0 text-[10px] font-semibold text-slate-700 sm:col-span-2">Description <span className="font-normal text-slate-400">(optional)</span><textarea rows={3} maxLength={500} value={form.description} onChange={(event) => updateHoliday("description", event.target.value)} className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-normal outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" placeholder="Add helpful details" /></label>
            </div>
          </fieldset>
        </div>
        <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} disabled={saving} className="h-9 rounded-lg border border-slate-200 px-4 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-violet-700 px-4 text-[10px] font-semibold text-white shadow-sm hover:bg-violet-800 disabled:opacity-60">{saving ? "Saving..." : editing ? "Save changes" : "Add holiday"}</button>
        </footer>
      </form>
    </section>
  </div>;
}

function formatWeekends(days) {
  const ordered = [...days].sort((first, second) => (first + 6) % 7 - (second + 6) % 7);
  return ordered.length ? ordered.map((day) => weekdayNames[day]).join(", ") : "None";
}

function initials(name = "") {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "AD";
}
