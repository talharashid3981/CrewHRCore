import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronLeft, Download, MapPin, Plus, Save, Trash2 } from "lucide-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import ExcelJS from "exceljs";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { createHoliday, deleteHoliday, getDashboardCalendar, getOfficeSettings, listHolidays, updateHoliday, updateOfficeSettings } from "../api/auth.api";
import { useAuth } from "../context/AuthContext";
import EmployeeCalendarView from "./EmployeeCalendarView";

const defaultOffice = { name: "Main Office", latitude: "", longitude: "", radiusMeters: 100, graceMinutes: 15, weekendDays: [0, 6], isConfigured: false };
const weekDays = [[0, "Sunday"], [1, "Monday"], [2, "Tuesday"], [3, "Wednesday"], [4, "Thursday"], [5, "Friday"], [6, "Saturday"]];
dayjs.extend(utc);
dayjs.extend(timezone);
const todayKey = () => dayjs().tz("Asia/Karachi").format("YYYY-MM-DD");
const holidayEnd = (holiday) => holiday.to || holiday.date;
const holidayDateLabel = (holiday) => {
  const start = dayjs(holiday.date);
  const end = dayjs(holidayEnd(holiday));
  return start.isSame(end, "day")
    ? start.format("DD MMM YYYY")
    : `${start.format("DD MMM YYYY")} – ${end.format("DD MMM YYYY")}`;
};

export default function HolidayCalendarPage({ adminMode = false, embedded = false }) {
  const { user } = useAuth();
  const isAdmin = adminMode || user?.role === "admin";
  const [office, setOffice] = useState(defaultOffice);
  const [officeForm, setOfficeForm] = useState(defaultOffice);
  const [holidays, setHolidays] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [holidayForm, setHolidayForm] = useState({ name: "", from: dayjs().format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD"), description: "" });
  const [editingId, setEditingId] = useState(null);
  const [range, setRange] = useState({ from: dayjs().startOf("year").format("YYYY-MM-DD"), to: dayjs().endOf("year").format("YYYY-MM-DD") });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true); setError("");
    try {
      const month = dayjs(range.from).add(7, "day").format("YYYY-MM");
      const [officeData, holidayData, calendarData] = await Promise.all([getOfficeSettings(), listHolidays(range), getDashboardCalendar(month)]);
      setOffice(officeData.settings || defaultOffice);
      setOfficeForm({ ...defaultOffice, ...(officeData.settings || {}) });
      setHolidays(holidayData.holidays || []);
      setCalendarEvents(calendarData.events || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load calendar settings.");
    } finally { setLoading(false); }
  }, [isAdmin, range]);

  useEffect(() => { const timer = setTimeout(() => { load(); }, 0); return () => clearTimeout(timer); }, [load]);

  const events = useMemo(() => calendarEvents.length ? calendarEvents : holidays.map((holiday) => ({ id: holiday._id, title: holiday.name, start: holiday.date, end: dayjs(holidayEnd(holiday)).add(1, "day").format("YYYY-MM-DD"), allDay: true, type: "holiday" })), [calendarEvents, holidays]);

  const updateField = (event) => setOfficeForm({ ...officeForm, [event.target.name]: event.target.value });
  const toggleWeekend = (day) => setOfficeForm({ ...officeForm, weekendDays: officeForm.weekendDays.includes(day) ? officeForm.weekendDays.filter((item) => item !== day) : [...officeForm.weekendDays, day].sort() });

  const saveOffice = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    const latitude = officeForm.latitude === "" || officeForm.latitude === null ? null : Number(officeForm.latitude);
    const longitude = officeForm.longitude === "" || officeForm.longitude === null ? null : Number(officeForm.longitude);
    if ((latitude === null) !== (longitude === null)) { setError("Latitude and longitude must both be set or both be empty."); setSaving(false); return; }
    try {
      const data = await updateOfficeSettings({ name: officeForm.name, latitude, longitude, radiusMeters: Number(officeForm.radiusMeters), graceMinutes: Number(officeForm.graceMinutes), weekendDays: officeForm.weekendDays });
      setOffice(data.settings); setOfficeForm({ ...defaultOffice, ...data.settings }); setNotice(data.message); 
    } catch (requestError) { setError(requestError.response?.data?.message || "Unable to save office settings."); }
    finally { setSaving(false); }
  };

  const saveHoliday = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    if (holidayForm.from > holidayForm.to) { setError("The end date cannot be before the start date."); setSaving(false); return; }
    const originalHoliday = holidays.find((holiday) => holiday._id === editingId);
    const rangeChanged = !originalHoliday
      || holidayForm.from !== originalHoliday.date
      || holidayForm.to !== holidayEnd(originalHoliday);
    if (holidayForm.from < todayKey() && rangeChanged) { setError("New holidays must start today or later."); setSaving(false); return; }
    try {
      const data = editingId
        ? await updateHoliday(editingId, holidayForm)
        : await createHoliday(holidayForm);
      setNotice(data.message); setHolidayForm({ name: "", from: dayjs().format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD"), description: "" }); setEditingId(null); await load();
    } catch (requestError) { setError(requestError.response?.data?.message || "Unable to save holiday."); }
    finally { setSaving(false); }
  };

  const editHoliday = (holiday) => { if (!holiday) return; setEditingId(holiday._id); setHolidayForm({ name: holiday.name, from: holiday.date, to: holidayEnd(holiday), description: holiday.description || "" }); };
  const removeHoliday = async (id) => { if (!window.confirm("Delete this holiday?")) return; setSaving(true); setError(""); try { const data = await deleteHoliday(id); setNotice(data.message); await load(); } catch (requestError) { setError(requestError.response?.data?.message || "Unable to delete holiday."); } finally { setSaving(false); } };

  const exportHolidays = async () => {
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Holidays");
    sheet.columns = [{ header: "Holiday", key: "name", width: 28 }, { header: "Date", key: "date", width: 16 }, { header: "Description", key: "description", width: 55 }];
    holidays.forEach((holiday) => sheet.addRow({ name: holiday.name, date: holidayDateLabel(holiday), description: holiday.description || "" }));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6A0DAD" } };
    const buffer = await workbook.xlsx.writeBuffer(); const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `crew-hrcore-holidays-${dayjs().format("YYYY-MM-DD")}.xlsx`; anchor.click(); URL.revokeObjectURL(url);
  };

  if (!isAdmin) return <EmployeeCalendarView embedded={embedded} />;

  return <main className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-8"><div className="mx-auto max-w-7xl"><header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Link className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 no-underline" to={isAdmin ? "/admin/dashboard" : "/dashboard"}><ChevronLeft size={16} /> Back to workspace</Link><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-violet-600">Module 3 · Calendar & settings</p><h1 className="text-3xl font-bold tracking-tight text-slate-950">{isAdmin ? "Office & holidays" : "Office calendar"}</h1><p className="mt-2 text-sm text-slate-500">{isAdmin ? "Configure office rules and manage company holidays." : "View office rules and upcoming company holidays."}</p></div>{!isAdmin && <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500"><MapPin size={15} className="mr-1 inline text-violet-600" /> {office.name}</div>}</header>{error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}{notice && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">{notice}</p>}
    <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">{isAdmin && <OfficeForm office={officeForm} updateField={updateField} toggleWeekend={toggleWeekend} saveOffice={saveOffice} saving={saving} />}{!isAdmin && <OfficeSummary office={office} />}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-1"><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-lg font-bold text-slate-900">Company holidays</h2><p className="mt-1 text-sm text-slate-500">{loading ? "Loading holidays..." : `${holidays.length} holiday${holidays.length === 1 ? "" : "s"} in this range`}</p></div><button onClick={exportHolidays} disabled={!holidays.length} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-violet-200 px-4 text-sm font-bold text-violet-700 disabled:cursor-not-allowed disabled:opacity-40"><Download size={16} /> Export Excel</button></div><FullCalendar plugins={[dayGridPlugin, interactionPlugin]} initialView="dayGridMonth" height="auto" events={events} datesSet={(info) => setRange({ from: dayjs(info.start).format("YYYY-MM-DD"), to: dayjs(info.end).subtract(1, "day").format("YYYY-MM-DD") })} dateClick={isAdmin ? (info) => { if (info.dateStr < todayKey()) { setError("New holidays can only start today or later."); return; } setEditingId(null); setHolidayForm({ name: "", from: info.dateStr, to: info.dateStr, description: "" }); } : undefined} eventClick={isAdmin ? (info) => editHoliday(holidays.find((holiday) => holiday._id === info.event.id || `h-${holiday._id}` === info.event.id)) : undefined} />
        <div className="mt-5 grid gap-2">{holidays.slice(0, 8).map((holiday) => <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3" key={holiday._id}><div className="grid h-9 w-9 place-items-center rounded-lg bg-violet-100 text-violet-700"><CalendarDays size={17} /></div><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-800">{holiday.name}</strong><span className="text-xs text-slate-500">{holidayDateLabel(holiday)}</span></div>{isAdmin && <div className="flex gap-2"><button onClick={() => editHoliday(holiday)} className="text-xs font-bold text-violet-700">Edit</button><button onClick={() => removeHoliday(holiday._id)} disabled={saving} className="text-xs font-bold text-red-600"><Trash2 size={15} /></button></div>}</div>)}</div></section>
    </div>{isAdmin && <HolidayForm form={holidayForm} setForm={setHolidayForm} editing={Boolean(editingId)} save={saveHoliday} saving={saving} cancel={() => { setEditingId(null); setHolidayForm({ name: "", from: dayjs().format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD"), description: "" }); }} />}</div></main>;
}

function OfficeForm({ office, updateField, toggleWeekend, saveOffice, saving }) { return <form onSubmit={saveOffice} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-bold text-slate-900">Office settings</h2><p className="mt-1 text-sm text-slate-500">These rules are used for attendance location and timing.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-bold text-slate-600 sm:col-span-2">Office name<input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" name="name" value={office.name} onChange={updateField} maxLength={150} required /></label><label className="grid gap-1.5 text-xs font-bold text-slate-600">Latitude<input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-400" name="latitude" type="number" step="any" value={office.latitude ?? ""} onChange={updateField} placeholder="31.5204" /></label><label className="grid gap-1.5 text-xs font-bold text-slate-600">Longitude<input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-400" name="longitude" type="number" step="any" value={office.longitude ?? ""} onChange={updateField} placeholder="74.3587" /></label><label className="grid gap-1.5 text-xs font-bold text-slate-600">Radius (meters)<input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-400" name="radiusMeters" type="number" min="20" max="1000" value={office.radiusMeters} onChange={updateField} required /></label><label className="grid gap-1.5 text-xs font-bold text-slate-600">Grace period (minutes)<input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-400" name="graceMinutes" type="number" min="0" max="120" value={office.graceMinutes} onChange={updateField} required /></label></div><fieldset className="mt-5"><legend className="text-xs font-bold text-slate-600">Weekend days</legend><div className="mt-2 flex flex-wrap gap-2">{weekDays.map(([day, label]) => <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600" key={day}><input type="checkbox" checked={office.weekendDays.includes(day)} onChange={() => toggleWeekend(day)} />{label}</label>)}</div></fieldset><div className="mt-5 flex items-center justify-between gap-3"><span className={`text-xs font-semibold ${office.latitude !== null && office.latitude !== "" && office.longitude !== null && office.longitude !== "" ? "text-emerald-600" : "text-amber-600"}`}>{office.latitude !== null && office.latitude !== "" && office.longitude !== null && office.longitude !== "" ? "Office location configured" : "Location not configured"}</span><button disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-60"><Save size={16} />{saving ? "Saving..." : "Save settings"}</button></div></form>; }

function OfficeSummary({ office }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-bold text-slate-900">Office rules</h2><p className="mt-1 text-sm text-slate-500">Current settings for your attendance workspace.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Info label="Office" value={office.name} /><Info label="Radius" value={`${office.radiusMeters} meters`} /><Info label="Grace period" value={`${office.graceMinutes} minutes`} /><Info label="Location" value={office.isConfigured ? "Configured" : "Not configured"} /></div><div className="mt-5 rounded-xl bg-violet-50 p-4 text-sm text-violet-900"><MapPin size={16} className="mr-2 inline" />Exact office coordinates are private and are only visible to administrators.</div></section>; }
function Info({ label, value }) { return <div className="rounded-xl bg-slate-50 p-4"><span className="block text-xs text-slate-500">{label}</span><strong className="mt-1 block text-sm text-slate-800">{value}</strong></div>; }
function HolidayForm({ form, setForm, editing, save, saving, cancel }) { const update = (key, value) => setForm({ ...form, [key]: value, ...(key === "from" && value > form.to ? { to: value } : {}) }); const minimumDate = editing && form.from < todayKey() ? form.from : todayKey(); return <form onSubmit={save} className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{editing ? "Edit holiday" : "Add holiday"}</h2><p className="mt-1 text-sm text-slate-500">Select the first and last day; the holiday covers the full range.</p></div>{editing && <button type="button" onClick={cancel} className="text-sm font-bold text-slate-500">Cancel</button>}</div><div className="mt-5 grid gap-4 sm:grid-cols-6"><label className="grid gap-1.5 text-xs font-bold text-slate-600 sm:col-span-2">Holiday name<input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-400" placeholder="e.g. Independence Day" value={form.name} onChange={(event) => update("name", event.target.value)} maxLength={150} required /></label><label className="grid gap-1.5 text-xs font-bold text-slate-600 sm:col-span-1">From<input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-400" type="date" min={minimumDate} value={form.from} onChange={(event) => update("from", event.target.value)} required /></label><label className="grid gap-1.5 text-xs font-bold text-slate-600 sm:col-span-1">To<input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-400" type="date" min={minimumDate > form.from ? minimumDate : form.from} value={form.to} onChange={(event) => update("to", event.target.value)} required /></label><label className="grid gap-1.5 text-xs font-bold text-slate-600 sm:col-span-2">Description (optional)<input className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-400" placeholder="Add helpful details" value={form.description} onChange={(event) => update("description", event.target.value)} maxLength={500} /></label><button disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-60 sm:col-span-6"><Plus size={16} />{saving ? "Saving..." : editing ? "Update holiday" : "Add holiday"}</button></div></form>; }
